import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const NAIRA_PER_COIN = 20;     // ₦20 per coin
const PLATFORM_FEE = 0;        // 0% platform split fee config

import { getFirebaseAdminServiceAccount } from '@/lib/parse-service-account';

function getAdminDb() {
  if (!getApps().length) {
    try {
      const sa = getFirebaseAdminServiceAccount();
      if (sa) {
        initializeApp({ credential: cert(sa) });
      } else {
        initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'impactful-ideas' });
      }
    } catch (e) {
      console.error("Firebase Admin initialization fallback error:", e);
      initializeApp({ projectId: 'impactful-ideas' });
    }
  }
  return getFirestore();
}

// 1. Removed fromUserId from schema to completely eliminate client-side parameter injection vectors
const InputSchema = z.object({
  toUserId: z.string().trim().min(1, 'Recipient target UID required.'),
  coinAmount: z.number().int().positive('Gift quantity must be a positive integer.'),
});

/**
 * POST: Authenticated, High-Security Ledger Gifting Engine
 */
export async function POST(req: NextRequest) {
  try {
    const db = getAdminDb();

    // 2. Enforce Decryption of the Firebase Authentication ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthenticated. Security token signature missing.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let verifiedSenderUid: string;

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      verifiedSenderUid = decodedToken.uid; // Securely lock identity using cryptographically extracted server token data
    } catch (authError) {
      return NextResponse.json({ error: 'Unauthorized credentials verification rejected.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload compilation.', details: parsed.error.issues }, { status: 400 });
    }

    const { toUserId, coinAmount } = parsed.data;

    // Prevent Self-Gifting Loops
    if (verifiedSenderUid === toUserId) {
      return NextResponse.json({ error: 'Transaction aborted. You cannot gift yourself.' }, { status: 400 });
    }

    // Economy Ledger Mapping calculations
    const rawNairaValue = coinAmount * NAIRA_PER_COIN;
    const platformCut = Math.floor(rawNairaValue * PLATFORM_FEE);
    const creatorEarnings = rawNairaValue - platformCut;

    const senderRef = db.collection('users').doc(verifiedSenderUid);
    const receiverRef = db.collection('users').doc(toUserId);

    /**
     * 3. ACID Transaction Settlement Thread
     * Validates balance constraints and processes state transformations atomically.
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

      // A. Register Audit Ledger Document Entry
      const giftRef = db.collection('gifts').doc();
      transaction.set(giftRef, {
        fromUser: verifiedSenderUid,
        toUser: toUserId,
        coinAmount,
        nairaValue: rawNairaValue,
        platformCut,
        creatorEarnings,
        time: FieldValue.serverTimestamp(),
      });

      // B. Deduct virtual currencies from verified source identity profile
      transaction.update(senderRef, {
        coins: FieldValue.increment(-coinAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // C. Credits hard-currency fiat value balances into creator withdrawal accounts
      transaction.update(receiverRef, {
        earningsNaira: FieldValue.increment(creatorEarnings),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // D. Issue Real-Time Transaction Alert Records
      const notifRef = receiverRef.collection('notifications').doc();
      transaction.set(notifRef, {
        type: 'new_gift',
        fromUser: { uid: verifiedSenderUid },
        coinAmount,
        nairaEarned: creatorEarnings,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Gift sent! The creator earned ₦${creatorEarnings.toLocaleString()} in real earnings.`,
      creatorEarnings,
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

    return NextResponse.json({ error: 'An unexpected internal ledger exception occurred.' }, { status: 500 });
  }
}