import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY!;

/**
 * GET: Server-Side Global Bank Account / Mobile Money Resolver for Flutterwave v3
 * Usage: GET /api/flutterwave/resolve-account?account_number=0123456789&bank_code=044&country=NG
 */
export async function GET(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const accountNumber = searchParams.get('account_number');
    const bankCode = searchParams.get('bank_code');
    const country = (searchParams.get('country') || 'NG').toUpperCase();

    if (!accountNumber || !bankCode) {
      return NextResponse.json({ error: 'account_number and bank_code are required' }, { status: 400 });
    }

    // For Nigeria, accounts must be 10 digits
    if (country === 'NG' && (accountNumber.length !== 10 || !/^\d{10}$/.test(accountNumber))) {
      return NextResponse.json({ error: 'Nigerian account numbers must be exactly 10 digits' }, { status: 400 });
    }

    const res = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber,
        account_bank: bankCode,
      }),
    });

    const data = await res.json();

    if (data.status !== 'success' || !data.data) {
      return NextResponse.json({
        error: data.message || 'Account not found. Please verify account number and bank provider.',
        verified: false,
      }, { status: 404 });
    }

    return NextResponse.json({
      verified: true,
      accountName: data.data.account_name,
      accountNumber: data.data.account_number,
    });

  } catch (error: any) {
    console.error('Flutterwave resolve account error:', error);
    return NextResponse.json({ error: 'Could not verify account at this time.' }, { status: 500 });
  }
}
