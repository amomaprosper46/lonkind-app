import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { reference, transaction_id } = body;

    if (!reference && !transaction_id) {
      return NextResponse.json({ error: 'Missing payment reference or transaction_id' }, { status: 400 });
    }

    // Verify the transaction with Flutterwave API v3
    let verifyUrl = '';
    if (transaction_id) {
      verifyUrl = `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`;
    } else {
      verifyUrl = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
    }

    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      return NextResponse.json({ 
        error: 'Payment verification failed', 
        details: verifyData.message || 'Transaction not successful' 
      }, { status: 400 });
    }

    const txData = verifyData.data;
    const { userId, coinAmount, purpose } = txData.meta || {};
    const amountPaid = txData.amount;
    const currency = txData.currency;
    const txRef = txData.tx_ref || reference;

    if (!userId || !coinAmount) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const db = adminDb;

    // Check if this reference was already processed (idempotency)
    const txDocRef = db.collection('transactions').doc(txRef);
    const existing = await txDocRef.get();
    if (existing.exists) {
      return NextResponse.json({ success: true, message: 'Already processed', alreadyProcessed: true, coinsAdded: Number(coinAmount) });
    }

    // Run as an atomic Firestore transaction
    await db.runTransaction(async (transaction) => {
      // Create transaction record
      transaction.set(txDocRef, {
        userId,
        flutterwaveReference: txRef,
        flwTransactionId: txData.id,
        amount: amountPaid,
        currency: currency || 'NGN',
        coinsAdded: Number(coinAmount),
        status: 'success',
        type: purpose || 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      });

      // Credit coins to user profile
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
    console.error('Flutterwave verify error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
