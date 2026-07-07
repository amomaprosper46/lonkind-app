import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

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

    const db = adminDb;
    const txRef = db.collection('transactions').doc(reference);

    const origin = req.headers.get('origin') || req.nextUrl.origin || APP_URL;

    // 2. Check if already processed
    const existing = await txRef.get();
    if (existing.exists && existing.data()?.status === 'success') {
       return NextResponse.redirect(
        `${origin}/?view=wallet&payment=success&coins=${existing.data()?.coinsAdded}&amount=${amountNaira}`
      );
    }

    // 3. Process the transaction and credit coins atomically
    await db.runTransaction(async (transaction) => {
      transaction.set(txRef, {
        id: reference,
        userId,
        paystackReference: reference,
        amount: amountNaira,
        amountNaira,
        coinsAdded: Number(coinAmount),
        status: 'success',
        type: 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      }, { merge: true });

      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        coins: FieldValue.increment(Number(coinAmount)),
      });
    });

    // 4. Redirect user back to wallet with success message
    return NextResponse.redirect(
      `${origin}/?view=wallet&payment=success&coins=${coinAmount}&amount=${amountNaira}`
    );

  } catch (error: any) {
    const origin = req.headers.get('origin') || req.nextUrl.origin || APP_URL;
    console.error('[Paystack Callback Engine Exception]:', error);
    return NextResponse.redirect(`${origin}/?view=wallet&payment=error&reason=processing_exception`);
  }
}