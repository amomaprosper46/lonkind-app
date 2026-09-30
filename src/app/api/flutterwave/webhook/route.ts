import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';

const FLW_WEBHOOK_HASH = process.env.FLW_WEBHOOK_HASH!;

/**
 * POST: Flutterwave Webhook Handler
 *
 * Receives server-to-server transfer result notifications from Flutterwave.
 * Secured by:
 *  - Secret hash verification (verif-hash header must match FLW_WEBHOOK_HASH env var)
 *  - Idempotency check (each webhook tx_ref stored in webhookLogs)
 *
 * Configure in Flutterwave Dashboard → Settings → Webhooks:
 *   URL: https://lonkind.com/api/flutterwave/webhook
 *   Secret Hash: set the same value as FLW_WEBHOOK_HASH in .env.local
 */
export async function POST(req: NextRequest) {
  try {
    // ── Flutterwave Secret Hash Verification ─────────────────────
    // Flutterwave sends the secret hash you configure in their dashboard
    const verifHash = req.headers.get('verif-hash') || '';
    if (!FLW_WEBHOOK_HASH || verifHash !== FLW_WEBHOOK_HASH) {
      console.warn('[Flutterwave Webhook] Invalid verif-hash — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    // ─────────────────────────────────────────────────────────────

    const payload = await req.json();
    const { event, data } = payload;

    if (!data?.reference && !data?.tx_ref) {
      return NextResponse.json({ received: true }); // Ignore malformed payloads
    }

    const txRef = (data.reference || data.tx_ref || '').replace('_exec', '');

    // ── Idempotency: skip already-processed webhooks ─────────────
    const webhookLogRef = db.collection('webhookLogs').doc(`flw_${txRef}`);
    const alreadyProcessed = await webhookLogRef.get();
    if (alreadyProcessed.exists) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await webhookLogRef.set({
      event,
      reference: txRef,
      processedAt: FieldValue.serverTimestamp(),
    });
    // ─────────────────────────────────────────────────────────────

    const payoutRef = db.collection('payoutRequests').doc(txRef);
    const payoutSnap = await payoutRef.get();

    if (!payoutSnap.exists) {
      console.info(`[Flutterwave Webhook] ${event} — no matching payoutRequest for ${txRef}`);
      return NextResponse.json({ received: true });
    }

    const payoutData = payoutSnap.data()!;
    const userRef = db.collection('users').doc(payoutData.userId);
    const auditRef = db.collection('wallet_audit_logs').doc();

    const isSuccess =
      event === 'transfer.completed' ||
      (event === 'transfer' && data?.status === 'SUCCESSFUL');

    const isFailure =
      event === 'transfer.failed' ||
      (event === 'transfer' && data?.status === 'FAILED') ||
      event === 'transfer.reversed';

    if (isSuccess) {
      // ── Transfer confirmed by Flutterwave ───────────────────────
      await db.runTransaction(async (tx) => {
        tx.update(payoutRef, {
          status: 'completed',
          flutterwaveTransferId: data.id || null,
          webhookConfirmedAt: FieldValue.serverTimestamp(),
        });
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
          type: 'payout_approved',
          amount: payoutData.amount,
          currency: payoutData.currency || 'NGN',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
        tx.set(auditRef, {
          userId: payoutData.userId,
          type: 'payout_confirmed',
          delta: 0,
          currency: 'diamonds',
          reference: txRef,
          gatewayRef: String(data.id || txRef),
          payoutMethod: 'flutterwave',
          timestamp: FieldValue.serverTimestamp(),
          ip: 'flutterwave-webhook',
        });
      });

    } else if (isFailure) {
      // ── Transfer failed — refund diamonds to creator ────────────
      await db.runTransaction(async (tx) => {
        tx.update(payoutRef, {
          status: 'failed',
          failureReason: data?.complete_message || event,
          webhookFailedAt: FieldValue.serverTimestamp(),
        });
        tx.update(userRef, {
          diamonds: FieldValue.increment(payoutData.diamondAmount || 0),
        });
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
          type: 'payout_rejected',
          amount: payoutData.amount,
          currency: payoutData.currency || 'NGN',
          reason: 'Payment gateway declined the transfer. Your diamonds have been refunded.',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
        tx.set(auditRef, {
          userId: payoutData.userId,
          type: 'payout_refund',
          delta: payoutData.diamondAmount || 0,
          currency: 'diamonds',
          reference: txRef,
          gatewayRef: String(data.id || txRef),
          payoutMethod: 'flutterwave',
          timestamp: FieldValue.serverTimestamp(),
          ip: 'flutterwave-webhook',
        });
      });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('[Flutterwave Webhook] Error:', error);
    // Always return 200 — Flutterwave retries on non-2xx responses
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
