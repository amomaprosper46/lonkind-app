import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { settleCoinPurchaseWithFirstTimeBonus } from '@/lib/first-purchase-bonus';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

function resolveCanonicalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return req.nextUrl.origin;
  }
  return APP_URL.replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const origin = resolveCanonicalOrigin(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  if (status && status !== 'successful' && status !== 'completed') {
    return NextResponse.redirect(
      `${origin}/settings/wallet?payment=failed&reason=${encodeURIComponent(status)}`
    );
  }

  if (!txRef && !transactionId) {
    return NextResponse.redirect(`${origin}/settings/wallet?payment=failed&reason=no_reference`);
  }

  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      console.error('[Flutterwave Callback Error]: FLW_SECRET_KEY missing');
      return NextResponse.redirect(`${origin}/settings/wallet?payment=failed&reason=gateway_offline`);
    }

    const verifyUrl = transactionId
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef!)}`;

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
        `${origin}/settings/wallet?payment=failed&reason=verification_failed`
      );
    }

    const txData = verifyData.data;
    const meta = txData.meta || {};
    let userId = meta.userId;
    let numCoins = Number(meta.coinAmount || meta.coins || 0);
    const amountPaid = Number(txData.amount || 0);
    const currency = txData.currency || 'NGN';
    const referenceId = String(txData.tx_ref || txRef || transactionId);

    // Fallback: recover userId / coinsAdded from pre-saved pending `transactions/{referenceId}` doc
    if (!userId || !numCoins) {
      const pendingSnap = await adminDb.collection('transactions').doc(referenceId).get();
      if (pendingSnap.exists) {
        const p = pendingSnap.data() || {};
        if (!userId && p.userId) userId = p.userId;
        if (!numCoins && p.coinsAdded) numCoins = Number(p.coinsAdded);
      }
    }

    if (!userId || !numCoins || numCoins <= 0) {
      console.error('[Flutterwave Callback Missing Metadata]:', txData.meta);
      return NextResponse.redirect(
        `${origin}/settings/wallet?payment=failed&reason=invalid_metadata`
      );
    }

    const settled = await settleCoinPurchaseWithFirstTimeBonus(adminDb, {
      gateway: 'flutterwave',
      providerTransactionId: String(txData.id || transactionId || referenceId),
      reference: referenceId,
      userId,
      baseCoins: numCoins,
      amountPaid,
      currency,
      purpose: meta.purpose || 'coin_purchase',
      source: 'flutterwave_callback',
    });

    const bonusParam = settled.bonusCoins > 0 ? `&bonus=${settled.bonusCoins}` : '';
    return NextResponse.redirect(
      `${origin}/settings/wallet?payment=success&coins=${settled.totalCoinsCredited}${bonusParam}&reference=${encodeURIComponent(referenceId)}`
    );
  } catch (error: any) {
    console.error('[Flutterwave Callback Exception]:', error);
    return NextResponse.redirect(
      `${origin}/settings/wallet?payment=error&reason=processing_exception`
    );
  }
}
