import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

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
      console.error("Firebase Admin initialization error:", e);
      initializeApp({ projectId: 'impactful-ideas' });
    }
  }
  return getFirestore();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=failed&reason=no_reference`);
  }

  try {
    // 1. Verify payment directly with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { 
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.warn(`[Paystack Callback] Transaction validation failed for verification token: ${reference}`);
      return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=failed&reason=payment_not_successful`);
    }

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountNaira = verifyData.data.amount / 100;

    if (!userId || !coinAmount) {
      console.error('Invalid payment metadata:', verifyData.data.metadata);
      return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=error&reason=invalid_metadata`);
    }

    const db = getAdminDb();
    const txRef = db.collection('transactions').doc(reference);

    // 2. Check if already processed
    const existing = await txRef.get();
    if (existing.exists) {
       return NextResponse.redirect(
        `${APP_URL}/?view=wallet&payment=success&coins=${existing.data()?.coinsAdded}&amount=${amountNaira}`
      );
    }

    // 3. Process the transaction and credit coins atomically
    await db.runTransaction(async (transaction) => {
      transaction.set(txRef, {
        userId,
        paystackReference: reference,
        amountNaira,
        coinsAdded: Number(coinAmount),
        status: 'success',
        type: 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      });

      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        coins: FieldValue.increment(Number(coinAmount)),
      });
    });

    // 4. Redirect user back to wallet with success message
    return NextResponse.redirect(
      `${APP_URL}/?view=wallet&payment=success&coins=${coinAmount}&amount=${amountNaira}`
    );

  } catch (error: any) {
    console.error('[Paystack Callback Engine Exception]:', error);
    return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=error&reason=processing_exception`);
  }
}