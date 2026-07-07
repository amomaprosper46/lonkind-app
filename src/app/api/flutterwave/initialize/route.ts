import { NextRequest, NextResponse } from 'next/server';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

/**
 * Supported Global Currency Rates (Price per coin in local currency)
 * 1 Coin = ~₦20 NGN | ~$0.02 USD | ~0.30 GHS | ~3.00 KES | ~£0.016 GBP | ~€0.018 EUR
 */
const CURRENCY_RATE_PER_COIN: Record<string, number> = {
  'NGN': 20,
  'USD': 0.02,
  'GHS': 0.30,
  'KES': 3.00,
  'GBP': 0.016,
  'EUR': 0.018,
  'ZAR': 0.36,
};

/**
 * POST: Secure Global Initialization Checkout Engine for Flutterwave v3
 */
export async function POST(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json(
        { error: 'Flutterwave payment engine currently offline. FLW_SECRET_KEY missing.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, userId, amount, coinsToCredit, currency = 'NGN' } = body;

    // Validate incoming parameters
    if (!email || !userId || !amount || !coinsToCredit) {
      return NextResponse.json({ error: 'Missing required checkout entries: email, userId, amount, coinsToCredit' }, { status: 400 });
    }

    const cleanCurrency = currency.toUpperCase();
    const rate = CURRENCY_RATE_PER_COIN[cleanCurrency] || CURRENCY_RATE_PER_COIN['NGN'];
    
    // Safety check: ensure user is paying a reasonable minimum amount per coin for the selected currency
    const expectedMinAmount = (coinsToCredit * rate) * 0.7; // Allow up to 30% volume bundle discount
    if (amount < expectedMinAmount) {
      console.warn(`[Flutterwave Init] Tamper detected for user ${userId}. Expected min ${cleanCurrency} ${expectedMinAmount}, got ${amount}`);
      return NextResponse.json({ error: 'Pricing validation failed for selected currency. Transaction blocked.' }, { status: 400 });
    }

    const txRef = `flw_tx_${userId}_${Date.now()}`;

    const flwPayload = {
      tx_ref: txRef,
      amount: Number(amount),
      currency: cleanCurrency,
      redirect_url: `${APP_URL}/api/flutterwave/callback`,
      meta: {
        userId,
        coinAmount: String(coinsToCredit),
        purpose: 'coin_purchase',
        currency: cleanCurrency,
      },
      customer: {
        email,
        name: email.split('@')[0],
      },
      customizations: {
        title: 'Lonkind Coins',
        description: `Purchase ${coinsToCredit} Coins (${cleanCurrency})`,
        logo: 'https://impactful-ideas.web.app/icon.png',
      },
    };

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flwPayload),
    });

    const data = await response.json();

    if (data.status !== 'success' || !data.data?.link) {
      console.error('[Flutterwave Rejection Details]:', data);
      return NextResponse.json({ error: data.message || 'Payment initiation rejected by Flutterwave gateway.' }, { status: 400 });
    }

    // Return authorizationUrl so frontend works seamlessly
    return NextResponse.json({
      authorizationUrl: data.data.link,
      reference: txRef,
      status: 'success',
    });

  } catch (error: any) {
    console.error('Critical Flutterwave initial checkout error:', error);
    return NextResponse.json({ error: 'An unexpected checkout failure occurred.' }, { status: 500 });
  }
}
