import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const CURRENCY_RATE_PER_COIN: Record<string, number> = {
  'NGN': 10,
  'USD': 0.01,
  'GHS': 0.15,
  'KES': 1.50,
  'GBP': 0.008,
  'EUR': 0.009,
  'ZAR': 0.18,
};

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

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountPaid = verifyData.data.amount / 100; // Convert from kobo/sub-units
    const currency = (verifyData.data.currency || 'NGN').toUpperCase();

    if (!userId || !coinAmount || Number(coinAmount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const numCoins = Number(coinAmount);
    const rate = CURRENCY_RATE_PER_COIN[currency] || CURRENCY_RATE_PER_COIN['NGN'];
    const expectedMinAmount = (numCoins * rate) * 0.7; // Allow up to 30% bundle discount

    // Independent price-to-coin integrity check
    if (amountPaid < expectedMinAmount) {
      console.error(`[Paystack Verify] Fraud/tamper detected for user ${userId}. Paid ${currency} ${amountPaid}, expected minimum ${expectedMinAmount} for ${numCoins} coins.`);
      return NextResponse.json({ error: 'Payment amount does not match coins requested' }, { status: 400 });
    }

    const db = adminDb;

    // Check if this reference was already processed (idempotency)
    const txRef = db.collection('transactions').doc(reference);
    const existing = await txRef.get();
    if (existing.exists && existing.data()?.status === 'success') {
      return NextResponse.json({ success: true, message: 'Already processed', alreadyProcessed: true });
    }

    const amountNaira = currency === 'NGN' ? amountPaid : (amountPaid / (rate || 1)) * 10;

    // Run as a Firestore transaction
    await db.runTransaction(async (transaction) => {
      // Create transaction record
      transaction.set(txRef, {
        id: reference,
        userId,
        paystackReference: reference,
        amount: amountPaid,
        amountNaira,
        currency,
        coinsAdded: numCoins,
        status: 'success',
        type: 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Credit coins to user
      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        coins: FieldValue.increment(numCoins),
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
