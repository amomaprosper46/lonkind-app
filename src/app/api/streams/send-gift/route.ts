import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { assertAdultUserForAction } from '@/lib/age-gate-server';

const SendStreamGiftSchema = z.object({
  streamId: z.string().min(1),
  hostUid: z.string().min(1),
  giftId: z.string().min(1),
  giftName: z.string().min(1).max(60),
  giftEmoji: z.string().min(1).max(12),
  price: z.number().int().positive(),
  comboCount: z.number().int().min(1).max(999).default(1),
});

/**
 * POST /api/streams/send-gift
 * Executes an atomic Firestore Transaction (`adminDb.runTransaction`) that:
 *  1. Validates sender Wallet balance (`coins >= price`)
 *  2. Deducts `price` from sender's Wallet (`users/{senderUid}.coins`)
 *  3. Credits `price` to stream host's Wallet earnings (`users/{hostUid}.diamonds`)
 *  4. Logs the gift event in `streams/{streamId}/gifts`
 *  5. Advances `streams/{streamId}.streamGoal.currentAmount` when goal type === 'COINS'
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Sign in to send gifts.' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const senderUid = decoded.uid;

    const raw = await req.json().catch(() => null);
    const parsed = SendStreamGiftSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid gift request payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { streamId, hostUid, giftId, giftName, giftEmoji, price, comboCount } = parsed.data;
    const cleanHostUid = hostUid.replace(/^live_/, '');

    if (senderUid === cleanHostUid) {
      return NextResponse.json(
        { error: 'Hosts cannot send paid gifts to themselves.' },
        { status: 400 }
      );
    }

    // Enforce 18+ age gate on both sender and gift recipient
    const [senderAgeGate, hostAgeGate] = await Promise.all([
      assertAdultUserForAction(senderUid, 'sending virtual gifts'),
      assertAdultUserForAction(cleanHostUid, 'receiving virtual gifts'),
    ]);
    if (!senderAgeGate.allowed) {
      return NextResponse.json({ error: senderAgeGate.error }, { status: 403 });
    }
    if (!hostAgeGate.allowed) {
      return NextResponse.json({ error: 'This creator account is not eligible to receive paid gifts.' }, { status: 403 });
    }

    const senderRef = adminDb.collection('users').doc(senderUid);
    const hostRef = adminDb.collection('users').doc(cleanHostUid);
    const streamRef = adminDb.collection('streams').doc(streamId);
    const liveStreamRef = adminDb.collection('live_streams').doc(streamId);
    const giftEventRef = streamRef.collection('gifts').doc();

    const txResult = await adminDb.runTransaction(async (tx) => {
      const [senderSnap, hostSnap, streamSnap] = await Promise.all([
        tx.get(senderRef),
        tx.get(hostRef),
        tx.get(streamRef),
      ]);

      if (!senderSnap.exists) {
        throw { code: 'USER_NOT_FOUND', message: 'Sender wallet profile not found.' };
      }

      const senderData = senderSnap.data() || {};
      const currentCoins = Number(senderData.coins || 0);

      if (currentCoins < price) {
        throw {
          code: 'INSUFFICIENT_FUNDS',
          currentCoins,
          requiredCoins: price,
          message: `Insufficient coins. You have ${currentCoins.toLocaleString()} Coins, but ${giftName} costs ${price.toLocaleString()} Coins.`,
        };
      }

      const senderName = senderData.name || decoded.name || 'Supporter';
      const senderHandle = senderData.handle || senderName.toLowerCase().replace(/\s+/g, '_');
      const senderAvatar = senderData.avatarUrl || '';
      const remainingCoins = currentCoins - price;

      // 1. Deduct from sender Wallet
      tx.update(senderRef, {
        coins: remainingCoins,
        lifetimeTipsGiven: FieldValue.increment(price),
      });

      // 2. Credit stream host's Wallet earnings
      if (hostSnap.exists) {
        tx.update(hostRef, {
          diamonds: FieldValue.increment(price),
          lifetimeTipsReceived: FieldValue.increment(price),
        });
      }

      // 3. Log gift event in `streams/{streamId}/gifts`
      tx.set(giftEventRef, {
        id: giftEventRef.id,
        streamId,
        senderUid,
        senderName,
        senderHandle,
        senderAvatar,
        hostUid: cleanHostUid,
        giftId,
        giftName,
        giftEmoji,
        price,
        comboCount,
        isHighValue: price >= 1000,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
      });

      // 4. Advance `streams/{streamId}.streamGoal.currentAmount` if goal type is COINS
      const streamData = streamSnap.exists ? streamSnap.data() || {} : {};
      const currentGoal = streamData.streamGoal;
      if (currentGoal && currentGoal.type === 'COINS') {
        const nextAmount = Number(currentGoal.currentAmount || 0) + price;
        tx.set(
          streamRef,
          {
            streamGoal: {
              ...currentGoal,
              currentAmount: nextAmount,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        tx.set(streamRef, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      // 5. Mirror live contributor leaderboard on `live_streams/{streamId}`
      tx.set(
        liveStreamRef.collection('contributors').doc(senderUid),
        {
          uid: senderUid,
          name: senderName,
          avatarUrl: senderAvatar,
          totalCoins: FieldValue.increment(price),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        giftEventId: giftEventRef.id,
        remainingCoins,
        senderHandle,
        senderName,
      };
    });

    return NextResponse.json({
      success: true,
      ...txResult,
    });
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json(
        {
          error: err.message,
          insufficientFunds: true,
          currentCoins: err.currentCoins,
          requiredCoins: err.requiredCoins,
        },
        { status: 402 }
      );
    }
    console.error('[POST /api/streams/send-gift] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not process virtual gift transaction.' },
      { status: 500 }
    );
  }
}
