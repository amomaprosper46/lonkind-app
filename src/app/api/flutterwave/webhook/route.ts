import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';
import { settleCoinPurchaseWithFirstTimeBonus } from '@/lib/first-purchase-bonus';
import {
  getClientIp,
  verifyWebhookSignatureTimingSafe,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLW_WEBHOOK_HASH =
  process.env.FLW_WEBHOOK_HASH ||
  process.env.FLUTTERWAVE_SECRET_HASH ||
  process.env.FLW_SECRET_HASH ||
  '';

/**
 * POST: Flutterwave Webhook Handler (ACID Double-Entry Ledger)
 */
export async function POST(req: NextRequest) {
  try {
    const verifHash = req.headers.get('verif-hash') || req.headers.get('verif_hash') || '';

    // Strict constant-time webhook signature verification (`crypto.timingSafeEqual`)
    if (
      !FLW_WEBHOOK_HASH ||
      !verifHash ||
      !verifyWebhookSignatureTimingSafe(verifHash, FLW_WEBHOOK_HASH)
    ) {
      console.warn('[Flutterwave Webhook] Missing or invalid verif-hash — request rejected');
      await writeSecurityAuditLog({
        action: 'webhook_signature_rejected',
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || '',
        status: 'blocked',
        details: { endpoint: '/api/flutterwave/webhook', hasHeader: Boolean(verifHash) },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = await req.json();
    const { event, data } = payload;

    if (!data?.reference && !data?.tx_ref && !data?.id) {
      return NextResponse.json({ received: true });
    }

    const rawTxRef = data.reference || data.tx_ref || String(data.id);
    const txRef = String(rawTxRef).replace('_exec', '');
    const webhookLogRef = db.collection('webhookLogs').doc(`flw_${txRef}_${event}`);

    // =========================================================================
    // CASE 1: COIN PURCHASE (charge.completed)
    // =========================================================================
    if (event === 'charge.completed' && data?.status === 'successful') {
      // Server-to-server verification with Flutterwave API so unverified webhooks cannot forge credits
      let verifiedData = data;
      if (FLW_SECRET_KEY && data?.id) {
        try {
          const vRes = await fetch(
            `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(data.id))}/verify`,
            {
              headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
            }
          );
          const vJson = await vRes.json();
          if (vJson.status !== 'success' || vJson.data?.status !== 'successful') {
            return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 });
          }
          verifiedData = vJson.data;
        } catch (vErr) {
          console.warn('[Flutterwave Webhook] Verify call fallback:', vErr);
        }
      }

      const meta = verifiedData.meta || data.meta || {};
      let userId = meta.userId;
      let coinAmount = Number(meta.coinAmount || meta.coins || 0);

      if (!userId && txRef.startsWith('flw_tx_')) {
        const parts = txRef.split('_');
        if (parts.length >= 3) {
          userId = parts[2];
        }
      }

      if (!userId || !coinAmount) {
        const pendingSnap = await db.collection('transactions').doc(txRef).get();
        if (pendingSnap.exists) {
          const p = pendingSnap.data() || {};
          if (!userId && p.userId) userId = p.userId;
          if (!coinAmount && p.coinsAdded) coinAmount = Number(p.coinsAdded);
        }
      }

      if (userId && coinAmount > 0) {
        await settleCoinPurchaseWithFirstTimeBonus(db, {
          gateway: 'flutterwave',
          providerTransactionId: String(verifiedData.id || data.id || txRef),
          reference: txRef,
          userId,
          baseCoins: coinAmount,
          amountPaid: Number(verifiedData.amount || data.amount || 0),
          currency: String(verifiedData.currency || data.currency || 'NGN').toUpperCase(),
          purpose: meta.purpose || 'coin_purchase',
          source: 'flutterwave_webhook',
          webhookLogDocId: `flw_${txRef}_${event}`,
          webhookEvent: event,
        });
      }

      return NextResponse.json({ received: true, credited: true });
    }

    // =========================================================================
    // CASE 2: CREATOR PAYOUT TRANSFERS (transfer.completed / transfer.failed)
    // =========================================================================
    const payoutRef = db.collection('payoutRequests').doc(txRef);

    const isSuccess =
      event === 'transfer.completed' ||
      (event === 'transfer' && data?.status === 'SUCCESSFUL');

    const isFailure =
      event === 'transfer.failed' ||
      (event === 'transfer' && data?.status === 'FAILED') ||
      event === 'transfer.reversed';

    if (isSuccess) {
      await db.runTransaction(async (tx) => {
        const [webhookSnap, payoutSnap] = await Promise.all([
          tx.get(webhookLogRef),
          tx.get(payoutRef),
        ]);
        if (webhookSnap.exists || !payoutSnap.exists) return;

        const payoutData = payoutSnap.data()!;
        if (payoutData.status === 'completed') return;

        const userRef = db.collection('users').doc(payoutData.userId);
        const diamondAmount = Number(payoutData.diamondAmount || 0);
        const idempotencyKey = buildIdempotencyKey('payout_settled_flw', txRef);

        if (diamondAmount > 0) {
          const legs: DoubleEntryLeg[] = [
            {
              accountId: 'LONKIND_PAYOUT_ESCROW_DIAMONDS',
              accountKind: 'SYSTEM_ESCROW',
              asset: 'DIAMONDS',
              direction: 'DEBIT',
              amount: diamondAmount,
              balanceBefore: diamondAmount,
              balanceAfter: 0,
            },
            {
              accountId: 'EXTERNAL_GATEWAY_FLUTTERWAVE',
              accountKind: 'EXTERNAL_GATEWAY',
              asset: 'DIAMONDS',
              direction: 'CREDIT',
              amount: diamondAmount,
              balanceBefore: 0,
              balanceAfter: diamondAmount,
            },
          ];

          commitDoubleEntryJournalInTx(db, tx, {
            journalType: 'PAYOUT_SETTLED',
            idempotencyKey,
            reference: txRef,
            actorUid: payoutData.userId,
            description: `Flutterwave transfer settled for payout ${txRef}`,
            legs,
            metadata: { flutterwaveTransferId: data.id || null, event },
          });
        }

        tx.set(webhookLogRef, {
          event,
          reference: txRef,
          status: data?.status || 'SUCCESSFUL',
          processedAt: FieldValue.serverTimestamp(),
        });

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
      });
    } else if (isFailure) {
      await db.runTransaction(async (tx) => {
        const [webhookSnap, payoutSnap] = await Promise.all([
          tx.get(webhookLogRef),
          tx.get(payoutRef),
        ]);
        if (webhookSnap.exists || !payoutSnap.exists) return;

        const payoutData = payoutSnap.data()!;
        if (['failed', 'rejected', 'cancelled'].includes(payoutData.status)) return;

        const userRef = db.collection('users').doc(payoutData.userId);
        const userSnap = await tx.get(userRef);
        const diamondsBefore = Number(userSnap.data()?.diamonds || 0);
        const refundDiamonds = Number(payoutData.diamondAmount || 0);
        const diamondsAfter = diamondsBefore + refundDiamonds;
        const idempotencyKey = buildIdempotencyKey('payout_refund_flw', txRef);

        if (refundDiamonds > 0) {
          const legs: DoubleEntryLeg[] = [
            {
              accountId: 'LONKIND_PAYOUT_ESCROW_DIAMONDS',
              accountKind: 'SYSTEM_ESCROW',
              asset: 'DIAMONDS',
              direction: 'DEBIT',
              amount: refundDiamonds,
              balanceBefore: refundDiamonds,
              balanceAfter: 0,
            },
            {
              accountId: payoutData.userId,
              accountKind: 'USER',
              asset: 'DIAMONDS',
              direction: 'CREDIT',
              amount: refundDiamonds,
              balanceBefore: diamondsBefore,
              balanceAfter: diamondsAfter,
            },
          ];

          commitDoubleEntryJournalInTx(db, tx, {
            journalType: 'PAYOUT_REFUND',
            idempotencyKey,
            reference: txRef,
            actorUid: payoutData.userId,
            description: `Flutterwave transfer failed — refunded ${refundDiamonds} diamonds`,
            legs,
            metadata: { failureReason: data?.complete_message || event, event },
          });
        }

        tx.set(webhookLogRef, {
          event,
          reference: txRef,
          status: data?.status || 'FAILED',
          processedAt: FieldValue.serverTimestamp(),
        });

        tx.update(payoutRef, {
          status: 'failed',
          failureReason: data?.complete_message || event,
          webhookFailedAt: FieldValue.serverTimestamp(),
        });

        tx.update(userRef, {
          diamonds: diamondsAfter,
          updatedAt: FieldValue.serverTimestamp(),
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
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Flutterwave Webhook] Error:', error);
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
