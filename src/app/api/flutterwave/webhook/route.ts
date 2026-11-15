import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

const FLW_WEBHOOK_HASH =
  process.env.FLW_WEBHOOK_HASH ||
  process.env.FLUTTERWAVE_SECRET_HASH ||
  process.env.FLW_SECRET_HASH ||
  process.env.FLUTTERWAVE_SECRET_KEY;

/**
 * POST: Flutterwave Webhook Handler (ACID Double-Entry Ledger)
 */
export async function POST(req: NextRequest) {
  try {
    const verifHash = req.headers.get('verif-hash') || req.headers.get('verif_hash') || '';

    if (FLW_WEBHOOK_HASH && verifHash && verifHash !== FLW_WEBHOOK_HASH) {
      console.warn('[Flutterwave Webhook] Invalid verif-hash — request rejected');
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
      const meta = data.meta || {};
      let userId = meta.userId;
      const coinAmount = meta.coinAmount ? Number(meta.coinAmount) : 0;

      if (!userId && txRef.startsWith('flw_tx_')) {
        const parts = txRef.split('_');
        if (parts.length >= 3) {
          userId = parts[2];
        }
      }

      if (userId && coinAmount > 0) {
        const txDocRef = db.collection('transactions').doc(txRef);
        const userRef = db.collection('users').doc(userId);
        const idempotencyKey = buildIdempotencyKey('coin_purchase_flutterwave', txRef);
        const idempotencyRef = db.collection('ledger_idempotency').doc(idempotencyKey);

        await db.runTransaction(async (tx) => {
          const [webhookSnap, idemSnap, existingTxSnap, userSnap] = await Promise.all([
            tx.get(webhookLogRef),
            tx.get(idempotencyRef),
            tx.get(txDocRef),
            tx.get(userRef),
          ]);

          if (webhookSnap.exists || idemSnap.exists || existingTxSnap.exists) return;

          const coinsBefore = Number(userSnap.data()?.coins || 0);
          const coinsAfter = coinsBefore + coinAmount;

          const legs: DoubleEntryLeg[] = [
            {
              accountId: 'EXTERNAL_GATEWAY_FLUTTERWAVE',
              accountKind: 'EXTERNAL_GATEWAY',
              asset: 'COINS',
              direction: 'DEBIT',
              amount: coinAmount,
              balanceBefore: coinAmount,
              balanceAfter: 0,
            },
            {
              accountId: userId,
              accountKind: 'USER',
              asset: 'COINS',
              direction: 'CREDIT',
              amount: coinAmount,
              balanceBefore: coinsBefore,
              balanceAfter: coinsAfter,
            },
          ];

          const { journalId } = commitDoubleEntryJournalInTx(db, tx, {
            journalType: 'COIN_PURCHASE',
            idempotencyKey,
            reference: txRef,
            actorUid: userId,
            description: `Flutterwave webhook coin purchase (${coinAmount} L) ref=${txRef}`,
            legs,
            metadata: {
              gateway: 'flutterwave_webhook',
              reference: txRef,
              flwTransactionId: data.id,
              amount: data.amount,
              currency: data.currency || 'NGN',
            },
          });

          tx.set(webhookLogRef, {
            event,
            reference: txRef,
            status: data?.status || 'successful',
            processedAt: FieldValue.serverTimestamp(),
          });

          tx.set(
            txDocRef,
            {
              id: txRef,
              journalId,
              userId,
              flutterwaveReference: txRef,
              flwTransactionId: data.id,
              amount: data.amount,
              currency: data.currency || 'NGN',
              coinsAdded: coinAmount,
              coinsBefore,
              coinsAfter,
              status: 'success',
              type: meta.purpose || 'coin_purchase',
              time: FieldValue.serverTimestamp(),
              source: 'flutterwave_webhook',
            },
            { merge: true }
          );

          tx.set(
            userRef,
            {
              coins: coinsAfter,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

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
