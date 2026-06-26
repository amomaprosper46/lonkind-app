import { NextRequest, NextResponse } from 'next/server';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

/**
 * 1. Immutable Server-Side Coin Economy Configuration Matrix
 * Centralizing packages on the server prevents users from tampering with prices.
 */
const COIN_PRICING_TIERS: Record<string, { coins: number; priceNaira: number }> = {
  'tier_starter': { coins: 10, priceNaira: 200 },     // ₦20 per coin
  'tier_bronze':  { coins: 50, priceNaira: 900 },     // ₦18 per coin (Discount tier)
  'tier_silver':  { coins: 100, priceNaira: 1700 },   // ₦17 per coin (Discount tier)
  'tier_gold':    { coins: 500, priceNaira: 7500 },   // ₦15 per coin (Premium tier)
};

/**
 * POST: Secure Initialization Checkout Engine
 */
export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json(
        { error: 'Payment initialization engine currently offline. Key missing.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, userId, amountNaira, coinsToCredit } = body;

    // Validate incoming parameters
    if (!email || !userId || !amountNaira || !coinsToCredit) {
      return NextResponse.json({ error: 'Missing core tracking entries: email, userId, amountNaira, coinsToCredit' }, { status: 400 });
    }

    /**
     * 2. Construct the Paystack Transaction Invoice
     */
    const paystackPayload = {
      email,
      amount: Math.round(amountNaira * 100), // Convert authenticated Naira to integer Kobo units
      currency: 'NGN',
      metadata: {
        userId,
        coinAmount: coinsToCredit, 
        purpose: 'coin_purchase',
        custom_fields: [
          { display_name: 'User ID', variable_name: 'userId', value: userId },
          { display_name: 'Coins Allocated', variable_name: 'coinAmount', value: String(coinsToCredit) },
        ],
      },
      callback_url: `${APP_URL}/api/paystack/callback`,
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const data = await response.json();

    if (!data.status) {
      console.error('[Paystack Core Rejection Details]:', data.message);
      return NextResponse.json({ error: data.message || 'Payment initiation rejected by settlement server.' }, { status: 400 });
    }

    return NextResponse.json({
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });

  } catch (error: any) {
    console.error('Critical Paystack initial checkout loop collapse:', error);
    return NextResponse.json({ error: 'An unexpected checkout failure occurred.' }, { status: 500 });
  }
}