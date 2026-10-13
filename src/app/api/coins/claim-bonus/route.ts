import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const BONUS_COINS = 500;
    const db = adminDb;
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const currentCoins = userDoc.exists ? (userDoc.data()?.coins || 0) : 0;

      // Allow claim if balance is low (< 1000 coins)
      if (currentCoins >= 100000) {
        throw new Error('You already have ample coins.');
      }

      transaction.set(userRef, {
        coins: FieldValue.increment(BONUS_COINS),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Record transaction
      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId: uid,
        coinsAdded: BONUS_COINS,
        amount: 0,
        amountNaira: 0,
        currency: 'NGN',
        status: 'success',
        type: 'test_welcome_bonus',
        time: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Claimed ${BONUS_COINS} Lonkind Coins! Start gifting and streaming now.`,
      coinsAdded: BONUS_COINS,
    });
  } catch (error: any) {
    console.error('Error claiming bonus coins:', error);
    return NextResponse.json({ error: error.message || 'Failed to claim coins' }, { status: 400 });
  }
}
