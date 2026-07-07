import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const InputSchema = z.object({
  postId: z.string().trim().min(1, 'Post ID required.'),
});

/**
 * POST: Authenticated, High-Security VIP Post Unlock Engine
 */
export async function POST(req: NextRequest) {
  try {
    const db = adminDb;

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
      return NextResponse.json({ error: 'Invalid payload.', details: parsed.error.issues }, { status: 400 });
    }

    const { postId } = parsed.data;

    const postRef = db.collection('posts').doc(postId);
    const senderRef = db.collection('users').doc(verifiedSenderUid);

    await db.runTransaction(async (transaction) => {
      const [postDoc, senderDoc] = await Promise.all([
        transaction.get(postRef),
        transaction.get(senderRef),
      ]);

      if (!postDoc.exists) throw new Error('POST_NOT_FOUND');
      if (!senderDoc.exists) throw new Error('SENDER_NOT_FOUND');

      const postData = postDoc.data();
      if (!postData?.isVipOnly) {
        throw new Error('POST_NOT_VIP');
      }

      const unlockedBy: string[] = postData?.unlockedBy || [];
      if (unlockedBy.includes(verifiedSenderUid) || postData?.author?.uid === verifiedSenderUid) {
        // Already unlocked or author
        return;
      }

      const unlockCoins = postData?.unlockCoins || 50;
      const senderCoins = senderDoc.data()?.coins || 0;
      if (senderCoins < unlockCoins) {
        throw new Error(`INSUFFICIENT_SOLVENCY_${senderCoins}`);
      }

      const authorUid = postData?.author?.uid;
      const authorRef = db.collection('users').doc(authorUid);
      const authorDoc = await transaction.get(authorRef);

      // Deduct coins from sender
      transaction.update(senderRef, {
        coins: FieldValue.increment(-unlockCoins),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Credit diamonds to author (1 Coin = 1 Diamond)
      if (authorDoc.exists) {
        transaction.update(authorRef, {
          diamonds: FieldValue.increment(unlockCoins),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Notify author
        const notifRef = authorRef.collection('notifications').doc();
        transaction.set(notifRef, {
          type: 'vip_unlock',
          fromUser: { uid: verifiedSenderUid, name: senderDoc.data()?.name || 'Someone' },
          coinAmount: unlockCoins,
          diamondsEarned: unlockCoins,
          postId,
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
      }

      // Unlock post for user
      transaction.update(postRef, {
        unlockedBy: FieldValue.arrayUnion(verifiedSenderUid),
      });

      // Log in gifts/audit collection
      const giftRef = db.collection('gifts').doc();
      transaction.set(giftRef, {
        fromUserId: verifiedSenderUid,
        fromUserName: senderDoc.data()?.name || 'Unknown User',
        toUserId: authorUid,
        toUserName: authorDoc.data()?.name || 'Creator',
        coins: unlockCoins,
        diamonds: unlockCoins,
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
      return NextResponse.json({ error: `Insufficient coins. You have ${balance} coins. Please buy more from your wallet.` }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'An error occurred while unlocking.' }, { status: 500 });
  }
}
