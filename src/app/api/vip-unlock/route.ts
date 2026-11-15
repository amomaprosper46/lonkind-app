import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

const InputSchema = z.object({
  postId: z.string().trim().min(1, 'Post ID required.'),
});

/**
 * POST: Authenticated, ACID Double-Entry Ledger VIP Post Unlock Engine
 */
export async function POST(req: NextRequest) {
  try {
    const db = adminDb;

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
        { error: 'Invalid payload.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { postId } = parsed.data;

    const postRef = db.collection('posts').doc(postId);
    const senderRef = db.collection('users').doc(verifiedSenderUid);
    const idempotencyKey = buildIdempotencyKey('vip_unlock', verifiedSenderUid, postId);
    const idempotencyRef = db.collection('ledger_idempotency').doc(idempotencyKey);

    await db.runTransaction(async (transaction) => {
      // ── PHASE A: READS (All reads inside transaction before any writes) ──
      const [idemSnap, postDoc, senderDoc] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(postRef),
        transaction.get(senderRef),
      ]);

      if (idemSnap.exists) return;
      if (!postDoc.exists) throw new Error('POST_NOT_FOUND');
      if (!senderDoc.exists) throw new Error('SENDER_NOT_FOUND');

      const postData = postDoc.data();
      if (!postData?.isVipOnly) {
        throw new Error('POST_NOT_VIP');
      }

      const unlockedBy: string[] = postData?.unlockedBy || [];
      if (unlockedBy.includes(verifiedSenderUid) || postData?.author?.uid === verifiedSenderUid) {
        return;
      }

      const unlockCoins = Number(postData?.unlockCoins || 50);
      const senderData = senderDoc.data() || {};
      const senderCoinsBefore = Number(senderData.coins || 0);
      if (senderCoinsBefore < unlockCoins) {
        throw new Error(`INSUFFICIENT_SOLVENCY_${senderCoinsBefore}`);
      }
      const senderCoinsAfter = senderCoinsBefore - unlockCoins;

      const authorUid = postData?.author?.uid;
      const authorRef = db.collection('users').doc(authorUid);
      const authorDoc = await transaction.get(authorRef);
      const authorData = authorDoc.data() || {};
      const authorDiamondsBefore = Number(authorData.diamonds || 0);
      const authorDiamondsAfter = authorDiamondsBefore + unlockCoins;

      // ── PHASE B: DOUBLE-ENTRY LEDGER JOURNAL ──
      const giftRef = db.collection('gifts').doc();
      const legs: DoubleEntryLeg[] = [
        {
          accountId: verifiedSenderUid,
          accountKind: 'USER',
          asset: 'COINS',
          direction: 'DEBIT',
          amount: unlockCoins,
          balanceBefore: senderCoinsBefore,
          balanceAfter: senderCoinsAfter,
        },
        {
          accountId: 'LONKIND_TREASURY_COINS',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: unlockCoins,
          balanceBefore: 0,
          balanceAfter: unlockCoins,
        },
        {
          accountId: 'LONKIND_TREASURY_DIAMONDS',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'DIAMONDS',
          direction: 'DEBIT',
          amount: unlockCoins,
          balanceBefore: unlockCoins,
          balanceAfter: 0,
        },
        {
          accountId: authorUid,
          accountKind: 'USER',
          asset: 'DIAMONDS',
          direction: 'CREDIT',
          amount: unlockCoins,
          balanceBefore: authorDiamondsBefore,
          balanceAfter: authorDiamondsAfter,
        },
      ];

      const { journalId } = commitDoubleEntryJournalInTx(db, transaction, {
        journalType: 'VIP_POST_UNLOCK',
        idempotencyKey,
        reference: giftRef.id,
        actorUid: verifiedSenderUid,
        description: `VIP Post Unlock (${postId}) by ${verifiedSenderUid} for ${unlockCoins} L`,
        legs,
        metadata: { postId, authorUid, unlockCoins },
      });

      // ── PHASE C: WRITE EXACT COMPUTED BALANCES ──
      transaction.update(senderRef, {
        coins: senderCoinsAfter,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (authorDoc.exists) {
        transaction.update(authorRef, {
          diamonds: authorDiamondsAfter,
          updatedAt: FieldValue.serverTimestamp(),
        });

        const notifRef = authorRef.collection('notifications').doc();
        transaction.set(notifRef, {
          type: 'vip_unlock',
          fromUser: { uid: verifiedSenderUid, name: senderData.name || 'Someone' },
          coinAmount: unlockCoins,
          diamondsEarned: unlockCoins,
          postId,
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
      }

      transaction.update(postRef, {
        unlockedBy: FieldValue.arrayUnion(verifiedSenderUid),
      });

      transaction.set(giftRef, {
        id: giftRef.id,
        journalId,
        fromUserId: verifiedSenderUid,
        fromUserName: senderData.name || 'Unknown User',
        toUserId: authorUid,
        toUserName: authorData.name || 'Creator',
        coins: unlockCoins,
        diamonds: unlockCoins,
        senderCoinsBefore,
        senderCoinsAfter,
        receiverDiamondsBefore: authorDiamondsBefore,
        receiverDiamondsAfter: authorDiamondsAfter,
        giftName: 'VIP Post Unlock 🔓',
        giftEmoji: '🔓',
        postId,
        time: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: 'VIP Post unlocked successfully!',
    });
  } catch (error: any) {
    console.error('VIP Unlock exception:', error);

    if (error.message === 'POST_NOT_FOUND') {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    if (error.message === 'POST_NOT_VIP') {
      return NextResponse.json({ error: 'This post is already public.' }, { status: 400 });
    }
    if (error.message.startsWith('INSUFFICIENT_SOLVENCY')) {
      const balance = error.message.split('_')[2];
      return NextResponse.json(
        { error: `Insufficient coins. You have ${balance} coins. Please buy more from your wallet.` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'An error occurred while unlocking.' },
      { status: 500 }
    );
  }
}
