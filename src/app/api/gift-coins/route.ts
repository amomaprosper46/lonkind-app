import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

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
 * Directly credits the creator's Lonkind Account Balance (withdrawable cash).
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
      verifiedSenderUid = decodedToken.uid;
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

    // 1 Lonkind Coin (L) = ₦10 Naira (or $0.01 USD equivalent)
    const cashEarningsNaira = coinAmount * 10; 
    const cashEarningsUSD = coinAmount * 0.01; 

    const senderRef = db.collection('users').doc(verifiedSenderUid);
    const receiverRef = db.collection('users').doc(toUserId);

    /**
     * 2. ACID Transaction Settlement Thread
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

      // Sender Badges
      const newLifetimeTipsGiven = (senderDoc.data()?.lifetimeTipsGiven || 0) + coinAmount;
      let senderBadges: string[] = senderDoc.data()?.badges || [];
      if (newLifetimeTipsGiven >= 1000 && !senderBadges.includes('Top Supporter')) {
        senderBadges.push('Top Supporter');
      }
      if (newLifetimeTipsGiven >= 10000 && !senderBadges.includes('Whale')) {
        senderBadges.push('Whale');
      }

      // Receiver Badges
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
        cashValueNaira: cashEarningsNaira,
        cashValueUSD: cashEarningsUSD,
        giftName: giftName || 'Tip',
        giftEmoji: giftEmoji || '🎁',
        postId: postId || null,
        isCauseDonation: isCauseDonation || false,
        time: FieldValue.serverTimestamp(),
      });

      // B. Deduct virtual Lonkind coins (L) from sender
      transaction.update(senderRef, {
        coins: FieldValue.increment(-coinAmount),
        lifetimeTipsGiven: FieldValue.increment(coinAmount),
        badges: senderBadges,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // C. Credit REAL WITHDRAWABLE BALANCE directly to recipient creator account
      transaction.update(receiverRef, {
        balance: FieldValue.increment(cashEarningsUSD),
        earningsNaira: FieldValue.increment(cashEarningsNaira),
        diamonds: FieldValue.increment(coinAmount), // synced for legacy counter
        lifetimeTipsReceived: FieldValue.increment(coinAmount),
        badges: receiverBadges,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // D. If donation to Cause post, update raisedCoins
      if (postId && isCauseDonation) {
        const postRef = db.collection('posts').doc(postId);
        transaction.update(postRef, {
          raisedCoins: FieldValue.increment(coinAmount),
        });
      }

      // E. Update Live Space recentGifts stream feed if applicable
      if (spaceId) {
        const spaceRef = db.collection('spaces').doc(spaceId);
        const spaceDoc = await transaction.get(spaceRef);
        if (spaceDoc.exists) {
          const currentRecent = spaceDoc.data()?.recentGifts || [];
          const updatedGifts = [
            {
              id: giftRef.id,
              fromUserName: senderDoc.data()?.name || 'User',
              giftName: giftName || 'Tip',
              giftEmoji: giftEmoji || '🎁',
              coins: coinAmount,
              timestamp: new Date().toISOString(),
            },
            ...currentRecent,
          ].slice(0, 20);
          transaction.update(spaceRef, { recentGifts: updatedGifts });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${coinAmount} Lonkind Coins (L) (${giftName || 'Gift'} ${giftEmoji || '🎁'}). Recipient earned ₦${cashEarningsNaira.toLocaleString()} ($${cashEarningsUSD.toFixed(2)} USD).`,
    });
  } catch (error: any) {
    console.error('Error processing gift transaction:', error);
    if (error.message?.startsWith('INSUFFICIENT_SOLVENCY')) {
      return NextResponse.json({ error: 'Insufficient Lonkind Coins (L) balance. Please top up your wallet.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Gift processing transaction failed.' }, { status: 500 });
  }
}
