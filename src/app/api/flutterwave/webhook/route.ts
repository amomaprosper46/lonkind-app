import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';

const FLW_WEBHOOK_HASH =
  process.env.FLW_WEBHOOK_HASH ||
  process.env.FLUTTERWAVE_SECRET_HASH ||
  process.env.FLW_SECRET_HASH ||
  process.env.FLUTTERWAVE_SECRET_KEY;

/**
 * POST: Flutterwave Webhook Handler
 *
 * Receives server-to-server notifications from Flutterwave for:
 * 1. Coin Purchases (`charge.completed`) -> Credits Lonkind Coins to user balance
 * 2. Creator Payout Transfers (`transfer.completed` / `transfer.failed`) -> Updates payout status & refunds diamonds on failure
 *
 * Configure in Flutterwave Dashboard → Settings → Webhooks:
 *   URL: https://lonkind.com/api/flutterwave/webhook
 *   (or https://impactful-ideas.web.app/api/flutterwave/webhook)
 *   Secret Hash: set the same value as FLW_WEBHOOK_HASH in .env
 */
export async function POST(req: NextRequest) {
  try {
    // ── Flutterwave Secret Hash Verification ─────────────────────
    const verifHash = req.headers.get('verif-hash') || req.headers.get('verif_hash') || '';

    // If secret hash is set in env, verify it matches
    if (FLW_WEBHOOK_HASH && verifHash && verifHash !== FLW_WEBHOOK_HASH) {
      console.warn('[Flutterwave Webhook] Invalid verif-hash — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    // ─────────────────────────────────────────────────────────────

    const payload = await req.json();
    const { event, data } = payload;

    if (!data?.reference && !data?.tx_ref && !data?.id) {
      return NextResponse.json({ received: true }); // Ignore malformed payloads
    }

    const rawTxRef = data.reference || data.tx_ref || String(data.id);
    const txRef = rawTxRef.replace('_exec', '');

    // ── Idempotency: skip already-processed webhooks ─────────────
    const webhookLogRef = db.collection('webhookLogs').doc(`flw_${txRef}_${event}`);
    const alreadyProcessed = await webhookLogRef.get();
    if (alreadyProcessed.exists) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await webhookLogRef.set({
      event,
      reference: txRef,
      status: data?.status || 'unknown',
      processedAt: FieldValue.serverTimestamp(),
    });
    // ─────────────────────────────────────────────────────────────

    // =========================================================================
    // CASE 1: COIN PURCHASE (charge.completed)
    // =========================================================================
    if (event === 'charge.completed' && data?.status === 'successful') {
      const meta = data.meta || {};
      let userId = meta.userId;
      let coinAmount = meta.coinAmount ? Number(meta.coinAmount) : 0;

      // Fallback: Parse tx_ref if meta was not populated in webhook payload
      if (!userId && txRef.startsWith('flw_tx_')) {
        const parts = txRef.split('_');
        if (parts.length >= 3) {
          userId = parts[2];
        }
      }

      if (userId && coinAmount > 0) {
        const txDocRef = db.collection('transactions').doc(txRef);
        const existingTx = await txDocRef.get();

        if (!existingTx.exists) {
          await db.runTransaction(async (tx) => {
            // Record transaction
            tx.set(txDocRef, {
              userId,
              flutterwaveReference: txRef,
              flwTransactionId: data.id,
              amount: data.amount,
              currency: data.currency || 'NGN',
              coinsAdded: coinAmount,
              status: 'success',
              type: meta.purpose || 'coin_purchase',
              time: FieldValue.serverTimestamp(),
              source: 'flutterwave_webhook',
            });

            // Credit coins to user profile balance
            const userRef = db.collection('users').doc(userId);
            tx.update(userRef, {
              coins: FieldValue.increment(coinAmount),
            });

            // Add notification
            const notifRef = userRef.collection('notifications').doc();
            tx.set(notifRef, {
              type: 'coins_purchased',
              coins: coinAmount,
              amount: data.amount,
              currency: data.currency || 'NGN',
              timestamp: FieldValue.serverTimestamp(),
              read: false,
            });
          });

          console.info(`[Flutterwave Webhook] Successfully credited ${coinAmount} coins to user ${userId} for txRef ${txRef}`);
        }
      }

      return NextResponse.json({ received: true, credited: true });
    }

    // =========================================================================
    // CASE 2: CREATOR PAYOUT TRANSFERS (transfer.completed / transfer.failed)
    // =========================================================================
    const payoutRef = db.collection('payoutRequests').doc(txRef);
    const payoutSnap = await payoutRef.get();

    if (payoutSnap.exists) {
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
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('[Flutterwave Webhook] Error:', error);
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
