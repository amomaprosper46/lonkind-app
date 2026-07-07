import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    // Verify the transaction with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return NextResponse.json({ 
        error: 'Payment verification failed', 
        details: verifyData.data?.gateway_response 
      }, { status: 400 });
    }

    const { userId, coinAmount } = verifyData.data.metadata;
    const amountNaira = verifyData.data.amount / 100; // Convert from kobo

    if (!userId || !coinAmount) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const db = adminDb;

    // Check if this reference was already processed (idempotency)
    const txRef = db.collection('transactions').doc(reference);
    const existing = await txRef.get();
    if (existing.exists && existing.data()?.status === 'success') {
      return NextResponse.json({ success: true, message: 'Already processed', alreadyProcessed: true });
    }

    // Run as a Firestore transaction
    await db.runTransaction(async (transaction) => {
      // Create transaction record
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

      // Credit coins to user
      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        coins: FieldValue.increment(Number(coinAmount)),
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: `Successfully credited ${coinAmount} coins to your account!`,
      coinsAdded: Number(coinAmount),
    });

  } catch (error: any) {
    console.error('Paystack verify error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// GET handler for Paystack redirect callback
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');
  const ref = reference || trxref;

  if (!ref) {
    return NextResponse.redirect(new URL('/?payment=failed', req.url));
  }

  try {
    // Verify the payment
    const response = await fetch(`${req.nextUrl.origin}/api/paystack/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref }),
    });

    const data = await response.json();
    if (data.success) {
      return NextResponse.redirect(new URL(`/?payment=success&coins=${data.coinsAdded}`, req.url));
    } else {
      return NextResponse.redirect(new URL('/?payment=failed', req.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/?payment=failed', req.url));
  }
}
