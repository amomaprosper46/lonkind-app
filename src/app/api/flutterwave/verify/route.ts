import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY;

const CURRENCY_RATE_PER_COIN: Record<string, number> = {
  NGN: 10,
  USD: 0.01,
  GHS: 0.15,
  KES: 1.5,
  GBP: 0.008,
  EUR: 0.009,
  ZAR: 0.18,
};

export async function POST(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { reference, transaction_id } = body;

    if (!reference && !transaction_id) {
      return NextResponse.json(
        { error: 'Missing payment reference or transaction_id' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: verifyData.message || 'Transaction not successful',
        },
        { status: 400 }
      );
    }

    const txData = verifyData.data;
    const { userId, coinAmount, purpose } = txData.meta || {};
    const amountPaid = txData.amount;
    const currency = (txData.currency || 'NGN').toUpperCase();
    const txRef = String(txData.tx_ref || reference || transaction_id);

    if (!userId || !coinAmount || Number(coinAmount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const numCoins = Number(coinAmount);
    const rate = CURRENCY_RATE_PER_COIN[currency] || CURRENCY_RATE_PER_COIN['NGN'];
    const expectedMinAmount = numCoins * rate * 0.7;

    if (amountPaid < expectedMinAmount) {
      console.error(
        `[Flutterwave Verify] Fraud/tamper detected for user ${userId}. Paid ${currency} ${amountPaid}, expected minimum ${expectedMinAmount} for ${numCoins} coins.`
      );
      return NextResponse.json(
        { error: 'Payment amount does not match coins requested' },
        { status: 400 }
      );
    }

    const db = adminDb;
    const txDocRef = db.collection('transactions').doc(txRef);
    const userRef = db.collection('users').doc(userId);
    const idempotencyKey = buildIdempotencyKey('coin_purchase_flutterwave', txRef);
    const idempotencyRef = db.collection('ledger_idempotency').doc(idempotencyKey);

    const txResult = await db.runTransaction(async (transaction) => {
      const [idemSnap, existingTxSnap, userSnap] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(txDocRef),
        transaction.get(userRef),
      ]);

      if (idemSnap.exists || existingTxSnap.exists) {
        return { alreadyProcessed: true };
      }

      const coinsBefore = Number(userSnap.data()?.coins || 0);
      const coinsAfter = coinsBefore + numCoins;

      const legs: DoubleEntryLeg[] = [
        {
          accountId: 'EXTERNAL_GATEWAY_FLUTTERWAVE',
          accountKind: 'EXTERNAL_GATEWAY',
          asset: 'COINS',
          direction: 'DEBIT',
          amount: numCoins,
          balanceBefore: numCoins,
          balanceAfter: 0,
        },
        {
          accountId: userId,
          accountKind: 'USER',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: numCoins,
          balanceBefore: coinsBefore,
          balanceAfter: coinsAfter,
        },
      ];

      const { journalId } = commitDoubleEntryJournalInTx(db, transaction, {
        journalType: 'COIN_PURCHASE',
        idempotencyKey,
        reference: txRef,
        actorUid: userId,
        description: `Flutterwave verified coin purchase (${numCoins} L) ref=${txRef}`,
        legs,
        metadata: {
          gateway: 'flutterwave',
          reference: txRef,
          flwTransactionId: txData.id,
          amountPaid,
          currency,
          numCoins,
        },
      });

      transaction.set(
        txDocRef,
        {
          id: txRef,
          journalId,
          userId,
          flutterwaveReference: txRef,
          flwTransactionId: txData.id,
          amount: amountPaid,
          currency: currency || 'NGN',
          coinsAdded: numCoins,
          coinsBefore,
          coinsAfter,
          status: 'success',
          type: purpose || 'coin_purchase',
          time: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        userRef,
        {
          coins: coinsAfter,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { alreadyProcessed: false, journalId };
    });

    if (txResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        alreadyProcessed: true,
        coinsAdded: numCoins,
      });
    }

    return NextResponse.json({
      success: true,
      journalId: txResult.journalId,
      message: `Successfully credited ${numCoins} coins to your account!`,
      coinsAdded: numCoins,
    });
  } catch (error: any) {
    console.error('Flutterwave verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
