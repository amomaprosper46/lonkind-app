import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

import { getFirebaseAdminServiceAccount } from '@/lib/parse-service-account';

// Initialize Firebase Admin SDK (for server-side Firestore writes)
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

    const db = getAdminDb();

    // Check if this reference was already processed (idempotency)
    const txRef = db.collection('transactions').doc(reference);
    const existing = await txRef.get();
    if (existing.exists) {
      return NextResponse.json({ success: true, message: 'Already processed', alreadyProcessed: true });
    }

    // Run as a Firestore transaction
    await db.runTransaction(async (transaction) => {
      // Create transaction record
      transaction.set(txRef, {
        userId,
        paystackReference: reference,
        amountNaira,
        coinsAdded: Number(coinAmount),
        status: 'success',
        type: 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      });

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
