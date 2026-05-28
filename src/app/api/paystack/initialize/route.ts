import { NextRequest, NextResponse } from 'next/server';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json(
        { error: 'Paystack is not configured. Please set PAYSTACK_SECRET_KEY in .env.local' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, amount, userId, coinAmount } = body;

    if (!email || !amount || !userId || !coinAmount) {
      return NextResponse.json({ error: 'Missing required fields: email, amount, userId, coinAmount' }, { status: 400 });
    }

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Naira → Kobo (Paystack's smallest unit)
        currency: 'NGN',
        metadata: {
          userId,
          coinAmount,
          purpose: 'coin_purchase',
          // custom_fields show on Paystack dashboard
          custom_fields: [
            { display_name: 'User ID', variable_name: 'userId', value: userId },
            { display_name: 'Coins', variable_name: 'coinAmount', value: String(coinAmount) },
          ],
        },
        // CALLBACK: Where browser is redirected after payment
        // Webhook (set on dashboard) handles the actual coin crediting
        callback_url: `${APP_URL}/api/paystack/callback`,
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Failed to initialize payment' }, { status: 400 });
    }

    return NextResponse.json({
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });

  } catch (error: any) {
    console.error('Paystack initialize error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
