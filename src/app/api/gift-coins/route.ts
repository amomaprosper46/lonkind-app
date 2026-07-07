import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const COIN_TO_DIAMOND_CONVERSION_RATE = 1; // 1 Coin = 1 Diamond

const InputSchema = z.object({
  toUserId: z.string().trim().min(1, 'Recipient target UID required.'),
  coinAmount: z.number().int().positive('Gift quantity must be a positive integer.'),
  giftName: z.string().optional(),
  giftEmoji: z.string().optional(),
  spaceId: z.string().optional(),
  postId: z.string().optional(),
  isCauseDonation: z.boolean().optional(),
});

/**
 * POST: Authenticated, High-Security Ledger Gifting Engine
 */
export async function POST(req: NextRequest) {
  try {
    const db = adminDb;

    // 1. Enforce Decryption of the Firebase Authentication ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthenticated. Security token signature missing.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let verifiedSenderUid: string;

    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      verifiedSenderUid = decodedToken.uid; // Securely lock identity using cryptographically extracted server token data
    } catch (authError) {
      return NextResponse.json({ error: 'Unauthorized credentials verification rejected.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload compilation.', details: parsed.error.issues }, { status: 400 });
    }

    const { toUserId, coinAmount, giftName, giftEmoji, spaceId, postId, isCauseDonation } = parsed.data;

    // Prevent Self-Gifting Loops
    if (verifiedSenderUid === toUserId) {
      return NextResponse.json({ error: 'Transaction aborted. You cannot gift yourself.' }, { status: 400 });
    }

    const diamondValue = Math.floor(coinAmount * COIN_TO_DIAMOND_CONVERSION_RATE);
    const senderRef = db.collection('users').doc(verifiedSenderUid);
    const receiverRef = db.collection('users').doc(toUserId);

    /**
     * 2. ACID Transaction Settlement Thread
     * Validates balance constraints and processes state transformations atomically on the server.
     */
    await db.runTransaction(async (transaction) => {
      const [senderDoc, receiverDoc] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(receiverRef),
      ]);

      if (!senderDoc.exists) throw new Error('SENDER_NOT_FOUND');
      if (!receiverDoc.exists) throw new Error('RECIPIENT_NOT_FOUND');

      const senderCoins = senderDoc.data()?.coins || 0;
      if (senderCoins < coinAmount) {
        throw new Error(`INSUFFICIENT_SOLVENCY_${senderCoins}`);
      }

      // Calculate milestone badges for sender
      const newLifetimeTipsGiven = (senderDoc.data()?.lifetimeTipsGiven || 0) + coinAmount;
      let senderBadges: string[] = senderDoc.data()?.badges || [];
      if (newLifetimeTipsGiven >= 1000 && !senderBadges.includes('Top Supporter')) {
        senderBadges.push('Top Supporter');
      }
      if (newLifetimeTipsGiven >= 10000 && !senderBadges.includes('Whale')) {
        senderBadges.push('Whale');
      }

      // Calculate milestone badges for receiver
      const newLifetimeTipsReceived = (receiverDoc.data()?.lifetimeTipsReceived || 0) + coinAmount;
      let receiverBadges: string[] = receiverDoc.data()?.badges || [];
      if (newLifetimeTipsReceived >= 1000 && !receiverBadges.includes('Rising Star')) {
        receiverBadges.push('Rising Star');
      }
      if (newLifetimeTipsReceived >= 10000 && !receiverBadges.includes('Top Creator')) {
        receiverBadges.push('Top Creator');
      }

      // A. Register Audit Ledger Document Entry in 'gifts' collection
      const giftRef = db.collection('gifts').doc();
      transaction.set(giftRef, {
        fromUserId: verifiedSenderUid,
        fromUserName: senderDoc.data()?.name || 'Unknown User',
        toUserId,
        toUserName: receiverDoc.data()?.name || 'Unknown User',
        coins: coinAmount,
        diamonds: diamondValue,
        giftName: giftName || 'Tip',
        giftEmoji: giftEmoji || '🎁',
        postId: postId || null,
        isCauseDonation: isCauseDonation || false,
        time: FieldValue.serverTimestamp(),
      });

      // B. Deduct virtual coins from verified sender identity
      transaction.update(senderRef, {
        coins: FieldValue.increment(-coinAmount),
        lifetimeTipsGiven: FieldValue.increment(coinAmount),
        badges: senderBadges,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // C. Credit diamond balance to recipient creator
      transaction.update(receiverRef, {
        diamonds: FieldValue.increment(diamondValue),
        lifetimeTipsReceived: FieldValue.increment(coinAmount),
        badges: receiverBadges,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // D. If this is a donation to a Lonkind Cause post, increment raisedCoins atomically
      if (postId && isCauseDonation) {
        const postRef = db.collection('posts').doc(postId);
        transaction.update(postRef, {
          raisedCoins: FieldValue.increment(coinAmount),
        });
      }

      // D. Update Live Space recentGifts stream feed if applicable
      if (spaceId) {
        const spaceRef = db.collection('spaces').doc(spaceId);
        const spaceDoc = await transaction.get(spaceRef);
        if (spaceDoc.exists) {
          const newGift = {
            senderName: senderDoc.data()?.name || 'Someone',
            giftName: giftName || 'Tip',
            giftEmoji: giftEmoji || '🎁',
            timestamp: Date.now(),
            id: Math.random().toString(36).substring(7),
          };
          const currentGifts = spaceDoc.data()?.recentGifts || [];
          const updatedGifts = [...currentGifts, newGift].slice(-10);
          transaction.update(spaceRef, { recentGifts: updatedGifts });
        }
      }

      // E. Issue Real-Time Transaction Notification Record
      const notifRef = receiverRef.collection('notifications').doc();
      transaction.set(notifRef, {
        type: 'new_gift',
        fromUser: { uid: verifiedSenderUid, name: senderDoc.data()?.name || 'Someone' },
        coinAmount,
        diamondsEarned: diamondValue,
        giftName: giftName || 'Tip',
        giftEmoji: giftEmoji || '🎁',
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Tip sent! The creator earned ${diamondValue.toLocaleString()} diamonds.`,
      diamondsEarned: diamondValue,
    });

  } catch (error: any) {
    console.error('Critical currency processing exception:', error);

    if (error.message === 'SENDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Origin profile context validation failed.' }, { status: 404 });
    }
    if (error.message === 'RECIPIENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Recipient location mapping failed.' }, { status: 404 });
    }
    if (error.message.startsWith('INSUFFICIENT_SOLVENCY')) {
      const balance = error.message.split('_')[2];
      return NextResponse.json({ error: `Insufficient coins. Your wallet balance is currently ${balance} units.` }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'An unexpected internal ledger exception occurred.' }, { status: 500 });
  }
}