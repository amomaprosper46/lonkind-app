import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') || req.nextUrl.origin || APP_URL;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  if (status !== 'successful' && status !== 'completed') {
    return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=${encodeURIComponent(status || 'cancelled')}`);
  }

  if (!txRef && !transactionId) {
    return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=no_reference`);
  }

  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      console.error('[Flutterwave Callback Error]: FLW_SECRET_KEY missing');
      return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=gateway_offline`);
    }

    // Direct verification with Flutterwave API v3 (No loopback HTTP fetch)
    let verifyUrl = '';
    if (transactionId) {
      verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
    } else {
      verifyUrl = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef!)}`;
    }

    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      console.warn('[Flutterwave Callback Verification Failure]:', verifyData.message);
      return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=verification_failed`);
    }

    const txData = verifyData.data;
    const { userId, coinAmount, purpose } = txData.meta || {};
    const amountPaid = txData.amount;
    const currency = txData.currency || 'NGN';
    const referenceId = txData.tx_ref || txRef || transactionId;

    if (!userId || !coinAmount) {
      console.error('[Flutterwave Callback Missing Metadata]:', txData.meta);
      return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=invalid_metadata`);
    }

    const db = adminDb;
    const txDocRef = db.collection('transactions').doc(referenceId);

    // Check if this reference was already processed (Idempotency check)
    const existing = await txDocRef.get();
    if (existing.exists && existing.data()?.status === 'success') {
      return NextResponse.redirect(
        `${origin}/?view=wallet&payment=success&coins=${existing.data()?.coinsAdded || coinAmount}`
      );
    }

    // Run as an atomic Firestore transaction to credit coins instantly
    await db.runTransaction(async (transaction) => {
      transaction.set(txDocRef, {
        userId,
        flutterwaveReference: referenceId,
        flwTransactionId: txData.id,
        amount: amountPaid,
        currency,
        coinsAdded: Number(coinAmount),
        status: 'success',
        type: purpose || 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      });

      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        coins: FieldValue.increment(Number(coinAmount)),
      });
    });

    console.log(`[Flutterwave Callback Success]: Credited ${coinAmount} coins to user ${userId}`);

    return NextResponse.redirect(
      `${origin}/?view=wallet&payment=success&coins=${coinAmount}`
    );

  } catch (error: any) {
    console.error('[Flutterwave Callback Exception]:', error);
    return NextResponse.redirect(`${origin}/?view=wallet&payment=error&reason=processing_exception`);
  }
}
