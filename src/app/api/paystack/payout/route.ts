import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Payout Policy Constants ─────────────────────────────────────
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const MIN_WITHDRAWAL_NAIRA = 50_000;          // ₦50,000 minimum
const MAX_DAILY_PAYOUT_REQUESTS = 1;          // Max 1 per 24 hours
const ACCOUNT_AGE_DAYS_REQUIRED = 7;          // Account must be 7+ days old
const SUSPICIOUS_SINGLE_SENDER_PERCENT = 70;  // Flag if one sender = 70%+ of earnings
const LARGE_FIRST_PAYOUT_NAIRA = 10_000;      // Flag if first payout > ₦10k
const ALWAYS_REVIEW_ABOVE_NAIRA = 50_000;     // Always manual review above ₦50k
const MIN_POSTS_FOR_PAYOUT = 5;               // Must have at least 5 posts
const FAST_EARNINGS_DAYS = 30;                // If earned ₦5k+ in < 30 days old acct → flag

function getAdminDb() {
  if (!getApps().length) {
    try {
      const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
        : undefined;
      sa
        ? initializeApp({ credential: cert(sa) })
        : initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    } catch {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

// ─── Anti-Fraud Analyser ─────────────────────────────────────────
interface FraudCheck {
  flagged: boolean;
  reasons: string[];
}

// (Fraud checks removed because all payouts now require manual review)

// ─── POST: Request Payout ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured.' }, { status: 503 });
    }

    const body = await req.json();
    const { userId, amountNaira, bankCode, accountNumber, accountName } = body;

    if (!userId || !amountNaira || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (amountNaira < MIN_WITHDRAWAL_NAIRA) {
      return NextResponse.json({
        error: `Minimum withdrawal is ₦${MIN_WITHDRAWAL_NAIRA.toLocaleString()}. You requested ₦${amountNaira.toLocaleString()}.`,
      }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const currentEarnings = userData.earningsNaira || 0;

    if (currentEarnings < amountNaira) {
      return NextResponse.json({
        error: `Insufficient earnings. Your balance is ₦${currentEarnings.toLocaleString()} but you requested ₦${amountNaira.toLocaleString()}.`,
      }, { status: 400 });
    }

    // ── Rate limit: max 1 payout request per 24 hours ──
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

    // ── All payouts require manual review ──
    const reference = `payout_${userId}_${Date.now()}`;

    // Store for manual review
    await db.collection('payoutRequests').doc(reference).set({
      userId,
      amountNaira,
      bankCode,
      accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'), // mask
      accountName,
      reference,
      status: 'pending_review',
      createdAt: FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      // We must store the raw recipient details so the admin API can create the recipient
      rawAccountNumber: accountNumber, // Store securely for admin to execute
    });

    // Hold the earnings (deduct from balance, add to held)
    await userRef.update({
      earningsNaira: FieldValue.increment(-amountNaira),
      heldEarningsNaira: FieldValue.increment(amountNaira),
    });

    return NextResponse.json({
      success: true,
      status: 'pending_review',
      message: `Your payout request of ₦${amountNaira.toLocaleString()} has been submitted for manual review. Our team will process it soon.`,
    });

  } catch (error: any) {
    console.error('Payout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// ─── GET: Fetch Nigerian banks list ──────────────────────────────
export async function GET() {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured.' }, { status: 503 });
    }
    const res = await fetch('https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100', {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();
    if (!data.status) return NextResponse.json({ error: 'Could not fetch banks.' }, { status: 400 });
    return NextResponse.json({ banks: data.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
