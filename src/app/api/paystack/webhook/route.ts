import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';
import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

/**
 * POST: Paystack Webhook Handler
 *
 * Receives server-to-server transfer result notifications from Paystack.
 * Secured by:
 *  - HMAC SHA512 signature verification (x-paystack-signature header)
 *  - Idempotency check (each webhook reference stored in webhookLogs)
 *
 * Configure in Paystack Dashboard → Settings → Webhooks:
 *   URL: https://lonkind.com/api/paystack/webhook
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    // ── HMAC SHA512 Signature Verification ───────────────────────
    // Reject any request not signed by Paystack's secret key
    const expectedSig = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (!signature || signature !== expectedSig) {
      console.warn('[Paystack Webhook] Invalid signature — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    // ─────────────────────────────────────────────────────────────

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    if (!data?.reference) {
      return NextResponse.json({ received: true }); // Ignore malformed payloads
    }

    // ── Idempotency: skip already-processed webhooks ─────────────
    const webhookLogRef = db.collection('webhookLogs').doc(`ps_${data.reference}`);
    const alreadyProcessed = await webhookLogRef.get();
    if (alreadyProcessed.exists) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Mark as processed immediately (before any DB writes to prevent races)
    await webhookLogRef.set({
      event,
      reference: data.reference,
      processedAt: FieldValue.serverTimestamp(),
    });
    // ─────────────────────────────────────────────────────────────

    // Strip the _exec suffix added during transfer initiation
    const payoutId = data.reference.replace('_exec', '');
    const payoutRef = db.collection('payoutRequests').doc(payoutId);
    const payoutSnap = await payoutRef.get();

    if (!payoutSnap.exists) {
      // Could be a coin-purchase transfer or unknown — log and acknowledge
      console.info(`[Paystack Webhook] ${event} — no matching payoutRequest for ${payoutId}`);
      return NextResponse.json({ received: true });
    }

    const payoutData = payoutSnap.data()!;
    const userRef = db.collection('users').doc(payoutData.userId);
    const auditRef = db.collection('wallet_audit_logs').doc();

    if (event === 'transfer.success') {
      // ── Transfer confirmed by Paystack ──────────────────────────
      await db.runTransaction(async (tx) => {
        tx.update(payoutRef, {
          status: 'completed',
          paystackTransferCode: data.transfer_code || null,
          webhookConfirmedAt: FieldValue.serverTimestamp(),
        });
        // Notify creator
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
          type: 'payout_approved',
          amount: payoutData.amount,
          currency: payoutData.currency || 'NGN',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
        // Audit log
        tx.set(auditRef, {
          userId: payoutData.userId,
          type: 'payout_confirmed',
          delta: 0,
          currency: 'diamonds',
          reference: payoutId,
          gatewayRef: data.transfer_code || data.reference,
          payoutMethod: 'paystack',
          timestamp: FieldValue.serverTimestamp(),
          ip: 'paystack-webhook',
        });
      });

    } else if (event === 'transfer.failed' || event === 'transfer.reversed') {
      // ── Transfer failed — refund diamonds to creator ────────────
      await db.runTransaction(async (tx) => {
        tx.update(payoutRef, {
          status: 'failed',
          failureReason: data.reason || event,
          webhookFailedAt: FieldValue.serverTimestamp(),
        });
        // Refund diamonds
        tx.update(userRef, {
          diamonds: FieldValue.increment(payoutData.diamondAmount || 0),
        });
        // Notify creator
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
          type: 'payout_rejected',
          amount: payoutData.amount,
          currency: payoutData.currency || 'NGN',
          reason: 'Payment gateway declined the transfer. Your diamonds have been refunded.',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
        // Audit log
        tx.set(auditRef, {
          userId: payoutData.userId,
          type: 'payout_refund',
          delta: payoutData.diamondAmount || 0,
          currency: 'diamonds',
          reference: payoutId,
          gatewayRef: data.reference,
          payoutMethod: 'paystack',
          timestamp: FieldValue.serverTimestamp(),
          ip: 'paystack-webhook',
        });
      });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('[Paystack Webhook] Error:', error);
    // Always return 200 to Paystack — they retry on non-2xx responses
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
