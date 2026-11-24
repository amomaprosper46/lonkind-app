import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAndActivateFlutterwaveAdPayment } from '@/lib/ad-flutterwave-verify';

export const dynamic = 'force-dynamic';

const FLW_SECRET_HASH =
  process.env.FLW_SECRET_HASH || process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '';

function safeCompareHash(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * POST /api/ads/flutterwave/webhook
 * Dedicated Flutterwave webhook handler for `LONKIND_AD_` ad payments.
 * Strictly validates `verif-hash` signature, verifies `/v3/transactions/{id}/verify`,
 * and records idempotent ad revenue in `ad_revenue_ledger` without touching coin wallets.
 */
export async function POST(req: NextRequest) {
  try {
    const verifHash = req.headers.get('verif-hash') || '';
    if (!FLW_SECRET_HASH || !safeCompareHash(verifHash, FLW_SECRET_HASH)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    const data = payload?.data;
    const txRef = String(data?.tx_ref || '').trim();
    const transactionId = String(data?.id || '').trim();

    // Ignore non-ad webhooks cleanly so coin purchase webhooks stay strictly isolated
    if (!txRef.startsWith('LONKIND_AD_')) {
      return NextResponse.json({ received: true, ignored: 'not_an_ad_payment' });
    }

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction id.' }, { status: 400 });
    }

    const result = await verifyAndActivateFlutterwaveAdPayment(transactionId, txRef);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      received: true,
      campaignId: result.campaignId,
      transactionId: result.transactionId,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err: any) {
    console.error('[POST /api/ads/flutterwave/webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
