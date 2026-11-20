import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb as db, adminAuth } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { commitDoubleEntryJournalInTx, DoubleEntryLeg } from '@/lib/ledger';
import { assertEmailVerifiedForAction } from '@/lib/email-verification-gate';

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
 * POST: Process a Tiered Payout Request
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

    // Require verified email before unlocking creator payouts (phone-only users unaffected)
    const verificationGate = await assertEmailVerifiedForAction(userId, 'creator payouts');
    if (!verificationGate.allowed) {
      return NextResponse.json({ error: verificationGate.error }, { status: 403 });
    }

    const body = await req.json();
    const { diamondAmount, amountNaira, bankCode, accountNumber, accountName, currency = 'NGN' } = body;
    const cleanCurrency = currency.toUpperCase();
    const rate = DIAMOND_PAYOUT_RATE[cleanCurrency] || DIAMOND_PAYOUT_RATE['NGN'];

    if ((!diamondAmount && !amountNaira) || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required payout fields.' }, { status: 400 });
    }

    const requiredDiamonds = Number(diamondAmount || Math.ceil(amountNaira / rate));
    const grossAmount = Number((requiredDiamonds * rate).toFixed(2));
    const platformFee = Number((grossAmount * 0.25).toFixed(2));
    const amountPaid = Number((grossAmount * 0.75).toFixed(2));
    const equivalentUsd = Number((requiredDiamonds * DIAMOND_PAYOUT_RATE['USD'] * 0.75).toFixed(2));
    const equivalentNaira = cleanCurrency === 'NGN' ? amountPaid : Number((requiredDiamonds * 15 * 0.75).toFixed(2));

    if (requiredDiamonds < MINIMUM_PAYOUT_DIAMONDS) {
      return NextResponse.json({
        error: `Minimum withdrawal is ${MINIMUM_PAYOUT_DIAMONDS.toLocaleString()} diamonds.`,
      }, { status: 400 });
    }

    // ── Fetch user doc & Firebase Auth record for accurate creation time ──
    const [userDoc, authUserRecord] = await Promise.all([
      db.collection('users').doc(userId).get(),
      adminAuth.getUser(userId).catch(() => null),
    ]);
    const userRef = db.collection('users').doc(userId);
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    const userData = userDoc.data()!;

    let accountCreatedMs = 0;
    if (userData.createdAt?.toDate) {
      accountCreatedMs = userData.createdAt.toDate().getTime();
    } else if (typeof userData.createdAt === 'number') {
      accountCreatedMs = userData.createdAt;
    } else if (authUserRecord?.metadata?.creationTime) {
      accountCreatedMs = Date.parse(authUserRecord.metadata.creationTime);
    }
    const accountAgeHours = accountCreatedMs > 0 ? (Date.now() - accountCreatedMs) / 3_600_000 : 720;
    if (accountAgeHours < 48 && userData.role !== 'admin' && !userData.isVerified) {
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
    if (todayTotal + requiredDiamonds > userTier.dailyCapDiamonds) {
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

    // ── Atomic Transaction: verify → double-entry journal → deduct exact balance → record ──
    try {
      await db.runTransaction(async (tx) => {
        // Re-read balance & idempotency INSIDE transaction — eliminates race condition
        const [freshUserSnap, existingKey] = await Promise.all([
          tx.get(userRef),
          tx.get(idempotencyRef),
        ]);
        const currentDiamonds = Number(freshUserSnap.data()?.diamonds || 0);

        if (currentDiamonds < requiredDiamonds) {
          throw new Error(
            `Insufficient diamonds. You have ${currentDiamonds.toLocaleString()} but need ${requiredDiamonds.toLocaleString()}.`
          );
        }

        if (existingKey.exists) throw new Error('DUPLICATE_REQUEST');

        const diamondsAfter = currentDiamonds - requiredDiamonds;

        const legs: DoubleEntryLeg[] = [
          {
            accountId: userId,
            accountKind: 'USER',
            asset: 'DIAMONDS',
            direction: 'DEBIT',
            amount: requiredDiamonds,
            balanceBefore: currentDiamonds,
            balanceAfter: diamondsAfter,
          },
          {
            accountId: 'LONKIND_PAYOUT_ESCROW_DIAMONDS',
            accountKind: 'SYSTEM_ESCROW',
            asset: 'DIAMONDS',
            direction: 'CREDIT',
            amount: requiredDiamonds,
            balanceBefore: 0,
            balanceAfter: requiredDiamonds,
          },
        ];

        const { journalId } = commitDoubleEntryJournalInTx(db, tx, {
          journalType: 'PAYOUT_ESCROW_HOLD',
          idempotencyKey: `payout_hold_${idempotencyKey}`,
          reference,
          actorUid: userId,
          description: `Paystack payout escrow hold (${requiredDiamonds} diamonds -> ${cleanCurrency} ${amountPaid})`,
          legs,
          metadata: {
            payoutMethod: 'paystack',
            amount: amountPaid,
            currency: cleanCurrency,
            ip: clientIp,
          },
        });

        // Lock the payout idempotency slot
        tx.set(idempotencyRef, {
          userId,
          reference,
          journalId,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Write payout record
        tx.set(payoutRef, {
          id: reference,
          journalId,
          userId,
          amount: amountPaid,
          grossAmount,
          platformFee,
          amountNaira: equivalentNaira,
          currency: cleanCurrency,
          diamondAmount: requiredDiamonds,
          diamondsBefore: currentDiamonds,
          diamondsAfter,
          bankCode,
          accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'),
          rawAccountNumber: accountNumber,
          accountName,
          reference,
          payoutMethod: 'paystack',
          status: payoutStatus,
          createdAt: FieldValue.serverTimestamp(),
          ip: clientIp,
        });

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
        // 1. Create transfer recipient on Paystack
        const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: cleanCurrency === 'NGN' ? 'nuban' : 'basa',
            name: accountName,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: cleanCurrency,
          }),
        });
        const recipientData = await recipientRes.json();

        if (recipientData.status && recipientData.data?.recipient_code) {
          // 2. Initiate transfer
          const transferRes = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source: 'balance',
              amount: Math.round(amountPaid * 100),
              reference: `${reference}_exec`,
              recipient: recipientData.data.recipient_code,
              reason: 'Lonkind Creator Payout',
            }),
          });
          const transferData = await transferRes.json();

          if (transferData.status && transferData.data) {
            await payoutRef.update({
              status: 'completed',
              autoExecutedAt: FieldValue.serverTimestamp(),
              paystackTransferCode: transferData.data.transfer_code,
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
              gatewayRef: String(transferData.data.transfer_code || ''),
              payoutMethod: 'paystack',
              timestamp: FieldValue.serverTimestamp(),
              ip: clientIp,
            });

            return NextResponse.json({
              success: true,
              status: 'completed',
              message: `Your payout of ${cleanCurrency} ${amountPaid.toLocaleString()} has been approved and sent to your bank account!`,
            });
          } else {
            await payoutRef.update({
              status: 'pending_review',
              lastError: transferData.message || 'Paystack transfer queued for review',
            });
          }
        } else {
          await payoutRef.update({
            status: 'pending_review',
            lastError: recipientData.message || 'Recipient creation queued for review',
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
