import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { assertEmailVerifiedForAction } from '@/lib/email-verification-gate';
import { assertAdultUserForAction } from '@/lib/age-gate-server';
import { verifyAppCheckRequest } from '@/lib/app-check-server';
import {
  checkRateLimit,
  parseStrictPositiveInt,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
} from '@/lib/security-shield';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

function resolveCanonicalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return req.nextUrl.origin;
  }
  // In production on Firebase Hosting / Cloud Run SSR, always use canonical NEXT_PUBLIC_APP_URL
  // so callbacks never point to internal *.a.run.app or 0.0.0.0 containers
  return APP_URL.replace(/\/$/, '');
}

const CURRENCY_RATE_PER_COIN: Record<string, number> = {
  NGN: 10,
  USD: 0.01,
  GHS: 0.15,
  KES: 1.5,
  GBP: 0.008,
  EUR: 0.009,
  ZAR: 0.18,
};

/**
 * POST /api/flutterwave/initialize
 * Initializes a Flutterwave v3 Standard Checkout session for purchasing Lonkind Coins.
 */
export async function POST(req: NextRequest) {
  const appCheck = await verifyAppCheckRequest(req, 'flutterwave/initialize');
  if (!appCheck.ok) return appCheck.response;
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json(
        { error: 'Flutterwave payment gateway is not configured (FLW_SECRET_KEY missing).' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      email,
      userId,
      amount,
      coins,
      coinsToCredit: rawCoinsToCredit,
      currency = 'NGN',
    } = body;

    const coinsToCredit = parseStrictPositiveInt(Number(rawCoinsToCredit || coins), 10_000_000);
    const numericAmount = Number(amount || 0);
    const customerEmail = String(email || '').trim() || 'member@lonkind.com';

    if (!userId || !Number.isFinite(numericAmount) || numericAmount <= 0 || coinsToCredit === null) {
      return NextResponse.json(
        { error: 'Invalid checkout fields: userId, positive amount, and positive integer coins are required.' },
        { status: 400 }
      );
    }

    const rl = checkRateLimit({
      namespace: 'flw_coin_init',
      key: String(userId),
      ...RATE_LIMIT_PRESETS.FINANCIAL_ACTION,
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    // Require verified email & 18+ age before unlocking coin purchases
    const [verificationGate, ageGate] = await Promise.all([
      assertEmailVerifiedForAction(String(userId), 'coin purchases'),
      assertAdultUserForAction(String(userId), 'purchasing coins'),
    ]);
    if (!verificationGate.allowed) {
      return NextResponse.json({ error: verificationGate.error }, { status: 403 });
    }
    if (!ageGate.allowed) {
      return NextResponse.json({ error: ageGate.error }, { status: 403 });
    }

    const cleanCurrency = String(currency || 'NGN').toUpperCase();
    const rate = CURRENCY_RATE_PER_COIN[cleanCurrency] || CURRENCY_RATE_PER_COIN.NGN;

    // Allow bundle discount (up to 28% on 25k bundle) + 20% first-time buyer bonus (floor = 0.55)
    const expectedMinAmount = Number((coinsToCredit * rate * 0.55).toFixed(2));
    if (numericAmount + 0.01 < expectedMinAmount) {
      console.warn(
        `[Flutterwave Init] Price check failed for user ${userId}: paid ${cleanCurrency} ${numericAmount}, min expected ${expectedMinAmount} for ${coinsToCredit} coins`
      );
      return NextResponse.json(
        { error: 'Pricing validation failed for selected package and currency.' },
        { status: 400 }
      );
    }

    const origin = resolveCanonicalOrigin(req);
    const txRef = `flw_tx_${userId}_${Date.now()}`;

    const flwPayload = {
      tx_ref: txRef,
      amount: numericAmount,
      currency: cleanCurrency,
      redirect_url: `${origin}/api/flutterwave/callback`,
      meta: {
        userId,
        coinAmount: String(coinsToCredit),
        coins: String(coinsToCredit),
        purpose: 'coin_purchase',
        currency: cleanCurrency,
      },
      customer: {
        email: customerEmail,
        name: customerEmail.split('@')[0] || 'Lonkind Member',
      },
      customizations: {
        title: 'Lonkind Coins',
        description: `Purchase ${coinsToCredit.toLocaleString()} Lonkind Coins (${cleanCurrency})`,
        logo: `${APP_URL.replace(/\/$/, '')}/icon-192x192.png`,
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
      console.error('[Flutterwave Init Error]:', data);
      return NextResponse.json(
        { error: data.message || 'Payment initiation rejected by Flutterwave.' },
        { status: 400 }
      );
    }

    // Pre-log pending transaction in Firestore for audit & fallback verification
    try {
      await adminDb.collection('transactions').doc(txRef).set(
        {
          id: txRef,
          userId,
          flutterwaveReference: txRef,
          amount: numericAmount,
          currency: cleanCurrency,
          coinsAdded: coinsToCredit,
          status: 'pending',
          type: 'coin_purchase',
          gateway: 'flutterwave',
          time: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (dbErr) {
      console.warn('[Flutterwave Init] Could not pre-log pending tx:', dbErr);
    }

    return NextResponse.json({
      authorizationUrl: data.data.link,
      reference: txRef,
      status: 'success',
    });
  } catch (error: any) {
    console.error('[Flutterwave Init Exception]:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected checkout initialization error occurred.' },
      { status: 500 }
    );
  }
}
