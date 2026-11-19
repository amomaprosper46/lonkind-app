import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';
import crypto from 'crypto';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';
import { settleCoinPurchaseWithFirstTimeBonus } from '@/lib/first-purchase-bonus';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

/**
 * POST: Paystack Webhook Handler (ACID Double-Entry Ledger)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    const expectedSig = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (!signature || signature !== expectedSig) {
      console.warn('[Paystack Webhook] Invalid signature — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    if (!data?.reference) {
      return NextResponse.json({ received: true });
    }

    const webhookLogRef = db.collection('webhookLogs').doc(`ps_${data.reference}_${event}`);

    // =========================================================================
    // CASE 1: COIN PURCHASE (`charge.success`)
    // =========================================================================
    if (event === 'charge.success' && data?.status === 'success') {
      const reference = String(data.reference);
      const meta = data.metadata || {};
      let userId = meta.userId;
      let numCoins = Number(meta.coinAmount || meta.coins || 0);
      const amountPaid = Number(data.amount || 0) / 100;
      const currency = (data.currency || 'NGN').toUpperCase();

      if (!userId || !numCoins) {
        const pendingSnap = await db.collection('transactions').doc(reference).get();
        if (pendingSnap.exists) {
          const p = pendingSnap.data() || {};
          if (!userId && p.userId) userId = p.userId;
          if (!numCoins && p.coinsAdded) numCoins = Number(p.coinsAdded);
        }
      }

      if (userId && numCoins > 0) {
        await settleCoinPurchaseWithFirstTimeBonus(db, {
          gateway: 'paystack',
          providerTransactionId: String(data.id || reference),
          reference,
          userId,
          baseCoins: numCoins,
          amountPaid,
          currency,
          purpose: 'coin_purchase',
          source: 'paystack_webhook',
          webhookLogDocId: `ps_${data.reference}_${event}`,
          webhookEvent: event,
        });
      }

      return NextResponse.json({ received: true, credited: true });
    }

    const payoutId = String(data.reference).replace('_exec', '');
    const payoutRef = db.collection('payoutRequests').doc(payoutId);

    if (event === 'transfer.success') {
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
        const idempotencyKey = buildIdempotencyKey('payout_settled_ps', payoutId);

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
              accountId: 'EXTERNAL_GATEWAY_PAYSTACK',
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
            reference: payoutId,
            actorUid: payoutData.userId,
            description: `Paystack transfer settled for payout ${payoutId}`,
            legs,
            metadata: { transferCode: data.transfer_code || null, event },
          });
        }

        tx.set(webhookLogRef, {
          event,
          reference: data.reference,
          processedAt: FieldValue.serverTimestamp(),
        });

        tx.update(payoutRef, {
          status: 'completed',
          paystackTransferCode: data.transfer_code || null,
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
    } else if (event === 'transfer.failed' || event === 'transfer.reversed') {
      await db.runTransaction(async (tx) => {
        const [webhookSnap, payoutSnap] = await Promise.all([
          tx.get(webhookLogRef),
          tx.get(payoutRef),
        ]);
        if (webhookSnap.exists || !payoutSnap.exists) return;

        const payoutData = payoutSnap.data()!;
        // Guard against double-refund if already failed/rejected
        if (['failed', 'rejected', 'cancelled'].includes(payoutData.status)) return;

        const userRef = db.collection('users').doc(payoutData.userId);
        const userSnap = await tx.get(userRef);
        const diamondsBefore = Number(userSnap.data()?.diamonds || 0);
        const refundDiamonds = Number(payoutData.diamondAmount || 0);
        const diamondsAfter = diamondsBefore + refundDiamonds;
        const idempotencyKey = buildIdempotencyKey('payout_refund_ps', payoutId);

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
            reference: payoutId,
            actorUid: payoutData.userId,
            description: `Paystack transfer failed/reversed — refunded ${refundDiamonds} diamonds`,
            legs,
            metadata: { reason: data.reason || event, event },
          });
        }

        tx.set(webhookLogRef, {
          event,
          reference: data.reference,
          processedAt: FieldValue.serverTimestamp(),
        });

        tx.update(payoutRef, {
          status: 'failed',
          failureReason: data.reason || event,
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
    console.error('[Paystack Webhook] Error:', error);
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
