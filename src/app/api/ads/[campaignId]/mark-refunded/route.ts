import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { sendAdRefundEmailIfConfigured } from '@/lib/ad-flutterwave-refund';
import {
  admin2faRequiredResponse,
  checkAdminStepUpSession,
  extractAuditRequestMeta,
} from '@/lib/admin-2fa';
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ads/[campaignId]/mark-refunded
 * Super-Admin (`role === "super_admin"` / `@mow`) endpoint to mark a Flutterwave
 * `manual_refund_required` campaign as `"refunded_manually"` once settled in the
 * Flutterwave dashboard. Idempotently logs the negative `type: "ad_refund"` entry
 * in `ad_revenue_ledger` and notifies the advertiser.
 */
export async function POST(
  req: NextRequest,
  context: { params: { campaignId: string } }
) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const auditMeta = extractAuditRequestMeta(req);
  const rl = checkRateLimit({
    namespace: 'admin_ad_mark_refunded',
    key: authCheck.uid,
    ...RATE_LIMIT_PRESETS.ADMIN_SENSITIVE,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  const stepUp = await checkAdminStepUpSession(req, authCheck.uid);
  if (!stepUp.verified) {
    await writeSecurityAuditLog({
      action: 'admin_ad_manual_refund',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ...auditMeta,
      status: 'blocked',
      details: { campaignId: context?.params?.campaignId, reason: 'ADMIN_2FA_REQUIRED' },
    });
    return admin2faRequiredResponse(stepUp.reason);
  }

  await writeSecurityAuditLog({
    action: 'admin_ad_manual_refund',
    actorUid: authCheck.uid,
    actorHandle: authCheck.handle,
    ...auditMeta,
    status: 'success',
    details: { campaignId: context?.params?.campaignId },
  });

  try {
    const campaignId = String(context?.params?.campaignId || '').trim();
    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId.' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const manualRefInput = String(body?.manualRefundRef || '').trim().slice(0, 120);

    const campRef = adminDb.collection('ad_campaigns').doc(campaignId);
    const idemRef = adminDb.collection('ad_refund_idempotency').doc(`ad_refund_${campaignId}`);

    let emailContext: {
      publisherUid: string;
      publisherName: string;
      title: string;
      reason: string;
      txRef: string;
      amountPaid: number;
      currencyPaid: string;
      manualRefundId: string;
    } | null = null;
    let alreadyRefunded = false;

    await adminDb.runTransaction(async (tx) => {
      const campSnap = await tx.get(campRef);
      if (!campSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const data = campSnap.data()!;
      if (data.paymentMethod !== 'flutterwave') {
        throw new Error('NOT_FLUTTERWAVE');
      }

      const currentRefundStatus = String(data.refundStatus || 'none');
      if (currentRefundStatus === 'refunded' || currentRefundStatus === 'refunded_manually') {
        alreadyRefunded = true;
        return;
      }

      const txRef = String(data.flutterwaveTxRef || '').trim();
      if (!txRef.startsWith('LONKIND_AD_')) {
        throw new Error('INVALID_AD_TX_REF');
      }

      const flwTxId = String(data.flutterwaveTransactionId || '').trim();
      const amountPaid = Number(data.amountPaid || 0);
      const currencyPaid = String(data.currencyPaid || 'NGN').toUpperCase();
      const reason = String(data.rejectionReason || 'Policy Violation');
      const manualRefundId = manualRefInput || `manual_flw_${flwTxId || campaignId}`;

      const refundLedgerRef = adminDb
        .collection('ad_revenue_ledger')
        .doc(`refund_${flwTxId || campaignId}`);
      const origLedgerRef = flwTxId
        ? adminDb.collection('ad_revenue_ledger').doc(flwTxId)
        : null;

      tx.update(campRef, {
        status: 'rejected',
        paymentStatus: 'refunded',
        refundStatus: 'refunded_manually',
        flutterwaveRefundId: manualRefundId,
        refundId: manualRefundId,
        refundErrorMessage: null,
        refundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        idemRef,
        {
          refundStatus: 'refunded_manually',
          flutterwaveRefundId: manualRefundId,
          settledManuallyBy: authCheck.uid,
          completedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(refundLedgerRef, {
        id: `refund_${flwTxId || campaignId}`,
        transactionId: flwTxId || campaignId,
        txRef,
        type: 'ad_refund',
        provider: 'flutterwave',
        campaignId,
        payerUid: String(data.publisherUid || ''),
        payerHandle: String(data.publisherHandle || ''),
        amount: -Math.abs(amountPaid),
        currency: currencyPaid,
        status: 'refunded_manually',
        refundStatus: 'refunded_manually',
        flutterwaveRefundId: manualRefundId,
        reason,
        processedByAdminUid: authCheck.uid,
        withdrawable: false,
        countsTowardCreatorPayout: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (origLedgerRef) {
        tx.set(
          origLedgerRef,
          {
            refundStatus: 'refunded_manually',
            flutterwaveRefundId: manualRefundId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (data.publisherUid) {
        const notifRef = adminDb
          .collection('users')
          .doc(String(data.publisherUid))
          .collection('notifications')
          .doc();
        tx.set(notifRef, {
          type: 'ad_refund_settled',
          title: 'Ad Refund Settled Manually',
          message: `Your refund of ${currencyPaid} ${amountPaid.toLocaleString()} for "${data.title || 'Ad'}" (Ref: ${txRef}) has been settled manually via Flutterwave (Ref ID: ${manualRefundId}).`,
          campaignId,
          txRef,
          refundId: manualRefundId,
          read: false,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      emailContext = {
        publisherUid: String(data.publisherUid || ''),
        publisherName: String(data.publisherName || 'Creator'),
        title: String(data.title || 'Sponsored Ad'),
        reason,
        txRef,
        amountPaid,
        currencyPaid,
        manualRefundId,
      };
    });

    if (emailContext !== null) {
      const ctx = emailContext as {
        publisherUid: string;
        publisherName: string;
        title: string;
        reason: string;
        txRef: string;
        amountPaid: number;
        currencyPaid: string;
        manualRefundId: string;
      };
      let advertiserEmail: string | null = null;
      if (ctx.publisherUid) {
        const userSnap = await adminDb.collection('users').doc(ctx.publisherUid).get().catch(() => null);
        advertiserEmail = userSnap?.data()?.email || null;
      }
      await sendAdRefundEmailIfConfigured({
        toEmail: advertiserEmail,
        advertiserName: ctx.publisherName,
        campaignTitle: ctx.title,
        reason: ctx.reason,
        txRef: ctx.txRef,
        amount: ctx.amountPaid,
        currency: ctx.currencyPaid,
        refundStatus: 'refunded_manually',
        refundId: ctx.manualRefundId,
      });
    }

    return NextResponse.json({
      success: true,
      campaignId,
      alreadyRefunded,
      status: 'rejected',
      refundStatus: 'refunded_manually',
      flutterwaveRefundId: (emailContext as any)?.manualRefundId || null,
    });
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }
    if (err?.message === 'NOT_FLUTTERWAVE') {
      return NextResponse.json({ error: 'Campaign is not a Flutterwave-paid ad.' }, { status: 400 });
    }
    if (err?.message === 'INVALID_AD_TX_REF') {
      return NextResponse.json(
        { error: 'Safety block: transaction reference does not start with LONKIND_AD_.' },
        { status: 400 }
      );
    }
    console.error('[POST /api/ads/[campaignId]/mark-refunded] Error:', err);
    return NextResponse.json({ error: 'Unable to mark campaign as refunded manually.' }, { status: 500 });
  }
}
