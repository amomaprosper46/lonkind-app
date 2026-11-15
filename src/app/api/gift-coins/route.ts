import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';
import { giftEventBroker } from '@/lib/gift-event-broker';
import { redisStreamLeaderboard } from '@/lib/redis-leaderboard';

const InputSchema = z.object({
  toUserId: z.string().trim().min(1, 'Recipient target UID required.'),
  coinAmount: z.number().int().positive('Gift quantity must be a positive integer.'),
  unitPrice: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  giftName: z.string().optional(),
  giftEmoji: z.string().optional(),
  roomId: z.string().optional(),
  spaceId: z.string().optional(),
  postId: z.string().optional(),
  isCauseDonation: z.boolean().optional(),
  idempotencyKey: z.string().trim().optional(),
});

/**
 * POST: Authenticated, ACID Double-Entry Ledger Gifting Engine
 * Never uses a blind `UPDATE user SET balance = balance - 10`.
 * Executes all reads, solvency checks, exact balance computations, and
 * paired DEBIT/CREDIT double-entry ledger entries inside a single Firestore transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const db = adminDb;

    // 1. Verify Firebase Authentication ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthenticated. Security token signature missing.' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    let verifiedSenderUid: string;

    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      verifiedSenderUid = decodedToken.uid;
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized credentials verification rejected.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload compilation.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      toUserId,
      coinAmount,
      unitPrice,
      quantity,
      giftName,
      giftEmoji,
      roomId,
      spaceId,
      postId,
      isCauseDonation,
      idempotencyKey: clientKey,
    } = parsed.data;
    const targetUserId = toUserId.replace(/^live_/, '');
    const effectiveRoomId = roomId || spaceId || `live_${targetUserId}`;
    const effectiveQuantity = quantity && quantity > 0 ? quantity : 1;
    const effectiveUnitPrice = unitPrice && unitPrice > 0 ? unitPrice : Math.round(coinAmount / effectiveQuantity);

    // 1 Lonkind Coin (L) = ₦10 Naira (or $0.01 USD equivalent)
    const cashEarningsNaira = Number((coinAmount * 10).toFixed(2));
    const cashEarningsUSD = Number((coinAmount * 0.01).toFixed(4));

    const senderRef = db.collection('users').doc(verifiedSenderUid);
    const receiverRef = db.collection('users').doc(targetUserId);
    const giftRef = db.collection('gifts').doc();

    // Deterministic or client-supplied idempotency key (2-second window deduplication if no client key supplied)
    const dedupBucket = Math.floor(Date.now() / 2000);
    const effectiveIdempotencyKey = clientKey
      ? buildIdempotencyKey('gift', verifiedSenderUid, clientKey)
      : buildIdempotencyKey(
          'gift_window',
          verifiedSenderUid,
          targetUserId,
          coinAmount,
          giftName || 'Tip',
          postId || '',
          spaceId || '',
          dedupBucket
        );
    const idempotencyRef = db.collection('ledger_idempotency').doc(effectiveIdempotencyKey);

    /**
     * 2. Serializable ACID Transaction with Double-Entry Ledger
     * All reads happen FIRST before any writes.
     */
    const txResult = await db.runTransaction(async (transaction) => {
      const isSelfGift = verifiedSenderUid === targetUserId;

      // ── PHASE A: READS (Lock all documents inside the transaction) ──
      const existingIdemSnap = await transaction.get(idempotencyRef);
      if (existingIdemSnap.exists) {
        return {
          alreadyProcessed: true,
          journalId: existingIdemSnap.data()?.journalId,
        };
      }

      const senderDoc = await transaction.get(senderRef);
      const receiverDoc = isSelfGift ? senderDoc : await transaction.get(receiverRef);
      const postRef = postId && isCauseDonation ? db.collection('posts').doc(postId) : null;
      const postDoc = postRef ? await transaction.get(postRef) : null;
      const spaceRef = spaceId ? db.collection('spaces').doc(spaceId) : null;
      const spaceDoc = spaceRef ? await transaction.get(spaceRef) : null;

      // ── PHASE B: SOLVENCY & EXACT BALANCE COMPUTATION ──
      const senderData = senderDoc.data() || {};
      const receiverData = receiverDoc.data() || {};

      const senderCoinsBefore = Number(senderData.coins || 0);
      if (senderCoinsBefore < coinAmount) {
        throw new Error(`INSUFFICIENT_SOLVENCY_${senderCoinsBefore}`);
      }
      const senderCoinsAfter = senderCoinsBefore - coinAmount;

      const receiverDiamondsBefore = Number(receiverData.diamonds || 0);
      const receiverDiamondsAfter = receiverDiamondsBefore + coinAmount;

      const receiverUsdBefore = Number(receiverData.balanceUSD ?? receiverData.balance ?? 0);
      const receiverUsdAfter = Number((receiverUsdBefore + cashEarningsUSD).toFixed(4));

      const receiverNairaBefore = Number(
        receiverData.balanceNaira ?? receiverData.earningsNaira ?? 0
      );
      const receiverNairaAfter = Number((receiverNairaBefore + cashEarningsNaira).toFixed(2));

      // Badges calculation
      const senderTipsGivenBefore = Number(senderData.lifetimeTipsGiven || 0);
      const newLifetimeTipsGiven = senderTipsGivenBefore + coinAmount;
      const senderBadges: string[] = Array.isArray(senderData.badges) ? [...senderData.badges] : [];
      if (newLifetimeTipsGiven >= 1000 && !senderBadges.includes('Top Supporter')) {
        senderBadges.push('Top Supporter');
      }
      if (newLifetimeTipsGiven >= 10000 && !senderBadges.includes('Whale')) {
        senderBadges.push('Whale');
      }

      const receiverTipsReceivedBefore = Number(receiverData.lifetimeTipsReceived || 0);
      const newLifetimeTipsReceived = receiverTipsReceivedBefore + coinAmount;
      const receiverBadges: string[] = Array.isArray(receiverData.badges)
        ? [...receiverData.badges]
        : [];
      if (newLifetimeTipsReceived >= 1000 && !receiverBadges.includes('Rising Star')) {
        receiverBadges.push('Rising Star');
      }
      if (newLifetimeTipsReceived >= 10000 && !receiverBadges.includes('Top Creator')) {
        receiverBadges.push('Top Creator');
      }

      // ── PHASE C: DOUBLE-ENTRY LEDGER JOURNAL & PAIRED LEGS ──
      // Every user debit/credit is paired with a corresponding counterparty leg so Sum(Debits) == Sum(Credits)
      const legs: DoubleEntryLeg[] = [
        // 1. Coins: DEBIT Sender -> CREDIT System Conversion Treasury
        {
          accountId: verifiedSenderUid,
          accountKind: 'USER',
          asset: 'COINS',
          direction: 'DEBIT',
          amount: coinAmount,
          balanceBefore: senderCoinsBefore,
          balanceAfter: senderCoinsAfter,
        },
        {
          accountId: 'LONKIND_TREASURY_COINS',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: coinAmount,
          balanceBefore: 0,
          balanceAfter: coinAmount,
        },
        // 2. Diamonds: DEBIT System Treasury -> CREDIT Recipient Creator
        {
          accountId: 'LONKIND_TREASURY_DIAMONDS',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'DIAMONDS',
          direction: 'DEBIT',
          amount: coinAmount,
          balanceBefore: coinAmount,
          balanceAfter: 0,
        },
        {
          accountId: targetUserId,
          accountKind: 'USER',
          asset: 'DIAMONDS',
          direction: 'CREDIT',
          amount: coinAmount,
          balanceBefore: receiverDiamondsBefore,
          balanceAfter: receiverDiamondsAfter,
        },
        // 3. Withdrawable USD: DEBIT System Treasury -> CREDIT Recipient Creator
        {
          accountId: 'LONKIND_TREASURY_USD',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'CASH_USD',
          direction: 'DEBIT',
          amount: cashEarningsUSD,
          balanceBefore: cashEarningsUSD,
          balanceAfter: 0,
        },
        {
          accountId: targetUserId,
          accountKind: 'USER',
          asset: 'CASH_USD',
          direction: 'CREDIT',
          amount: cashEarningsUSD,
          balanceBefore: receiverUsdBefore,
          balanceAfter: receiverUsdAfter,
        },
        // 4. Withdrawable NGN: DEBIT System Treasury -> CREDIT Recipient Creator
        {
          accountId: 'LONKIND_TREASURY_NGN',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'CASH_NGN',
          direction: 'DEBIT',
          amount: cashEarningsNaira,
          balanceBefore: cashEarningsNaira,
          balanceAfter: 0,
        },
        {
          accountId: targetUserId,
          accountKind: 'USER',
          asset: 'CASH_NGN',
          direction: 'CREDIT',
          amount: cashEarningsNaira,
          balanceBefore: receiverNairaBefore,
          balanceAfter: receiverNairaAfter,
        },
      ];

      const { journalId } = commitDoubleEntryJournalInTx(db, transaction, {
        journalType: 'GIFT_TRANSFER',
        idempotencyKey: effectiveIdempotencyKey,
        reference: giftRef.id,
        actorUid: verifiedSenderUid,
        description: `Gift ${giftName || 'Tip'} (${coinAmount} L) from ${verifiedSenderUid} to ${targetUserId}`,
        legs,
        metadata: {
          fromUserId: verifiedSenderUid,
          toUserId: targetUserId,
          giftName: giftName || 'Tip',
          giftEmoji: giftEmoji || '🎁',
          postId: postId || null,
          spaceId: spaceId || null,
          isCauseDonation: Boolean(isCauseDonation),
        },
      });

      // ── PHASE D: WRITE EXACT COMPUTED BALANCES TO USER & GIFT DOCUMENTS ──
      transaction.set(giftRef, {
        id: giftRef.id,
        journalId,
        fromUserId: verifiedSenderUid,
        fromUserName: senderData.name || 'Unknown User',
        toUserId: targetUserId,
        toUserName: receiverData.name || 'Unknown User',
        coins: coinAmount,
        cashValueNaira: cashEarningsNaira,
        cashValueUSD: cashEarningsUSD,
        senderCoinsBefore,
        senderCoinsAfter,
        receiverDiamondsBefore,
        receiverDiamondsAfter,
        giftName: giftName || 'Tip',
        giftEmoji: giftEmoji || '🎁',
        postId: postId || null,
        isCauseDonation: isCauseDonation || false,
        time: FieldValue.serverTimestamp(),
      });

      if (isSelfGift) {
        transaction.set(
          senderRef,
          {
            coins: senderCoinsAfter,
            diamonds: receiverDiamondsAfter,
            balance: receiverUsdAfter,
            balanceUSD: receiverUsdAfter,
            earningsNaira: receiverNairaAfter,
            balanceNaira: receiverNairaAfter,
            lifetimeTipsGiven: newLifetimeTipsGiven,
            lifetimeTipsReceived: newLifetimeTipsReceived,
            badges: Array.from(new Set([...senderBadges, ...receiverBadges])),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        transaction.set(
          senderRef,
          {
            coins: senderCoinsAfter,
            lifetimeTipsGiven: newLifetimeTipsGiven,
            badges: senderBadges,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(
          receiverRef,
          {
            ...(receiverDoc.exists ? {} : { uid: targetUserId, coins: 0, createdAt: FieldValue.serverTimestamp() }),
            diamonds: receiverDiamondsAfter,
            balance: receiverUsdAfter,
            balanceUSD: receiverUsdAfter,
            earningsNaira: receiverNairaAfter,
            balanceNaira: receiverNairaAfter,
            lifetimeTipsReceived: newLifetimeTipsReceived,
            badges: receiverBadges,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (postRef && postDoc?.exists) {
        const currentRaised = Number(postDoc.data()?.raisedCoins || 0);
        transaction.update(postRef, {
          raisedCoins: currentRaised + coinAmount,
        });
      }

      if (spaceRef && spaceDoc?.exists) {
        const currentRecent = spaceDoc.data()?.recentGifts || [];
        const updatedGifts = [
          {
            id: giftRef.id,
            journalId,
            fromUserName: senderData.name || 'User',
            giftName: giftName || 'Tip',
            giftEmoji: giftEmoji || '🎁',
            coins: coinAmount,
            timestamp: new Date().toISOString(),
          },
          ...currentRecent,
        ].slice(0, 20);
        transaction.update(spaceRef, { recentGifts: updatedGifts });
      }

      return {
        alreadyProcessed: false,
        journalId,
        senderName: senderData.name || 'User',
        senderAvatar: senderData.avatarUrl || senderData.photoURL || '',
        senderCoinsAfter,
        receiverDiamondsAfter,
      };
    });

    const senderDisplayName = (txResult as any).senderName || 'User';
    const senderAvatarUrl = (txResult as any).senderAvatar || '';

    // 3. Publish into the Kafka-Style Partitioned Gift Event Broker (`lonkind.gifts.v1`)
    // Only publish if this idempotencyKey has not already been processed (prevents duplicate events on retry)
    let brokerInfo = {
      topic: 'lonkind.gifts.v1',
      partition: 0,
      offset: 0,
      comboCount: effectiveQuantity,
    };
    if (!txResult.alreadyProcessed) {
      const brokerBatch = giftEventBroker.publish(
        {
          eventId: giftRef.id,
          idempotencyKey: effectiveIdempotencyKey,
          roomId: effectiveRoomId,
          senderId: verifiedSenderUid,
          senderName: senderDisplayName,
          recipientId: targetUserId,
          giftId: (giftName || 'tip').toLowerCase().replace(/\s+/g, '_'),
          giftName: giftName || 'Tip',
          giftIcon: giftEmoji || '🎁',
          unitPrice: effectiveUnitPrice,
          quantity: effectiveQuantity,
          timestampMs: Date.now(),
        },
        'per-sender'
      );
      brokerInfo = {
        topic: 'lonkind.gifts.v1',
        partition: brokerBatch.partition,
        offset: brokerBatch.offset,
        comboCount: brokerBatch.comboCount,
      };
    }

    // 4. Update Live Stream Top Contributors Leaderboard via Redis Sorted Set (`ZINCRBY`)
    // Runs: `ZINCRBY stream:leaderboard:<roomId> <coinAmount> "<senderDisplayName>"`
    // Fetches Top 3 gifters instantly (`ZREVRANGE ... 0 2 WITHSCORES`) with zero SQL/Firestore strain.
    let leaderboardUpdate = null;
    if (!txResult.alreadyProcessed) {
      leaderboardUpdate = await redisStreamLeaderboard.zincrby(
        effectiveRoomId,
        coinAmount,
        senderDisplayName,
        {
          uid: verifiedSenderUid,
          name: senderDisplayName,
          avatarUrl: senderAvatarUrl,
          lastGiftName:
            effectiveQuantity > 1
              ? `${giftName || 'Tip'} x${effectiveQuantity}`
              : giftName || 'Tip',
          lastGiftIcon: giftEmoji || '🎁',
        }
      );
    } else {
      const snap = await redisStreamLeaderboard.getRoomLeaderboardSnapshot(
        effectiveRoomId,
        senderDisplayName,
        25
      );
      leaderboardUpdate = {
        key: snap.key,
        command: `IDEMPOTENT_SKIP (Key ${effectiveIdempotencyKey} already committed)`,
        readCommand: snap.top3Command,
        top3: snap.top3,
        topContributors: snap.topContributors,
        totalContributors: snap.totalContributors,
      };
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: txResult.alreadyProcessed,
      idempotencyKey: effectiveIdempotencyKey,
      batchedQuantity: effectiveQuantity,
      journalId: txResult.journalId,
      broker: brokerInfo,
      leaderboard: leaderboardUpdate,
      message: txResult.alreadyProcessed
        ? `Idempotent retry acknowledged (${effectiveIdempotencyKey}): no duplicate charge.`
        : `Successfully sent Combo x${effectiveQuantity} (${coinAmount} L total — ${giftName || 'Gift'} ${giftEmoji || '🎁'}). Recipient earned ₦${cashEarningsNaira.toLocaleString()} ($${cashEarningsUSD.toFixed(2)} USD).`,
    });
  } catch (error: any) {
    console.error('Error processing double-entry gift transaction:', error);
    if (error.message?.startsWith('INSUFFICIENT_SOLVENCY')) {
      return NextResponse.json(
        { error: 'Insufficient Lonkind Coins (L) balance. Please top up your wallet.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Gift processing transaction failed.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    broker: giftEventBroker.getTelemetry(),
  });
}
