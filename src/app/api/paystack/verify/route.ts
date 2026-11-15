import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    // Verify the transaction with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: verifyData.data?.gateway_response,
        },
        { status: 400 }
      );
    }

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountPaid = verifyData.data.amount / 100;
    const currency = (verifyData.data.currency || 'NGN').toUpperCase();

    if (!userId || !coinAmount || Number(coinAmount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const numCoins = Number(coinAmount);
    const rate = CURRENCY_RATE_PER_COIN[currency] || CURRENCY_RATE_PER_COIN['NGN'];
    const expectedMinAmount = numCoins * rate * 0.7;

    if (amountPaid < expectedMinAmount) {
      console.error(
        `[Paystack Verify] Fraud/tamper detected for user ${userId}. Paid ${currency} ${amountPaid}, expected minimum ${expectedMinAmount} for ${numCoins} coins.`
      );
      return NextResponse.json(
        { error: 'Payment amount does not match coins requested' },
        { status: 400 }
      );
    }

    const db = adminDb;
    const txRef = db.collection('transactions').doc(reference);
    const userRef = db.collection('users').doc(userId);
    const idempotencyKey = buildIdempotencyKey('coin_purchase_paystack', reference);
    const idempotencyRef = db.collection('ledger_idempotency').doc(idempotencyKey);
    const amountNaira = currency === 'NGN' ? amountPaid : (amountPaid / (rate || 1)) * 10;

    // ACID Transaction with Double-Entry Ledger (all reads inside transaction)
    const txResult = await db.runTransaction(async (transaction) => {
      const [idemSnap, existingTxSnap, userSnap] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(txRef),
        transaction.get(userRef),
      ]);

      if (idemSnap.exists || (existingTxSnap.exists && existingTxSnap.data()?.status === 'success')) {
        return { alreadyProcessed: true };
      }

      const coinsBefore = Number(userSnap.data()?.coins || 0);
      const coinsAfter = coinsBefore + numCoins;

      const legs: DoubleEntryLeg[] = [
        {
          accountId: 'EXTERNAL_GATEWAY_PAYSTACK',
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
        reference,
        actorUid: userId,
        description: `Paystack verified coin purchase (${numCoins} L) ref=${reference}`,
        legs,
        metadata: { gateway: 'paystack', reference, amountPaid, currency, numCoins },
      });

      transaction.set(
        txRef,
        {
          id: reference,
          journalId,
          userId,
          paystackReference: reference,
          amount: amountPaid,
          amountNaira,
          currency,
          coinsAdded: numCoins,
          coinsBefore,
          coinsAfter,
          status: 'success',
          type: 'coin_purchase',
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
    console.error('Paystack verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');
  const ref = reference || trxref;

  if (!ref) {
    return NextResponse.redirect(new URL('/?payment=failed', req.url));
  }

  try {
    const response = await fetch(`${req.nextUrl.origin}/api/paystack/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref }),
    });

    const data = await response.json();
    if (data.success) {
      return NextResponse.redirect(
        new URL(`/?payment=success&coins=${data.coinsAdded}`, req.url)
      );
    } else {
      return NextResponse.redirect(new URL('/?payment=failed', req.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/?payment=failed', req.url));
  }
}
