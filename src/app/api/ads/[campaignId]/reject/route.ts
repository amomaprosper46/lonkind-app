import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { commitDoubleEntryJournalInTx, type DoubleEntryLeg } from '@/lib/ledger';
import {
  executeFlutterwaveAdRefund,
  sendAdRefundEmailIfConfigured,
} from '@/lib/ad-flutterwave-refund';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ads/[campaignId]/reject
 * Super-Admin (`role === "super_admin"` / `@mow`) endpoint to reject a pending
 * promotion with a mandatory reason and execute an IDEMPOTENT refund:
 *  - Coin-paid ads: atomic coin refund (`type: "ad_refund"`, keyed by `ad_refund_<campaignId>`).
 *  - Flutterwave-paid ads: locks campaign with `refundStatus: "refund_processing"`, verifies
 *    `tx_ref` starts with `LONKIND_AD_`, calls Flutterwave `POST /v3/transactions/{id}/refund`,
 *    logs a negative `type: "ad_refund"` entry in `ad_revenue_ledger`, and falls back cleanly
 *    to `refundStatus: "manual_refund_required"` if the payment channel (e.g. Bank Transfer/USSD)
 *    does not support automated API refunds.
 */
export async function POST(
  req: NextRequest,
  context: { params: { campaignId: string } }
) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const campaignId = String(context?.params?.campaignId || '').trim();
    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId.' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const reason = String(body?.reason || '').trim().slice(0, 200);
    if (!reason) {
      return NextResponse.json(
        { error: 'Please select a rejection reason before rejecting and refunding.' },
        { status: 400 }
      );
    }

    const refundId = `ad_refund_${campaignId}`;
    const campRef = adminDb.collection('ad_campaigns').doc(campaignId);
    const idemRef = adminDb.collection('ad_refund_idempotency').doc(refundId);

    let alreadyRefunded = false;
    let refundedCoins = 0;
    let flutterwaveContext: {
      publisherUid: string;
      publisherName: string;
      publisherHandle: string;
      title: string;
      targetType: string;
      targetPostId: string | null;
      flutterwaveTransactionId: string;
      txRef: string;
      amountPaid: number;
      currencyPaid: string;
    } | null = null;

    await adminDb.runTransaction(async (tx) => {
      const [campSnap, idemSnap] = await Promise.all([
        tx.get(campRef),
        tx.get(idemRef),
      ]);

      if (!campSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const data = campSnap.data()!;
      const isFlutterwavePaid = data.paymentMethod === 'flutterwave';

      if (isFlutterwavePaid) {
        const currentRefundStatus = String(data.refundStatus || 'none');

        // Strict Idempotency Guards for Flutterwave refunds
        if (currentRefundStatus === 'refunded' || currentRefundStatus === 'refunded_manually') {
          alreadyRefunded = true;
          return;
        }
        if (currentRefundStatus === 'refund_processing') {
          throw new Error('REFUND_IN_PROGRESS');
        }

        const allowedStatuses = ['pending_review', 'pending_approval', 'rejected_refund_needed'];
        if (!allowedStatuses.includes(String(data.status || ''))) {
          throw new Error(`INVALID_STATUS:${data.status}`);
        }

        const txRef = String(data.flutterwaveTxRef || '').trim();
        if (!txRef.startsWith('LONKIND_AD_')) {
          throw new Error('INVALID_AD_TX_REF');
        }

        const flwTxId = String(data.flutterwaveTransactionId || '').trim();
        const amountPaid = Number(data.amountPaid || 0);
        const currencyPaid = String(data.currencyPaid || 'NGN').toUpperCase();

        if (!flwTxId || amountPaid <= 0) {
          throw new Error('MISSING_FLW_PAYMENT_DETAILS');
        }

        // Lock the campaign IMMEDIATELY with `refund_processing` before calling Flutterwave
        tx.update(campRef, {
          refundStatus: 'refund_processing',
          rejectionReason: reason,
          rejectedByAdminUid: authCheck.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(
          idemRef,
          {
            refundId,
            campaignId,
            publisherUid: String(data.publisherUid || ''),
            paymentMethod: 'flutterwave',
            flutterwaveTransactionId: flwTxId,
            txRef,
            amountPaid,
            currencyPaid,
            refundStatus: 'refund_processing',
            reason,
            processedBy: authCheck.uid,
            lockedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        flutterwaveContext = {
          publisherUid: String(data.publisherUid || ''),
          publisherName: String(data.publisherName || 'Creator'),
          publisherHandle: String(data.publisherHandle || ''),
          title: String(data.title || 'Sponsored Ad'),
          targetType: String(data.targetType || ''),
          targetPostId: data.targetPostId ? String(data.targetPostId) : null,
          flutterwaveTransactionId: flwTxId,
          txRef,
          amountPaid,
          currencyPaid,
        };
        return;
      }

      // --- Existing Coin-Paid Atomic Refund Flow (untouched) ---
      if (idemSnap.exists) {
        alreadyRefunded = true;
        refundedCoins = Number(idemSnap.data()?.coinsRefunded || 0);
        return;
      }

      if (data.status !== 'pending_review' && data.status !== 'pending_approval') {
        throw new Error(`INVALID_STATUS:${data.status}`);
      }

      const publisherUid = String(data.publisherUid || '');
      const coinsToRefund = Math.floor(Number(data.coinsSpent || 0));
      refundedCoins = coinsToRefund;

      let balanceBefore = 0;
      let balanceAfter = 0;

      if (publisherUid && coinsToRefund > 0) {
        const userRef = adminDb.collection('users').doc(publisherUid);
        const userSnap = await tx.get(userRef);
        if (userSnap.exists) {
          balanceBefore = Math.floor(Number(userSnap.data()?.coins || 0));
          balanceAfter = balanceBefore + coinsToRefund;

          // Credit back to non-cashable/promotional coin balance ONLY (never Diamonds/payouts)
          tx.update(userRef, {
            coins: balanceAfter,
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Record isolated `type: "ad_refund"` ledger transaction
          const txDocRef = adminDb.collection('transactions').doc(refundId);
          tx.set(txDocRef, {
            id: refundId,
            refundId,
            userId: publisherUid,
            type: 'ad_refund',
            status: 'completed',
            coins: coinsToRefund,
            amountCoins: coinsToRefund,
            campaignId,
            reason,
            withdrawable: false,
            countsTowardCreatorPayout: false,
            description: `Ad promotion rejected (${reason}) — ${coinsToRefund} Coins refunded`,
            time: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });

          // Commit zero-sum double-entry ledger journal (`AD_REFUND`)
          const legs: DoubleEntryLeg[] = [
            {
              accountId: 'LONKIND_AD_REVENUE_COINS',
              accountKind: 'SYSTEM_TREASURY',
              asset: 'COINS',
              direction: 'DEBIT',
              amount: coinsToRefund,
              balanceBefore: coinsToRefund,
              balanceAfter: 0,
            },
            {
              accountId: publisherUid,
              accountKind: 'USER',
              asset: 'COINS',
              direction: 'CREDIT',
              amount: coinsToRefund,
              balanceBefore,
              balanceAfter,
            },
          ];

          commitDoubleEntryJournalInTx(adminDb, tx, {
            journalType: 'AD_REFUND',
            idempotencyKey: refundId,
            reference: campaignId,
            actorUid: authCheck.uid,
            description: `Ad refund (${reason}): ${coinsToRefund} coins returned to ${publisherUid}`,
            legs,
            metadata: {
              type: 'ad_refund',
              refundId,
              campaignId,
              reason,
            },
          });
        }
      }

      tx.set(idemRef, {
        refundId,
        campaignId,
        publisherUid,
        coinsRefunded: coinsToRefund,
        reason,
        processedBy: authCheck.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(campRef, {
        status: 'rejected',
        refundStatus: 'refunded',
        rejectionReason: reason,
        refundId,
        rejectedByAdminUid: authCheck.uid,
        rejectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (data.targetType === 'post' && data.targetPostId) {
        tx.set(
          adminDb.collection('posts').doc(data.targetPostId),
          { promotionStatus: 'rejected' },
          { merge: true }
        );
      }

      if (publisherUid) {
        const notifRef = adminDb
          .collection('users')
          .doc(publisherUid)
          .collection('notifications')
          .doc();
        tx.set(notifRef, {
          type: 'ad_rejected',
          title: 'Promotion Not Approved — Coins Refunded',
          message: `Your promotion "${data.title || 'Post'}" was not approved (${reason}). ${coinsToRefund.toLocaleString()} Coins have been refunded to your wallet.`,
          campaignId,
          refundId,
          reason,
          read: false,
          timestamp: FieldValue.serverTimestamp(),
        });
      }
    });

    // --- Phase 2 & 3: Automated Flutterwave Refund Execution (outside Firestore lock TX) ---
    if (flutterwaveContext !== null) {
      const ctx = flutterwaveContext as {
        publisherUid: string;
        publisherName: string;
        publisherHandle: string;
        title: string;
        targetType: string;
        targetPostId: string | null;
        flutterwaveTransactionId: string;
        txRef: string;
        amountPaid: number;
        currencyPaid: string;
      };

      const flwResult = await executeFlutterwaveAdRefund({
        flutterwaveTransactionId: ctx.flutterwaveTransactionId,
        txRef: ctx.txRef,
        amount: ctx.amountPaid,
        reason,
      });

      // Fetch advertiser email if available for optional email notification
      let advertiserEmail: string | null = null;
      if (ctx.publisherUid) {
        const userSnap = await adminDb.collection('users').doc(ctx.publisherUid).get().catch(() => null);
        advertiserEmail = userSnap?.data()?.email || null;
      }

      const origLedgerRef = adminDb
        .collection('ad_revenue_ledger')
        .doc(ctx.flutterwaveTransactionId);
      const refundLedgerRef = adminDb
        .collection('ad_revenue_ledger')
        .doc(`refund_${ctx.flutterwaveTransactionId}`);

      if (flwResult.ok) {
        const batch = adminDb.batch();

        batch.update(campRef, {
          status: 'rejected',
          paymentStatus: 'refunded',
          refundStatus: 'refunded',
          flutterwaveRefundId: flwResult.flutterwaveRefundId,
          refundId: flwResult.flutterwaveRefundId,
          refundErrorMessage: null,
          rejectedAt: FieldValue.serverTimestamp(),
          refundedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        batch.set(
          idemRef,
          {
            refundStatus: 'refunded',
            flutterwaveRefundId: flwResult.flutterwaveRefundId,
            completedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Log negative entry in isolated `ad_revenue_ledger` (`type: "ad_refund"`)
        batch.set(refundLedgerRef, {
          id: `refund_${ctx.flutterwaveTransactionId}`,
          transactionId: ctx.flutterwaveTransactionId,
          txRef: ctx.txRef,
          type: 'ad_refund',
          provider: 'flutterwave',
          campaignId,
          payerUid: ctx.publisherUid,
          payerHandle: ctx.publisherHandle,
          amount: -Math.abs(ctx.amountPaid),
          currency: ctx.currencyPaid,
          status: 'refunded',
          refundStatus: 'refunded',
          flutterwaveRefundId: flwResult.flutterwaveRefundId,
          reason,
          processedByAdminUid: authCheck.uid,
          withdrawable: false,
          countsTowardCreatorPayout: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        batch.set(
          origLedgerRef,
          {
            refundStatus: 'refunded',
            flutterwaveRefundId: flwResult.flutterwaveRefundId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (ctx.targetType === 'post' && ctx.targetPostId) {
          batch.set(
            adminDb.collection('posts').doc(ctx.targetPostId),
            { promotionStatus: 'rejected' },
            { merge: true }
          );
        }

        if (ctx.publisherUid) {
          const notifRef = adminDb
            .collection('users')
            .doc(ctx.publisherUid)
            .collection('notifications')
            .doc();
          batch.set(notifRef, {
            type: 'ad_rejected',
            title: 'Ad Not Approved — Flutterwave Refund Processed',
            message: `Your ad "${ctx.title}" was not approved (${reason}). A full refund of ${ctx.currencyPaid} ${ctx.amountPaid.toLocaleString()} has been processed via Flutterwave (Ref: ${ctx.txRef} • Refund ID: ${flwResult.flutterwaveRefundId}).`,
            campaignId,
            txRef: ctx.txRef,
            refundId: flwResult.flutterwaveRefundId,
            reason,
            read: false,
            timestamp: FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();

        await sendAdRefundEmailIfConfigured({
          toEmail: advertiserEmail,
          advertiserName: ctx.publisherName,
          campaignTitle: ctx.title,
          reason,
          txRef: ctx.txRef,
          amount: ctx.amountPaid,
          currency: ctx.currencyPaid,
          refundStatus: 'refunded',
          refundId: flwResult.flutterwaveRefundId,
        });

        return NextResponse.json({
          success: true,
          campaignId,
          refundMode: 'flutterwave_auto',
          status: 'rejected',
          refundStatus: 'refunded',
          flutterwaveRefundId: flwResult.flutterwaveRefundId,
          flutterwaveTransactionId: ctx.flutterwaveTransactionId,
          txRef: ctx.txRef,
          amountRefunded: ctx.amountPaid,
          currency: ctx.currencyPaid,
        });
      }

      // Graceful fallback for channels like Bank Transfer / USSD that don't support instant API refunds
      const batch = adminDb.batch();

      batch.update(campRef, {
        status: 'rejected_refund_needed',
        paymentStatus: 'refund_needed',
        refundStatus: 'manual_refund_required',
        refundErrorMessage: flwResult.flutterwaveMessage,
        rejectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.set(
        idemRef,
        {
          refundStatus: 'manual_refund_required',
          refundErrorMessage: flwResult.flutterwaveMessage,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        origLedgerRef,
        {
          refundStatus: 'manual_refund_required',
          refundErrorMessage: flwResult.flutterwaveMessage,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (ctx.targetType === 'post' && ctx.targetPostId) {
        batch.set(
          adminDb.collection('posts').doc(ctx.targetPostId),
          { promotionStatus: 'rejected' },
          { merge: true }
        );
      }

      if (ctx.publisherUid) {
        const notifRef = adminDb
          .collection('users')
          .doc(ctx.publisherUid)
          .collection('notifications')
          .doc();
        batch.set(notifRef, {
          type: 'ad_rejected',
          title: 'Ad Not Approved — Manual Refund Queued',
          message: `Your ad "${ctx.title}" was not approved (${reason}). Because your payment method requires manual settlement, your full refund of ${ctx.currencyPaid} ${ctx.amountPaid.toLocaleString()} (Ref: ${ctx.txRef}) has been queued for manual processing.`,
          campaignId,
          txRef: ctx.txRef,
          reason,
          read: false,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      await sendAdRefundEmailIfConfigured({
        toEmail: advertiserEmail,
        advertiserName: ctx.publisherName,
        campaignTitle: ctx.title,
        reason,
        txRef: ctx.txRef,
        amount: ctx.amountPaid,
        currency: ctx.currencyPaid,
        refundStatus: 'manual_refund_required',
      });

      return NextResponse.json({
        success: true,
        campaignId,
        refundMode: 'flutterwave_manual_required',
        status: 'rejected_refund_needed',
        refundStatus: 'manual_refund_required',
        flutterwaveMessage: flwResult.flutterwaveMessage,
        flutterwaveTransactionId: ctx.flutterwaveTransactionId,
        txRef: ctx.txRef,
      });
    }

    return NextResponse.json({
      success: true,
      campaignId,
      refundMode: 'coins',
      refundId,
      coinsRefunded: refundedCoins,
      alreadyRefunded,
      status: 'rejected',
      refundStatus: 'refunded',
    });
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }
    if (err?.message === 'REFUND_IN_PROGRESS') {
      return NextResponse.json(
        { error: 'A refund for this campaign is already in progress. Please wait.' },
        { status: 409 }
      );
    }
    if (err?.message === 'INVALID_AD_TX_REF') {
      return NextResponse.json(
        { error: 'Safety block: transaction reference does not start with LONKIND_AD_.' },
        { status: 400 }
      );
    }
    if (err?.message === 'MISSING_FLW_PAYMENT_DETAILS') {
      return NextResponse.json(
        { error: 'Campaign is missing Flutterwave transaction_id or paid amount.' },
        { status: 400 }
      );
    }
    if (typeof err?.message === 'string' && err.message.startsWith('INVALID_STATUS:')) {
      return NextResponse.json(
        { error: `Campaign cannot be rejected from status: ${err.message.split(':')[1]}` },
        { status: 409 }
      );
    }
    console.error('[POST /api/ads/[campaignId]/reject] Error:', err);
    return NextResponse.json({ error: 'Unable to reject and refund promotion.' }, { status: 500 });
  }
}
