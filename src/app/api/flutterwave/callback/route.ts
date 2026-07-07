import { NextRequest, NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  if (status !== 'successful' && status !== 'completed') {
    return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=failed&reason=${encodeURIComponent(status || 'cancelled')}`);
  }

  if (!txRef && !transactionId) {
    return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=failed&reason=no_reference`);
  }

  try {
    // Call our server verification route
    const verifyRes = await fetch(`${req.nextUrl.origin}/api/flutterwave/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: txRef, transaction_id: transactionId }),
    });

    const verifyData = await verifyRes.json();

    if (verifyData.success) {
      return NextResponse.redirect(
        `${APP_URL}/?view=wallet&payment=success&coins=${verifyData.coinsAdded}`
      );
    } else {
      console.warn('[Flutterwave Callback Verification Rejection]:', verifyData.error);
      return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=failed&reason=verification_failed`);
    }
  } catch (error: any) {
    console.error('[Flutterwave Callback Exception]:', error);
    return NextResponse.redirect(`${APP_URL}/?view=wallet&payment=error&reason=processing_exception`);
  }
}
