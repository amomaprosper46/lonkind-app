import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb as db, adminAuth } from '@/lib/firebase-admin';
import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

/**
 * Diamond Payout Value in Global Currencies
 * 1 Diamond = ₦15 NGN | $0.015 USD | 0.22 GHS | 2.25 KES | £0.012 GBP | €0.014 EUR | 0.27 ZAR
 */
const DIAMOND_PAYOUT_RATE: Record<string, number> = {
  'NGN': 15, 'USD': 0.015, 'GHS': 0.22,
  'KES': 2.25, 'GBP': 0.012, 'EUR': 0.014, 'ZAR': 0.27,
};

const COUNTRY_MAP: Record<string, string> = {
  'NG': 'nigeria', 'GH': 'ghana', 'KE': 'kenya',
  'ZA': 'south africa', 'US': 'united states', 'GB': 'united kingdom',
};

const MINIMUM_PAYOUT_DIAMONDS = 1;
const DAILY_CAP_DIAMONDS      = 50_000;   // Step 4: daily cap
const VELOCITY_THRESHOLD      = 100_000;  // Step 4: velocity flag

/**
 * POST: Queue a Payout Request (does NOT immediately call Paystack)
 *
 * Security controls implemented:
 *  - Firebase Auth ID token verification (identity confirmed server-side)
 *  - email_verified check via decodedToken (primary) + userData.emailVerified (fallback)
 *  - Account age >= 48 hours
 *  - Daily diamond withdrawal cap (50,000)
 *  - 26-hour cooldown between requests
 *  - Diamond velocity soft-flag (100,000 gained/24h → flagged_velocity)
 *  - Atomic Firestore transaction: balance verified + deducted + payout record + audit log
 *  - SHA-256 idempotency key prevents duplicate submissions on retries
 */
export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured.' }, { status: 503 });
    }

    // ── Step 1: Authenticate via Firebase Auth token ──────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired authentication token.' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // ── Step 2: Email verification guard (primary: Auth claim) ────
    if (!decodedToken.email_verified) {
      return NextResponse.json({
        error: 'Please verify your email address before requesting a payout.',
      }, { status: 403 });
    }

    const body = await req.json();
    const { diamondAmount, amountNaira, bankCode, accountNumber, accountName, currency = 'NGN' } = body;
    const cleanCurrency = currency.toUpperCase();
    const rate = DIAMOND_PAYOUT_RATE[cleanCurrency] || DIAMOND_PAYOUT_RATE['NGN'];

    if ((!diamondAmount && !amountNaira) || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required payout fields.' }, { status: 400 });
    }

    const requiredDiamonds = diamondAmount || Math.ceil(amountNaira / rate);
    const amountPaid = Number((requiredDiamonds * rate).toFixed(2));

    if (requiredDiamonds < MINIMUM_PAYOUT_DIAMONDS) {
      return NextResponse.json({
        error: `Minimum payout is ${MINIMUM_PAYOUT_DIAMONDS} diamonds.`,
      }, { status: 400 });
    }

    // ── Fetch user doc for guards ─────────────────────────────────
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    const userData = userDoc.data()!;

    // ── Guard 1: Account age (minimum 48 hours) ───────────────────
    const accountCreatedAt = userData.createdAt?.toDate?.() || new Date();
    const accountAgeHours = (Date.now() - accountCreatedAt.getTime()) / 3_600_000;
    if (accountAgeHours < 48) {
      return NextResponse.json({
        error: 'Account must be at least 48 hours old to request a payout.',
      }, { status: 403 });
    }

    // ── Guard 2: Email fallback check against Firestore ───────────
    if (!decodedToken.email_verified && !userData.emailVerified) {
      return NextResponse.json({
        error: 'Please verify your email address before requesting a payout.',
      }, { status: 403 });
    }

    // ── Guard 3: Daily withdrawal cap ─────────────────────────────
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todaySnap = await db.collection('payoutRequests')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(oneDayAgo))
      .get();
    const todayTotal = todaySnap.docs
      .filter(d => !['rejected', 'cancelled', 'failed'].includes(d.data().status))
      .reduce((sum, d) => sum + (d.data().diamondAmount || 0), 0);
    if (todayTotal + requiredDiamonds > DAILY_CAP_DIAMONDS) {
      return NextResponse.json({
        error: `Daily withdrawal limit reached. You can withdraw up to ${DAILY_CAP_DIAMONDS.toLocaleString()} diamonds per day.`,
      }, { status: 429 });
    }

    // ── Rate limit: 1 active request per 26-hour window ──────────
    const windowAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const recentSnap = await db.collection('payoutRequests')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(windowAgo))
      .get();
    const activeRequests = recentSnap.docs.filter(d => {
      const st = (d.data().status || '').toLowerCase();
      return !['failed', 'error', 'rejected', 'cancelled'].includes(st);
    });
    if (activeRequests.length > 0) {
      return NextResponse.json({
        error: 'You already have a payout being processed. Please try again later.',
      }, { status: 429 });
    }

    // ── Guard 4: Diamond velocity soft-flag ───────────────────────
    const recentGains = userData.diamondsGainedLast24h || 0;
    const payoutStatus = recentGains > VELOCITY_THRESHOLD ? 'flagged_velocity' : 'pending_review';

    const reference = `payout_ps_${userId}_${Date.now()}`;

    // SHA-256 idempotency key: same user + same amount + same account + same 26h window
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`ps:${userId}:${requiredDiamonds}:${accountNumber}:${Math.floor(Date.now() / (26 * 60 * 60 * 1000))}`)
      .digest('hex');

    const payoutRef       = db.collection('payoutRequests').doc(reference);
    const idempotencyRef  = db.collection('payoutIdempotency').doc(idempotencyKey);
    const auditRef        = db.collection('wallet_audit_logs').doc();
    const clientIp        = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // ── Atomic Transaction: verify → deduct → record ──────────────
    try {
      await db.runTransaction(async (tx) => {
        // Re-read balance INSIDE transaction — eliminates race condition
        const freshUserSnap = await tx.get(userRef);
        const currentDiamonds = freshUserSnap.data()?.diamonds || 0;

        if (currentDiamonds < requiredDiamonds) {
          throw new Error(
            `Insufficient diamonds. You have ${currentDiamonds.toLocaleString()} but need ${requiredDiamonds.toLocaleString()}.`
          );
        }

        // Idempotency: reject duplicate submissions
        const existingKey = await tx.get(idempotencyRef);
        if (existingKey.exists) throw new Error('DUPLICATE_REQUEST');

        // Lock the idempotency slot
        tx.set(idempotencyRef, { userId, reference, createdAt: FieldValue.serverTimestamp() });

        // Write payout record
        tx.set(payoutRef, {
          id: reference,
          userId,
          amount: amountPaid,
          currency: cleanCurrency,
          diamondAmount: requiredDiamonds,
          bankCode,
          accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'), // masked for display
          rawAccountNumber: accountNumber,                             // unmasked for processing
          accountName,
          reference,
          payoutMethod: 'paystack',
          status: payoutStatus,
          createdAt: FieldValue.serverTimestamp(),
          ip: clientIp,
        });

        // Deduct diamonds atomically
        tx.update(userRef, { diamonds: FieldValue.increment(-requiredDiamonds) });

        // Audit log entry
        tx.set(auditRef, {
          userId,
          type: 'payout_request',
          delta: -requiredDiamonds,
          balanceBefore: currentDiamonds,
          balanceAfter: currentDiamonds - requiredDiamonds,
          currency: 'diamonds',
          reference,
          gatewayRef: null,
          payoutMethod: 'paystack',
          timestamp: FieldValue.serverTimestamp(),
          ip: clientIp,
        });
      });
    } catch (txError: any) {
      if (txError.message === 'DUPLICATE_REQUEST') {
        return NextResponse.json({
          error: 'Duplicate request detected. Your payout is already being processed.',
        }, { status: 409 });
      }
      throw txError;
    }

    return NextResponse.json({
      success: true,
      message: `Your payout request of ${cleanCurrency} ${amountPaid.toLocaleString()} has been submitted and is being processed.`,
    });

  } catch (error: any) {
    console.error('Paystack payout queue error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// ─── GET: Fetch banks list for selected country ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured.' }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const countryCode = (searchParams.get('country') || 'NG').toUpperCase();
    const paystackCountryName = COUNTRY_MAP[countryCode] || 'nigeria';

    const res = await fetch(
      `https://api.paystack.co/bank?country=${encodeURIComponent(paystackCountryName)}&perPage=100`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const data = await res.json();
    if (!data.status) return NextResponse.json({ error: 'Could not fetch banks.' }, { status: 400 });
    return NextResponse.json({ banks: data.data, country: countryCode });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
