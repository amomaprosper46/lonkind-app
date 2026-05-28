import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────────
//  PAYSTACK WEBHOOK HANDLER
//  URL to register on Paystack dashboard:
//  https://impactful-ideas.web.app/api/paystack/webhook
//
//  HOW IT WORKS:
//  1. User pays on Paystack
//  2. Paystack sends a POST to this URL (server-to-server, invisible)
//  3. We verify the signature using HMAC SHA512 + our secret key
//  4. If valid → credit coins to user in Firestore
//  5. Respond 200 immediately so Paystack knows we got it
// ─────────────────────────────────────────────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

import * as admin from 'firebase-admin';

function getAdminDb() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
        const sa = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(sa) });
      } else {
        admin.initializeApp();
      }
    } catch (e) {
      console.error("Firebase Admin initialization error:", e);
    }
  }
  return admin.firestore();
}

// ── Idempotent coin crediting (safe to call multiple times) ──────
async function creditCoinsForPayment(
  db: FirebaseFirestore.Firestore,
  reference: string,
  userId: string,
  coinAmount: number,
  amountNaira: number,
) {
  const txRef = db.collection('transactions').doc(reference);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(txRef);

    // Already processed — Paystack retries webhooks, so this is expected
    if (existing.exists) {
      console.log(`[Webhook] Reference ${reference} already processed — skipping`);
      return;
    }

    const userRef = db.collection('users').doc(userId);

    // Record the transaction
    transaction.set(txRef, {
      userId,
      paystackReference: reference,
      amountNaira,
      coinsAdded: coinAmount,
      status: 'success',
      type: 'coin_purchase',
      source: 'webhook',                  // Came from Paystack webhook (most secure)
      time: FieldValue.serverTimestamp(),
    });

    // Credit coins to user
    transaction.update(userRef, {
      coins: FieldValue.increment(coinAmount),
    });
  });
}

// ── Handle transfer success/failure for payouts ──────────────────
async function handleTransferEvent(
  db: FirebaseFirestore.Firestore,
  event: any,
) {
  const transfer = event.data;
  const reference = transfer.reference as string;

  // Find the payout request matching this reference
  const payoutSnap = await db.collection('payoutRequests')
    .where('paystackReference', '==', reference)
    .limit(1)
    .get();

  if (payoutSnap.empty) return;

  const payoutRef = payoutSnap.docs[0].ref;
  const payoutData = payoutSnap.docs[0].data();

  if (event.event === 'transfer.success') {
    await payoutRef.update({ status: 'completed', paystackStatus: 'success' });

    // Notify user
    await db.collection('users').doc(payoutData.userId)
      .collection('notifications').add({
        type: 'payout_completed',
        amountNaira: payoutData.amountNaira,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });

  } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
    // Refund the earnings back to the user
    await db.runTransaction(async (transaction) => {
      transaction.update(payoutRef, { status: 'failed', paystackStatus: transfer.status });

      const userRef = db.collection('users').doc(payoutData.userId);
      transaction.update(userRef, {
        earningsNaira: FieldValue.increment(payoutData.amountNaira),
        heldEarningsNaira: FieldValue.increment(-payoutData.amountNaira),
      });
    });

    // Notify user
    await db.collection('users').doc(payoutData.userId)
      .collection('notifications').add({
        type: 'payout_failed',
        amountNaira: payoutData.amountNaira,
        reason: transfer.reason || 'Transfer failed',
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
  }
}

// ── Main webhook handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  // STEP 1: Get the raw body as text (MUST be raw — parsing changes the bytes)
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  // STEP 2: Verify Paystack's HMAC SHA512 signature
  if (!signature || !PAYSTACK_SECRET_KEY) {
    console.warn('[Webhook] Missing signature or secret key');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const expectedHash = createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  let signatureValid = false;
  try {
    signatureValid = timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    // Buffer lengths differ = invalid signature
    signatureValid = false;
  }

  if (!signatureValid) {
    console.warn('[Webhook] Invalid Paystack signature — possible spoofing attempt');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  // STEP 3: Acknowledge immediately (Paystack needs 200 within 5 seconds)
  // We parse and process after responding
  const event = JSON.parse(rawBody);
  console.log(`[Webhook] Received event: ${event.event}`);

  // STEP 4: Process the event asynchronously
  const db = getAdminDb();

  try {
    if (event.event === 'charge.success') {
      // ── Coin purchase payment confirmed ──────────────────────
      const { metadata, amount, reference } = event.data;
      const { userId, coinAmount } = metadata || {};

      if (userId && coinAmount && reference) {
        await creditCoinsForPayment(
          db,
          reference,
          userId,
          Number(coinAmount),
          amount / 100, // kobo → naira
        );
        console.log(`[Webhook] ✅ Credited ${coinAmount} coins to user ${userId}`);
      } else {
        console.warn('[Webhook] charge.success missing metadata:', metadata);
      }

    } else if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event.event)) {
      // ── Payout transfer status update ────────────────────────
      await handleTransferEvent(db, event);
      console.log(`[Webhook] ✅ Handled ${event.event}`);
    } else {
      console.log(`[Webhook] Unhandled event type: ${event.event}`);
    }
  } catch (error) {
    // Log the error but still return 200 so Paystack doesn't retry infinitely
    // We handle retries ourselves via idempotency
    console.error('[Webhook] Processing error:', error);
  }

  return new NextResponse('OK', { status: 200 });
}
