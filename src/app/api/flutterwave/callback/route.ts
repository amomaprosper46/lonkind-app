import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

function getPublicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';

  if (host && !host.includes('0.0.0.0')) {
    return `${proto}://${host}`;
  }

  const origin = req.nextUrl.origin;
  if (origin && !origin.includes('0.0.0.0')) {
    return origin;
  }

  return APP_URL;
}

export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  if (status !== 'successful' && status !== 'completed') {
    return NextResponse.redirect(
      `${origin}/?view=wallet&payment=failed&reason=${encodeURIComponent(status || 'cancelled')}`
    );
  }

  if (!txRef && !transactionId) {
    return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=no_reference`);
  }

  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      console.error('[Flutterwave Callback Error]: FLW_SECRET_KEY missing');
      return NextResponse.redirect(`${origin}/?view=wallet&payment=failed&reason=gateway_offline`);
    }

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
      return NextResponse.redirect(
        `${origin}/?view=wallet&payment=failed&reason=verification_failed`
      );
    }

    const txData = verifyData.data;
    const { userId, coinAmount, purpose } = txData.meta || {};
    const amountPaid = txData.amount;
    const currency = txData.currency || 'NGN';
    const referenceId = String(txData.tx_ref || txRef || transactionId);
    const numCoins = Number(coinAmount);

    if (!userId || !numCoins || numCoins <= 0) {
      console.error('[Flutterwave Callback Missing Metadata]:', txData.meta);
      return NextResponse.redirect(
        `${origin}/?view=wallet&payment=failed&reason=invalid_metadata`
      );
    }

    const db = adminDb;
    const txDocRef = db.collection('transactions').doc(referenceId);
    const userRef = db.collection('users').doc(userId);
    const idempotencyKey = buildIdempotencyKey('coin_purchase_flutterwave', referenceId);
    const idempotencyRef = db.collection('ledger_idempotency').doc(idempotencyKey);

    // Run as an atomic Firestore ACID transaction with Double-Entry Ledger (all reads inside transaction)
    await db.runTransaction(async (transaction) => {
      const [idemSnap, existingTxSnap, userSnap] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(txDocRef),
        transaction.get(userRef),
      ]);

      if (idemSnap.exists || (existingTxSnap.exists && existingTxSnap.data()?.status === 'success')) {
        return;
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
        reference: referenceId,
        actorUid: userId,
        description: `Flutterwave coin purchase (${numCoins} L) ref=${referenceId}`,
        legs,
        metadata: {
          gateway: 'flutterwave',
          reference: referenceId,
          flwTransactionId: txData.id,
          amountPaid,
          currency,
          numCoins,
        },
      });

      transaction.set(
        txDocRef,
        {
          id: referenceId,
          journalId,
          userId,
          flutterwaveReference: referenceId,
          flwTransactionId: txData.id,
          amount: amountPaid,
          currency,
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
    });

    console.log(`[Flutterwave Callback Success]: Credited ${numCoins} coins to user ${userId}`);

    return NextResponse.redirect(`${origin}/?view=wallet&payment=success&coins=${numCoins}`);
  } catch (error: any) {
    console.error('[Flutterwave Callback Exception]:', error);
    return NextResponse.redirect(
      `${origin}/?view=wallet&payment=error&reason=processing_exception`
    );
  }
}
