import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { settleCoinPurchaseWithFirstTimeBonus } from '@/lib/first-purchase-bonus';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const CURRENCY_RATE_PER_COIN: Record<string, number> = {
  NGN: 10,
  USD: 0.01,
  GHS: 0.15,
  KES: 1.5,
  GBP: 0.008,
  EUR: 0.009,
  ZAR: 0.18,
};

export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    // Verify the transaction with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: verifyData.data?.gateway_response,
        },
        { status: 400 }
      );
    }

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountPaid = verifyData.data.amount / 100;
    const currency = (verifyData.data.currency || 'NGN').toUpperCase();

    if (!userId || !coinAmount || Number(coinAmount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const numCoins = Number(coinAmount);
    const rate = CURRENCY_RATE_PER_COIN[currency] || CURRENCY_RATE_PER_COIN['NGN'];
    const expectedMinAmount = Number((numCoins * rate * 0.55).toFixed(2));

    if (amountPaid + 0.01 < expectedMinAmount) {
      console.error(
        `[Paystack Verify] Fraud/tamper detected for user ${userId}. Paid ${currency} ${amountPaid}, expected minimum ${expectedMinAmount} for ${numCoins} coins.`
      );
      return NextResponse.json(
        { error: 'Payment amount does not match coins requested' },
        { status: 400 }
      );
    }

    const txResult = await settleCoinPurchaseWithFirstTimeBonus(adminDb, {
      gateway: 'paystack',
      providerTransactionId: String(verifyData.data.id || reference),
      reference,
      userId,
      baseCoins: numCoins,
      amountPaid,
      currency,
      purpose: 'coin_purchase',
      source: 'paystack_verify',
    });

    if (txResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        alreadyProcessed: true,
        coinsAdded: txResult.totalCoinsCredited,
        baseCoins: txResult.baseCoins,
        bonusCoins: txResult.bonusCoins,
      });
    }

    return NextResponse.json({
      success: true,
      journalId: txResult.journalId,
      message:
        txResult.bonusCoins > 0
          ? `Successfully credited ${txResult.baseCoins.toLocaleString()} coins + ${txResult.bonusCoins.toLocaleString()} First-Time Bonus coins!`
          : `Successfully credited ${txResult.totalCoinsCredited.toLocaleString()} coins to your account!`,
      coinsAdded: txResult.totalCoinsCredited,
      baseCoins: txResult.baseCoins,
      bonusCoins: txResult.bonusCoins,
    });
  } catch (error: any) {
    console.error('Paystack verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');
  const ref = reference || trxref;

  if (!ref) {
    return NextResponse.redirect(new URL('/?payment=failed', req.url));
  }

  try {
    const response = await fetch(`${req.nextUrl.origin}/api/paystack/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref }),
    });

    const data = await response.json();
    if (data.success) {
      return NextResponse.redirect(
        new URL(`/?payment=success&coins=${data.coinsAdded}`, req.url)
      );
    } else {
      return NextResponse.redirect(new URL('/?payment=failed', req.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/?payment=failed', req.url));
  }
}
