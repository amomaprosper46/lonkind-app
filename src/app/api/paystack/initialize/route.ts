import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
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
 * POST: Secure Global Initialization Checkout Engine for Paystack
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
    const { email, userId, amount, amountNaira, coinsToCredit, currency = 'NGN' } = body;
    const finalAmount = amount || amountNaira;

    // Validate incoming parameters
    if (!email || !userId || !finalAmount || !coinsToCredit) {
      return NextResponse.json({ error: 'Missing core tracking entries: email, userId, amount, coinsToCredit' }, { status: 400 });
    }

    const cleanCurrency = currency.toUpperCase();
    const rate = CURRENCY_RATE_PER_COIN[cleanCurrency] || CURRENCY_RATE_PER_COIN['NGN'];
    
    // Safety check: ensure user is paying a reasonable minimum amount per coin for the selected currency
    const expectedMinAmount = (coinsToCredit * rate) * 0.7; // Allow up to 30% volume bundle discount
    if (finalAmount < expectedMinAmount) {
      console.warn(`[Paystack Init] Tamper detected for user ${userId}. Expected min ${cleanCurrency} ${expectedMinAmount}, got ${finalAmount}`);
      return NextResponse.json({ error: 'Pricing mismatch detected. Transaction blocked.' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || req.nextUrl.origin || APP_URL;

    /**
     * 2. Construct the Paystack Transaction Invoice
     */
    const paystackPayload = {
      email,
      amount: Math.round(finalAmount * 100), // Convert authenticated currency to sub-units (kobo/cents)
      currency: cleanCurrency,
      metadata: {
        userId,
        coinAmount: coinsToCredit, 
        purpose: 'coin_purchase',
        custom_fields: [
          { display_name: 'User ID', variable_name: 'userId', value: userId },
          { display_name: 'Coins Allocated', variable_name: 'coinAmount', value: String(coinsToCredit) },
        ],
      },
      callback_url: `${origin}/api/paystack/callback`,
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

    // Immediately save transaction reference to Firestore so history is permanently recorded
    try {
      await adminDb.collection('transactions').doc(data.data.reference).set({
        id: data.data.reference,
        userId,
        paystackReference: data.data.reference,
        amount: finalAmount,
        amountNaira: finalAmount,
        currency: cleanCurrency,
        coinsAdded: Number(coinsToCredit),
        status: 'pending',
        type: 'coin_purchase',
        time: FieldValue.serverTimestamp(),
      });
    } catch (dbError) {
      console.error('Failed to pre-save pending transaction reference:', dbError);
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