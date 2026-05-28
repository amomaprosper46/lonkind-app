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

async function runFraudChecks(
  db: FirebaseFirestore.Firestore,
  userId: string,
  amountNaira: number,
  userData: FirebaseFirestore.DocumentData,
): Promise<FraudCheck> {
  const reasons: string[] = [];

  // 1. Account age check
  const createdAt: Timestamp | undefined = userData.createdAt;
  const accountAgeMs = createdAt
    ? Date.now() - createdAt.toMillis()
    : Date.now(); // treat unknown as just created
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

  if (accountAgeDays < ACCOUNT_AGE_DAYS_REQUIRED) {
    reasons.push(`Account is only ${Math.floor(accountAgeDays)} days old (minimum ${ACCOUNT_AGE_DAYS_REQUIRED} days).`);
  }

  // 2. Fast earnings — young account with large earnings
  if (accountAgeDays < FAST_EARNINGS_DAYS && amountNaira >= 5_000) {
    reasons.push(`Large withdrawal (₦${amountNaira.toLocaleString()}) on account only ${Math.floor(accountAgeDays)} days old.`);
  }

  // 3. Large amount — always flag above threshold
  if (amountNaira >= ALWAYS_REVIEW_ABOVE_NAIRA) {
    reasons.push(`High-value withdrawal of ₦${amountNaira.toLocaleString()} requires manual review.`);
  }

  // 4. Minimum posts check
  let postCount = 0;
  try {
    const postsQuery = db.collection('posts').where('author.uid', '==', userId).limit(MIN_POSTS_FOR_PAYOUT + 1);
    const postsSnap = await postsQuery.get();
    postCount = postsSnap.size;
  } catch (_) {}

  if (postCount < MIN_POSTS_FOR_PAYOUT) {
    reasons.push(`Account has only ${postCount} post(s) — must have at least ${MIN_POSTS_FOR_PAYOUT} to withdraw.`);
  }

  // 5. Check if first-ever payout
  const prevPayouts = await db.collection('payoutRequests')
    .where('userId', '==', userId)
    .where('status', 'in', ['approved', 'completed'])
    .limit(1)
    .get();

  const isFirstPayout = prevPayouts.empty;
  if (isFirstPayout && amountNaira >= LARGE_FIRST_PAYOUT_NAIRA) {
    reasons.push(`First-ever payout is ₦${amountNaira.toLocaleString()} — flagged for review.`);
  }

  // 6. Single-sender concentration check (self-gifting detection)
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const giftsSnap = await db.collection('gifts')
      .where('toUser', '==', userId)
      .where('time', '>=', Timestamp.fromDate(thirtyDaysAgo))
      .get();

    if (giftsSnap.size > 0) {
      // Count total naira and per-sender naira
      const senderTotals = new Map<string, number>();
      let totalNaira = 0;

      giftsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const sender = data.fromUser as string;
        const value = data.nairaValue as number || 0;
        senderTotals.set(sender, (senderTotals.get(sender) || 0) + value);
        totalNaira += value;
      });

      if (totalNaira > 0) {
        const topSenderNaira = Math.max(...senderTotals.values());
        const topSenderPercent = (topSenderNaira / totalNaira) * 100;
        if (topSenderPercent >= SUSPICIOUS_SINGLE_SENDER_PERCENT) {
          reasons.push(`${Math.round(topSenderPercent)}% of recent earnings came from a single user — possible self-gifting.`);
        }
      }
    }
  } catch (_) {}

  return { flagged: reasons.length > 0, reasons };
}

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

    // ── Run anti-fraud checks ──
    const fraudCheck = await runFraudChecks(db, userId, amountNaira, userData);
    const reference = `payout_${userId}_${Date.now()}`;

    if (fraudCheck.flagged) {
      // Store for manual review — do NOT transfer yet
      await db.collection('payoutRequests').doc(reference).set({
        userId,
        amountNaira,
        bankCode,
        accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'), // mask
        accountName,
        reference,
        status: 'pending_review',
        flagReasons: fraudCheck.reasons,
        createdAt: FieldValue.serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
      });

      // Hold the earnings (deduct from balance, add to held)
      await userRef.update({
        earningsNaira: FieldValue.increment(-amountNaira),
        heldEarningsNaira: FieldValue.increment(amountNaira),
      });

      return NextResponse.json({
        success: true,
        status: 'pending_review',
        message: `Your payout request of ₦${amountNaira.toLocaleString()} has been submitted for manual review. Our team will process it within 1–3 business days.`,
        flagReasons: fraudCheck.reasons,
      });
    }

    // ── Clean account: auto-process via Paystack ──
    // Step 1: Create transfer recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      return NextResponse.json({ error: recipientData.message || 'Failed to create transfer recipient.' }, { status: 400 });
    }

    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountNaira * 100, // kobo
        recipient: recipientCode,
        reason: `Lonkind earnings payout for ${accountName}`,
        currency: 'NGN',
        reference,
      }),
    });

    const transferData = await transferRes.json();
    if (!transferData.status) {
      return NextResponse.json({ error: transferData.message || 'Transfer initiation failed.' }, { status: 400 });
    }

    // Step 3: Atomically deduct earnings and log the payout
    await db.runTransaction(async (transaction) => {
      transaction.update(userRef, {
        earningsNaira: FieldValue.increment(-amountNaira),
      });

      transaction.set(db.collection('payoutRequests').doc(reference), {
        userId,
        amountNaira,
        bankCode,
        accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'),
        accountName,
        recipientCode,
        paystackReference: reference,
        paystackStatus: transferData.data.status,
        status: transferData.data.status === 'success' ? 'completed' : 'pending',
        flagReasons: [],
        createdAt: FieldValue.serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
      });
    });

    return NextResponse.json({
      success: true,
      status: 'processing',
      message: `✅ Payout of ₦${amountNaira.toLocaleString()} is being processed. It will arrive in your bank account within 1–3 business days.`,
      reference,
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
