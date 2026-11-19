import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { settleCoinPurchaseWithFirstTimeBonus } from '@/lib/first-purchase-bonus';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
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
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  if (!reference) {
    return NextResponse.redirect(`${origin}/settings/wallet?payment=failed&reason=no_reference`);
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
        `${origin}/settings/wallet?payment=failed&reason=payment_not_successful`
      );
    }

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountNaira = verifyData.data.amount / 100;
    const numCoins = Number(coinAmount);

    if (!userId || !numCoins || numCoins <= 0) {
      console.error('Invalid payment metadata:', verifyData.data.metadata);
      return NextResponse.redirect(
        `${origin}/settings/wallet?payment=error&reason=invalid_metadata`
      );
    }

    const settled = await settleCoinPurchaseWithFirstTimeBonus(adminDb, {
      gateway: 'paystack',
      providerTransactionId: String(verifyData.data.id || reference),
      reference,
      userId,
      baseCoins: numCoins,
      amountPaid: amountNaira,
      currency: String(verifyData.data.currency || 'NGN').toUpperCase(),
      purpose: 'coin_purchase',
      source: 'paystack_callback',
    });

    const bonusParam = settled.bonusCoins > 0 ? `&bonus=${settled.bonusCoins}` : '';
    return NextResponse.redirect(
      `${origin}/settings/wallet?payment=success&coins=${settled.totalCoinsCredited}${bonusParam}&amount=${amountNaira}&reference=${encodeURIComponent(reference)}`
    );
  } catch (error: any) {
    console.error('[Paystack Callback Engine Exception]:', error);
    return NextResponse.redirect(
      `${origin}/settings/wallet?payment=error&reason=processing_exception`
    );
  }
}