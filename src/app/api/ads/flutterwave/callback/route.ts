import { NextRequest, NextResponse } from 'next/server';
import { verifyAndActivateFlutterwaveAdPayment } from '@/lib/ad-flutterwave-verify';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

function resolveCanonicalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return req.nextUrl.origin;
  }
  return APP_URL.replace(/\/$/, '');
}

/**
 * GET /api/ads/flutterwave/callback
 * Handles redirect back from Flutterwave Ad checkout, verifies payment server-side,
 * records revenue in `ad_revenue_ledger`, and routes the ad to Pending Approvals.
 */
export async function GET(req: NextRequest) {
  const origin = resolveCanonicalOrigin(req);
  const status = req.nextUrl.searchParams.get('status') || '';
  const txRef = req.nextUrl.searchParams.get('tx_ref') || '';
  const transactionId = req.nextUrl.searchParams.get('transaction_id') || '';

  if (status === 'cancelled' || !transactionId || !txRef.startsWith('LONKIND_AD_')) {
    return NextResponse.redirect(`${origin}/?adPayment=cancelled`);
  }

  try {
    const result = await verifyAndActivateFlutterwaveAdPayment(transactionId, txRef);
    if (!result.success) {
      return NextResponse.redirect(
        `${origin}/?adPayment=failed&reason=${encodeURIComponent(result.error)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/?adPayment=pending_review&campaignId=${encodeURIComponent(result.campaignId)}`
    );
  } catch (err: any) {
    console.error('[GET /api/ads/flutterwave/callback] Error:', err);
    return NextResponse.redirect(`${origin}/?adPayment=error`);
  }
}
