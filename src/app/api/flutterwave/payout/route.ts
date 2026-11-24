import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb as db, adminAuth } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { commitDoubleEntryJournalInTx, DoubleEntryLeg } from '@/lib/ledger';
import { assertEmailVerifiedForAction } from '@/lib/email-verification-gate';
import { assertAdultUserForAction } from '@/lib/age-gate-server';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

const FALLBACK_BANKS_BY_COUNTRY: Record<string, { name: string; code: string }[]> = {
  NG: [
    { name: 'Access Bank', code: '044' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
    { name: 'Kuda Bank', code: '090267' },
    { name: 'Moniepoint MFB', code: '50515' },
    { name: 'OPay Digital Services', code: '100004' },
    { name: 'PalmPay', code: '100033' },
    { name: 'Stanbic IBTC Bank', code: '221' },
    { name: 'United Bank for Africa (UBA)', code: '033' },
    { name: 'Zenith Bank', code: '057' },
  ],
  GH: [
    { name: 'MTN Mobile Money Ghana', code: 'MTN' },
    { name: 'Telecel (Vodafone) Cash', code: 'VODAFONE' },
    { name: 'AirtelTigo Money', code: 'TIGO' },
    { name: 'GCB Bank', code: 'GCB' },
    { name: 'Ecobank Ghana', code: 'ECO' },
  ],
  KE: [
    { name: 'M-PESA Kenya (Safaricom)', code: 'MPESA' },
    { name: 'Equity Bank Kenya', code: '68' },
    { name: 'KCB Bank Kenya', code: '01' },
    { name: 'Co-operative Bank of Kenya', code: '11' },
  ],
  ZA: [
    { name: 'First National Bank (FNB)', code: '250655' },
    { name: 'Standard Bank South Africa', code: '051001' },
    { name: 'Capitec Bank', code: '470010' },
    { name: 'Absa Bank', code: '632005' },
    { name: 'Nedbank', code: '198765' },
  ],
  US: [
    { name: 'ACH / Wire Bank Transfer (US)', code: 'US_ACH' },
    { name: 'JPMorgan Chase', code: 'US_CHASE' },
    { name: 'Bank of America', code: 'US_BOA' },
    { name: 'Wells Fargo', code: 'US_WF' },
    { name: 'Citibank', code: 'US_CITI' },
  ],
  GB: [
    { name: 'UK Faster Payments (Sort Code + Account)', code: 'GB_FASTER' },
    { name: 'Barclays UK', code: 'GB_BARCLAYS' },
    { name: 'HSBC UK', code: 'GB_HSBC' },
    { name: 'Lloyds Bank', code: 'GB_LLOYDS' },
    { name: 'Revolut / Monzo UK', code: 'GB_REVOLUT' },
  ],
  EU: [
    { name: 'SEPA Instant / IBAN Transfer (EUR)', code: 'EU_SEPA' },
    { name: 'Revolut Europe (IBAN)', code: 'EU_REVOLUT' },
    { name: 'Wise Europe (IBAN)', code: 'EU_WISE' },
    { name: 'N26 Bank (IBAN)', code: 'EU_N26' },
  ],
};

/**
 * Diamond Payout Value in Global Currencies
 * 1 Diamond = ₦15 NGN | $0.015 USD | 0.22 GHS | 2.25 KES | £0.012 GBP | €0.014 EUR | 0.27 ZAR
 */
const DIAMOND_PAYOUT_RATE: Record<string, number> = {
  'NGN': 15, 'USD': 0.015, 'GHS': 0.22,
  'KES': 2.25, 'GBP': 0.012, 'EUR': 0.014, 'ZAR': 0.27,
};

/**
 * Minimum Payout: 1,000 Diamonds = $15.00 USD / ₦15,000 NGN
 * Prevents $1 micro-withdrawals where gateway transfer fees exceed the payout value.
 */
const MINIMUM_PAYOUT_DIAMONDS = 1_000;

/**
 * 3-Tier Daily Withdrawal Limits (at 1 Diamond = $0.015 USD / ₦15 NGN):
 *  - Tier 1 (New / Unverified):        $100/day   = 6,700 Diamonds   (₦100,500/day)
 *  - Tier 2 (Standard / KYC Verified): $500/day   = 33,400 Diamonds  (₦501,000/day)
 *  - Tier 3 (VIP / Top Creators):      $2,500/day = 167,000 Diamonds (₦2,505,000/day)
 */
const TIER_1_NEW_DAILY_DIAMONDS      = 6_700;   // ~$100 USD / day
const TIER_2_VERIFIED_DAILY_DIAMONDS = 33_400;  // ~$500 USD / day
const TIER_3_VIP_DAILY_DIAMONDS      = 167_000; // ~$2,500 USD / day

const VELOCITY_THRESHOLD             = 167_000; // Soft-flag if > $2,500 earned in 24h
const MANUAL_REVIEW_THRESHOLD_USD    = 1_000;   // Hold single payouts >= $1,000 (66,700 diamonds) for review

interface UserWithdrawalTier {
  tierLevel: 1 | 2 | 3;
  tierName: string;
  dailyCapDiamonds: number;
  dailyCapUsd: number;
}

function resolveUserWithdrawalTier(userData: FirebaseFirestore.DocumentData, accountAgeHours: number): UserWithdrawalTier {
  const accountAgeDays = accountAgeHours / 24;
  const hasNoFraudFlags = !userData.fraudFlagged && !userData.velocityFlagged;
  const isManualVip =
    userData.payoutTier === 'vip' ||
    userData.isTopCreator === true ||
    userData.role === 'admin';
  const isAutoVip =
    hasNoFraudFlags &&
    accountAgeDays >= 90 &&
    (userData.isVerified === true || userData.kycVerified === true || (userData.totalCoinsSent || 0) >= 50_000);

  if (isManualVip || isAutoVip) {
    return {
      tierLevel: 3,
      tierName: 'VIP / Top Creator',
      dailyCapDiamonds: TIER_3_VIP_DAILY_DIAMONDS,
      dailyCapUsd: 2_500,
    };
  }

  const isKycVerified =
    userData.kycVerified === true ||
    userData.isVerified === true ||
    userData.payoutTier === 'verified' ||
    (hasNoFraudFlags && accountAgeDays >= 30);

  if (isKycVerified) {
    return {
      tierLevel: 2,
      tierName: 'Standard / Verified (KYC)',
      dailyCapDiamonds: TIER_2_VERIFIED_DAILY_DIAMONDS,
      dailyCapUsd: 500,
    };
  }

  return {
    tierLevel: 1,
    tierName: 'New / Unverified',
    dailyCapDiamonds: TIER_1_NEW_DAILY_DIAMONDS,
    dailyCapUsd: 100,
  };
}

/**
 * GET: Fetch banks list for any supported country (NG, US, GH, KE, ZA, GB, EU)
 * Uses Flutterwave v3 -> Paystack fallback -> Built-in verified provider catalog
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = (searchParams.get('country') || 'NG').toUpperCase();

    // 1. Try Flutterwave /v3/banks/{country} for supported African countries
    if (FLW_SECRET_KEY && !FLW_SECRET_KEY.includes('xxxxxxx') && ['NG', 'GH', 'KE', 'ZA'].includes(country)) {
      try {
        const res = await fetch(`https://api.flutterwave.com/v3/banks/${country}`, {
          headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
        });
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
          return NextResponse.json({ banks: data.data, country, source: 'flutterwave' });
        }
      } catch (flwErr) {
        console.warn('[Payout Banks] Flutterwave bank fetch fallback:', flwErr);
      }
    }

    // 2. Fallback to Paystack /bank for Nigeria, Ghana, Kenya, South Africa
    const paystackCountryMap: Record<string, string> = {
      NG: 'nigeria',
      GH: 'ghana',
      KE: 'kenya',
      ZA: 'south africa',
    };
    if (PAYSTACK_SECRET_KEY && paystackCountryMap[country]) {
      try {
        const psRes = await fetch(
          `https://api.paystack.co/bank?country=${encodeURIComponent(paystackCountryMap[country])}`,
          { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
        );
        const psData = await psRes.json();
        if (psData.status && Array.isArray(psData.data) && psData.data.length > 0) {
          const mapped = psData.data.map((b: any) => ({ name: b.name, code: String(b.code) }));
          return NextResponse.json({ banks: mapped, country, source: 'paystack' });
        }
      } catch (psErr) {
        console.warn('[Payout Banks] Paystack bank fetch fallback:', psErr);
      }
    }

    // 3. Always return verified fallback bank/provider list so dropdown is never empty
    const fallbackList = FALLBACK_BANKS_BY_COUNTRY[country] || FALLBACK_BANKS_BY_COUNTRY.NG;
    return NextResponse.json({ banks: fallbackList, country, source: 'catalog' });
  } catch (error: any) {
    return NextResponse.json(
      { banks: FALLBACK_BANKS_BY_COUNTRY.NG, country: 'NG', error: error.message },
      { status: 200 }
    );
  }
}

/**
 * POST: Process a Tiered Payout Request
 */
export async function POST(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured.' }, { status: 503 });
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

    // Require verified email & 18+ age before unlocking creator payouts
    const [verificationGate, ageGate] = await Promise.all([
      assertEmailVerifiedForAction(userId, 'creator payouts'),
      assertAdultUserForAction(userId, 'requesting creator payouts'),
    ]);
    if (!verificationGate.allowed) {
      return NextResponse.json({ error: verificationGate.error }, { status: 403 });
    }
    if (!ageGate.allowed) {
      return NextResponse.json({ error: ageGate.error }, { status: 403 });
    }

    const body = await req.json();
    const { diamondAmount: rawDiamondAmount, bankCode, accountNumber, accountName, currency = 'NGN' } = body;
    const diamondAmount = Number(rawDiamondAmount || 0);

    if (!diamondAmount || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required payout fields (diamondAmount, bankCode, accountNumber, accountName).' }, { status: 400 });
    }

    if (diamondAmount < MINIMUM_PAYOUT_DIAMONDS) {
      return NextResponse.json({
        error: `Minimum withdrawal is ${MINIMUM_PAYOUT_DIAMONDS.toLocaleString()} diamonds ($15 USD / ₦15,000 NGN) to cover payment gateway fees.`,
      }, { status: 400 });
    }

    const cleanCurrency = currency.toUpperCase();
    const rate = DIAMOND_PAYOUT_RATE[cleanCurrency] || DIAMOND_PAYOUT_RATE['NGN'];
    const grossAmount = Number((diamondAmount * rate).toFixed(2));
    const platformFee = Number((grossAmount * 0.25).toFixed(2));
    const amountPaid = Number((grossAmount * 0.75).toFixed(2));
    const equivalentUsd = Number((diamondAmount * DIAMOND_PAYOUT_RATE['USD'] * 0.75).toFixed(2));
    const equivalentNaira = cleanCurrency === 'NGN' ? amountPaid : Number((diamondAmount * 15 * 0.75).toFixed(2));

    // ── Fetch user doc & Firebase Auth record for accurate creation time & email verification ──
    const [userDoc, authUserRecord] = await Promise.all([
      db.collection('users').doc(userId).get(),
      adminAuth.getUser(userId).catch(() => null),
    ]);
    const userRef = db.collection('users').doc(userId);
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const userData = userDoc.data()!;

    // ── Guard 1: Account age (resolve from Firestore createdAt OR Firebase Auth creationTime) ──
    let accountCreatedMs = 0;
    if (userData.createdAt?.toDate) {
      accountCreatedMs = userData.createdAt.toDate().getTime();
    } else if (typeof userData.createdAt === 'number') {
      accountCreatedMs = userData.createdAt;
    } else if (authUserRecord?.metadata?.creationTime) {
      accountCreatedMs = Date.parse(authUserRecord.metadata.creationTime);
    }
    // If no creation timestamp exists at all (legacy account), treat as established (> 48h)
    const accountAgeHours = accountCreatedMs > 0 ? (Date.now() - accountCreatedMs) / 3_600_000 : 720;
    if (accountAgeHours < 48 && userData.role !== 'admin' && !userData.isVerified) {
      return NextResponse.json(
        {
          error: `New accounts must be at least 48 hours old before requesting a payout (${Math.max(
            1,
            Math.ceil(48 - accountAgeHours)
          )}h remaining).`,
        },
        { status: 403 }
      );
    }

    // ── Guard 2: Email verification check (Auth claim, Auth user record, or Firestore flag) ──
    const isEmailVerified =
      Boolean(decodedToken.email_verified) ||
      Boolean(authUserRecord?.emailVerified) ||
      Boolean(userData.emailVerified) ||
      Boolean(userData.isVerified);
    if (!isEmailVerified && !authUserRecord?.email) {
      return NextResponse.json(
        {
          error: 'Please link and verify an email address on your account before requesting a payout.',
        },
        { status: 403 }
      );
    }

    // ── Guard 3: Internal Tiered Daily Withdrawal Limit ───────────
    const userTier = resolveUserWithdrawalTier(userData, accountAgeHours);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todaySnap = await db.collection('payoutRequests')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(oneDayAgo))
      .get();
    const todayTotal = todaySnap.docs
      .filter(d => !['rejected', 'cancelled', 'failed'].includes(d.data().status))
      .reduce((sum, d) => sum + (d.data().diamondAmount || 0), 0);
    if (todayTotal + diamondAmount > userTier.dailyCapDiamonds) {
      return NextResponse.json({
        error: 'You have reached your daily withdrawal limit. Complete account verification or try a smaller amount.',
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

    // ── Guard 4: High-Value ($1,000+) Manual Review & Velocity Soft-Flag ───────
    const recentGains = userData.diamondsGainedLast24h || 0;
    const isVelocityFlagged = recentGains > VELOCITY_THRESHOLD;
    const needsManualReview = isVelocityFlagged || equivalentUsd >= MANUAL_REVIEW_THRESHOLD_USD;
    const payoutStatus = isVelocityFlagged
      ? 'flagged_velocity'
      : needsManualReview
      ? 'pending_review'
      : 'processing';

    const reference = `payout_flw_${userId}_${Date.now()}`;

    // SHA-256 idempotency key: same user + same amount + same account + same 26h window
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`flw:${userId}:${diamondAmount}:${accountNumber}:${Math.floor(Date.now() / (26 * 60 * 60 * 1000))}`)
      .digest('hex');

    const payoutRef      = db.collection('payoutRequests').doc(reference);
    const idempotencyRef = db.collection('payoutIdempotency').doc(idempotencyKey);
    const auditRef       = db.collection('wallet_audit_logs').doc();
    const clientIp       = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // ── Atomic Transaction: verify → double-entry journal → deduct exact balance → record ──
    try {
      await db.runTransaction(async (tx) => {
        // Re-read balance & idempotency INSIDE transaction — eliminates race condition
        const [freshUserSnap, existingKey] = await Promise.all([
          tx.get(userRef),
          tx.get(idempotencyRef),
        ]);
        const currentDiamonds = Number(freshUserSnap.data()?.diamonds || 0);

        if (currentDiamonds < diamondAmount) {
          throw new Error(
            `Insufficient diamonds. You have ${currentDiamonds.toLocaleString()} but need ${diamondAmount.toLocaleString()}.`
          );
        }

        if (existingKey.exists) throw new Error('DUPLICATE_REQUEST');

        const diamondsAfter = currentDiamonds - diamondAmount;

        const legs: DoubleEntryLeg[] = [
          {
            accountId: userId,
            accountKind: 'USER',
            asset: 'DIAMONDS',
            direction: 'DEBIT',
            amount: diamondAmount,
            balanceBefore: currentDiamonds,
            balanceAfter: diamondsAfter,
          },
          {
            accountId: 'LONKIND_PAYOUT_ESCROW_DIAMONDS',
            accountKind: 'SYSTEM_ESCROW',
            asset: 'DIAMONDS',
            direction: 'CREDIT',
            amount: diamondAmount,
            balanceBefore: 0,
            balanceAfter: diamondAmount,
          },
        ];

        const { journalId } = commitDoubleEntryJournalInTx(db, tx, {
          journalType: 'PAYOUT_ESCROW_HOLD',
          idempotencyKey: `payout_hold_${idempotencyKey}`,
          reference,
          actorUid: userId,
          description: `Flutterwave payout escrow hold (${diamondAmount} diamonds -> ${cleanCurrency} ${amountPaid})`,
          legs,
          metadata: {
            payoutMethod: 'flutterwave',
            amount: amountPaid,
            currency: cleanCurrency,
            ip: clientIp,
          },
        });

        // Lock the idempotency slot
        tx.set(idempotencyRef, {
          userId,
          reference,
          journalId,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Write payout record to both `payoutRequests` and `payout_requests`
        const payoutDocData = {
          id: reference,
          journalId,
          userId,
          amount: amountPaid,
          grossAmount,
          platformFee,
          amountNaira: equivalentNaira,
          currency: cleanCurrency,
          diamondAmount,
          diamondsBefore: currentDiamonds,
          diamondsAfter,
          bankCode,
          accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'),
          rawAccountNumber: accountNumber,
          accountName,
          reference,
          payoutMethod: 'flutterwave',
          status: payoutStatus,
          createdAt: FieldValue.serverTimestamp(),
          ip: clientIp,
        };
        tx.set(payoutRef, payoutDocData);
        tx.set(db.collection('payout_requests').doc(reference), payoutDocData);

        // Write exact computed diamond balance (never blind decrement)
        tx.update(userRef, {
          diamonds: diamondsAfter,
          updatedAt: FieldValue.serverTimestamp(),
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

    // ── Auto-Dispatch Payouts Under ₦5,000,000 Directly to Bank ──────────────
    if (!needsManualReview) {
      try {
        const transferRes = await fetch('https://api.flutterwave.com/v3/transfers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${FLW_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_bank: bankCode,
            account_number: accountNumber,
            amount: amountPaid,
            narration: 'Lonkind Creator Payout',
            currency: cleanCurrency,
            reference: `${reference}_exec`,
            beneficiary_name: accountName,
          }),
        });
        const transferData = await transferRes.json();

        if (transferData.status === 'success' && transferData.data) {
          await payoutRef.update({
            status: 'completed',
            autoExecutedAt: FieldValue.serverTimestamp(),
            flutterwaveTransferId: transferData.data.id,
          });
          await userRef.collection('notifications').doc().set({
            type: 'payout_approved',
            amount: amountPaid,
            currency: cleanCurrency,
            timestamp: FieldValue.serverTimestamp(),
            read: false,
          });
          await auditRef.set({
            userId,
            type: 'payout_auto_dispatched',
            delta: 0,
            currency: 'diamonds',
            reference,
            gatewayRef: String(transferData.data.id),
            payoutMethod: 'flutterwave',
            timestamp: FieldValue.serverTimestamp(),
            ip: clientIp,
          });

          return NextResponse.json({
            success: true,
            status: 'completed',
            message: `Your payout of ${cleanCurrency} ${amountPaid.toLocaleString()} has been approved and sent to your bank account!`,
          });
        } else {
          // Gateway returned an error — keep safely in pending_review so Admin or 26h worker can dispatch
          await payoutRef.update({
            status: 'pending_review',
            lastError: transferData.message || 'Gateway transfer queued for review',
          });
        }
      } catch (autoErr: any) {
        await payoutRef.update({
          status: 'pending_review',
          lastError: autoErr.message || 'Auto-dispatch network fallback',
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      status: 'pending_review',
      message: needsManualReview
        ? `Your payout request of ${cleanCurrency} ${amountPaid.toLocaleString()} (≥ ₦5,000,000 threshold) is queued for high-value security verification.`
        : `Your payout request of ${cleanCurrency} ${amountPaid.toLocaleString()} has been submitted and is being processed.`,
    });

  } catch (error: any) {
    console.error('Flutterwave payout queue error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
