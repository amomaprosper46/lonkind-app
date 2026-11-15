import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

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
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.warn(
        `[Paystack Callback] Transaction validation failed for verification token: ${reference}`
      );
      return NextResponse.redirect(
        `${APP_URL}/?view=wallet&payment=failed&reason=payment_not_successful`
      );
    }

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountNaira = verifyData.data.amount / 100;
    const numCoins = Number(coinAmount);

    if (!userId || !numCoins || numCoins <= 0) {
      console.error('Invalid payment metadata:', verifyData.data.metadata);
      return NextResponse.redirect(
        `${APP_URL}/?view=wallet&payment=error&reason=invalid_metadata`
      );
    }

    const db = adminDb;
    const txRef = db.collection('transactions').doc(reference);
    const userRef = db.collection('users').doc(userId);
    const idempotencyKey = buildIdempotencyKey('coin_purchase_paystack', reference);
    const idempotencyRef = db.collection('ledger_idempotency').doc(idempotencyKey);

    const origin = req.headers.get('origin') || req.nextUrl.origin || APP_URL;

    // 2. ACID Transaction with Double-Entry Ledger (all reads happen INSIDE transaction to prevent race conditions)
    await db.runTransaction(async (transaction) => {
      const [idemSnap, existingTxSnap, userSnap] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(txRef),
        transaction.get(userRef),
      ]);

      if (idemSnap.exists || (existingTxSnap.exists && existingTxSnap.data()?.status === 'success')) {
        return;
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
        description: `Paystack coin purchase (${numCoins} L) ref=${reference}`,
        legs,
        metadata: { gateway: 'paystack', reference, amountNaira, numCoins },
      });

      transaction.set(
        txRef,
        {
          id: reference,
          journalId,
          userId,
          paystackReference: reference,
          amount: amountNaira,
          amountNaira,
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
    });

    return NextResponse.redirect(
      `${origin}/?view=wallet&payment=success&coins=${numCoins}&amount=${amountNaira}`
    );
  } catch (error: any) {
    const origin = req.headers.get('origin') || req.nextUrl.origin || APP_URL;
    console.error('[Paystack Callback Engine Exception]:', error);
    return NextResponse.redirect(
      `${origin}/?view=wallet&payment=error&reason=processing_exception`
    );
  }
}