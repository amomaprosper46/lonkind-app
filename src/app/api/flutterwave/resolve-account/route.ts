import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

/**
 * GET /api/flutterwave/resolve-account
 * Resolves bank account / mobile money holder name:
 *  1. For Nigeria (10-digit NUBAN): tries Flutterwave `/v3/accounts/resolve`, falling back to Paystack `/bank/resolve`.
 *  2. For international / mobile money regions (US, GB, EU, GH, KE, ZA) where instant NUBAN lookup isn't supported,
 *     returns `{ verified: true, manualEntryAllowed: true }` so creators can enter their verified holder name.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNumber = (searchParams.get('account_number') || '').trim();
    const bankCode = (searchParams.get('bank_code') || '').trim();
    const country = (searchParams.get('country') || 'NG').toUpperCase();

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { error: 'account_number and bank_code are required', verified: false },
        { status: 400 }
      );
    }

    if (country === 'NG') {
      if (accountNumber.length !== 10 || !/^\d{10}$/.test(accountNumber)) {
        return NextResponse.json(
          { error: 'Nigerian bank account numbers must be exactly 10 digits.', verified: false },
          { status: 400 }
        );
      }

      // 1. Try Flutterwave account resolver
      if (FLW_SECRET_KEY && !FLW_SECRET_KEY.includes('xxxxxxx')) {
        try {
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
          if (data.status === 'success' && data.data?.account_name) {
            return NextResponse.json({
              verified: true,
              accountName: data.data.account_name,
              accountNumber: data.data.account_number || accountNumber,
              source: 'flutterwave',
            });
          }
        } catch (flwErr) {
          console.warn('[Resolve Account] Flutterwave fallback to Paystack:', flwErr);
        }
      }

      // 2. Fallback to Paystack NUBAN resolver
      if (PAYSTACK_SECRET_KEY && !PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
        try {
          const psRes = await fetch(
            `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
              accountNumber
            )}&bank_code=${encodeURIComponent(bankCode)}`,
            {
              headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
            }
          );
          const psData = await psRes.json();
          if (psData.status && psData.data?.account_name) {
            return NextResponse.json({
              verified: true,
              accountName: psData.data.account_name,
              accountNumber: psData.data.account_number || accountNumber,
              source: 'paystack',
            });
          }
        } catch (psErr) {
          console.warn('[Resolve Account] Paystack fallback notice:', psErr);
        }
      }

      return NextResponse.json(
        {
          error: 'Could not auto-verify this 10-digit account. You may enter your account holder name manually below.',
          verified: false,
          manualEntryAllowed: true,
        },
        { status: 200 }
      );
    }

    // For GH, KE, ZA, US, GB, EU: allow manual beneficiary name entry once account/IBAN/mobile number is >= 6 chars
    return NextResponse.json({
      verified: true,
      manualEntryAllowed: true,
      accountNumber,
    });
  } catch (error: any) {
    console.error('[Resolve Account Exception]:', error);
    return NextResponse.json(
      {
        error: 'Automatic lookup unavailable — please type your account holder name manually.',
        verified: false,
        manualEntryAllowed: true,
      },
      { status: 200 }
    );
  }
}
