import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

const MINIMUM_PAYOUT_DIAMONDS = 350;

/**
 * Diamond Payout Value in Global Currencies
 * 1 Diamond = ₦15 NGN | $0.015 USD | 0.22 GHS | 2.25 KES | £0.012 GBP | €0.014 EUR | 0.27 ZAR
 */
const DIAMOND_PAYOUT_RATE: Record<string, number> = {
  'NGN': 15,
  'USD': 0.015,
  'GHS': 0.22,
  'KES': 2.25,
  'GBP': 0.012,
  'EUR': 0.014,
  'ZAR': 0.27,
};

/**
 * GET: Fetch banks list for any supported country (NG, US, GH, KE, ZA, GB, EU)
 */
export async function GET(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured.' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const country = (searchParams.get('country') || 'NG').toUpperCase();

    const res = await fetch(`https://api.flutterwave.com/v3/banks/${country}`, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
    });
    const data = await res.json();
    if (data.status !== 'success' || !data.data) {
      return NextResponse.json({ error: 'Could not fetch banks for selected country.' }, { status: 400 });
    }
    return NextResponse.json({ banks: data.data, country });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Request Automated Global Payout Transfer
 */
export async function POST(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured.' }, { status: 503 });
    }

    const body = await req.json();
    const { userId, diamondAmount, bankCode, accountNumber, accountName, currency = 'NGN' } = body;

    if (!userId || !diamondAmount || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required payout fields.' }, { status: 400 });
    }

    if (diamondAmount < MINIMUM_PAYOUT_DIAMONDS) {
      return NextResponse.json({
        error: `Minimum payout is ${MINIMUM_PAYOUT_DIAMONDS} diamonds. You requested ${diamondAmount}.`,
      }, { status: 400 });
    }

    const cleanCurrency = currency.toUpperCase();
    const rate = DIAMOND_PAYOUT_RATE[cleanCurrency] || DIAMOND_PAYOUT_RATE['NGN'];
    const amountPaid = Number((diamondAmount * rate).toFixed(2));

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const currentDiamonds = userData.diamonds || 0;

    if (currentDiamonds < diamondAmount) {
      return NextResponse.json({
        error: `Insufficient diamond balance. You have ${currentDiamonds.toLocaleString()} diamonds but requested ${diamondAmount}.`,
      }, { status: 400 });
    }

    // Rate limit: max 1 payout request per 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequests = await db.collection('payoutRequests')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(oneDayAgo))
      .limit(1)
      .get();

    if (!recentRequests.empty) {
      return NextResponse.json({
        error: 'You can only request one payout per 24 hours. Please try again tomorrow.',
      }, { status: 429 });
    }

    const reference = `flw_payout_${userId}_${Date.now()}`;

    // Initiate Automated Transfer via Flutterwave API v3
    const transferPayload = {
      account_bank: bankCode,
      account_number: accountNumber,
      amount: amountPaid,
      narration: 'Lonkind Creator Payout',
      currency: cleanCurrency,
      reference: reference,
      callback_url: `${APP_URL}/api/flutterwave/webhook`,
      beneficiary_name: accountName,
    };

    const transferRes = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transferPayload),
    });

    const transferData = await transferRes.json();
    if (transferData.status !== 'success' || !transferData.data) {
      throw new Error(transferData.message || 'Failed to initiate automated transfer with Flutterwave');
    }

    // Record the payout request in Firestore
    await db.collection('payoutRequests').doc(reference).set({
      userId,
      amount: amountPaid,
      amountNaira: cleanCurrency === 'NGN' ? amountPaid : amountPaid * 1500, // Legacy support field
      currency: cleanCurrency,
      diamondAmount,
      bankCode,
      accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'), // mask
      accountName,
      reference,
      flutterwaveTransferId: transferData.data.id,
      status: transferData.data.status || 'NEW',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Deduct diamonds from user's balance
    await userRef.update({
      diamonds: FieldValue.increment(-diamondAmount)
    });

    return NextResponse.json({
      success: true,
      status: transferData.data.status,
      amount: amountPaid,
      currency: cleanCurrency,
      message: `Your payout of ${cleanCurrency} ${amountPaid.toLocaleString()} is being processed via Flutterwave!`,
    });

  } catch (error: any) {
    console.error('Flutterwave payout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
