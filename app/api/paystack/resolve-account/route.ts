import { NextRequest, NextResponse } from 'next/server';

// Required: tells Next.js this is a dynamic route (reads request.url)
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────
//  SERVER-SIDE BANK ACCOUNT RESOLVER
//
//  WHY THIS EXISTS:
//  Paystack's /bank/resolve endpoint requires the SECRET KEY.
//  We can NEVER call it from the frontend (that would expose your secret).
//  So this API route proxies the call securely server-side.
//
//  Usage: GET /api/paystack/resolve-account?account_number=0123456789&bank_code=058
// ─────────────────────────────────────────────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNumber = searchParams.get('account_number');
    const bankCode = searchParams.get('bank_code');

    if (!accountNumber || !bankCode) {
      return NextResponse.json({ error: 'account_number and bank_code are required' }, { status: 400 });
    }

    if (accountNumber.length !== 10 || !/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must be exactly 10 digits' }, { status: 400 });
    }

    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      }
    );

    const data = await res.json();

    if (!data.status) {
      return NextResponse.json({
        error: data.message || 'Account not found. Please check the account number and bank.',
        verified: false,
      }, { status: 404 });
    }

    return NextResponse.json({
      verified: true,
      accountName: data.data.account_name,
      accountNumber: data.data.account_number,
    });

  } catch (error: any) {
    console.error('Account resolve error:', error);
    return NextResponse.json({ error: 'Could not verify account at this time.' }, { status: 500 });
  }
}
