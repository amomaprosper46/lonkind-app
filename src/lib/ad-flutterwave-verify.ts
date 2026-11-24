import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';

export type AdFlutterwaveVerifyResult =
  | {
      success: true;
      alreadyProcessed: boolean;
      campaignId: string;
      transactionId: string;
      amount: number;
      currency: string;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

/**
 * Strictly verifies a Flutterwave Ad payment (`tx_ref` prefixed with `LONKIND_AD_`)
 * against Flutterwave `/v3/transactions/{id}/verify`, confirms status/amount/currency,
 * records isolated revenue in `ad_revenue_ledger/{transactionId}` (idempotent!),
 * and transitions the campaign into `mow`'s `"pending_review"` approval queue.
 */
export async function verifyAndActivateFlutterwaveAdPayment(
  transactionId: string,
  expectedTxRef?: string
): Promise<AdFlutterwaveVerifyResult> {
  if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
    return { success: false, status: 503, error: 'Flutterwave secret key is not configured.' };
  }

  const cleanTxId = String(transactionId || '').trim();
  if (!cleanTxId) {
    return { success: false, status: 400, error: 'Missing Flutterwave transaction_id.' };
  }

  // 1. Server-to-server verification with Flutterwave API
  const verifyRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(cleanTxId)}/verify`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  );

  const verifyJson = await verifyRes.json().catch(() => null);
  if (!verifyRes.ok || verifyJson?.status !== 'success' || !verifyJson?.data) {
    return {
      success: false,
      status: 400,
      error: verifyJson?.message || 'Flutterwave transaction verification failed.',
    };
  }

  const flwData = verifyJson.data;
  const txRef = String(flwData.tx_ref || expectedTxRef || '').trim();

  // Strict isolation: ONLY process LONKIND_AD_ references (never touch coin purchases)
  if (!txRef.startsWith('LONKIND_AD_')) {
    return {
      success: false,
      status: 400,
      error: 'Transaction reference is not a Lonkind Ad payment.',
    };
  }

  if (String(flwData.status || '').toLowerCase() !== 'successful') {
    return {
      success: false,
      status: 400,
      error: `Payment not successful (status: ${flwData.status}).`,
    };
  }

  const paidAmount = Number(flwData.amount || 0);
  const paidCurrency = String(flwData.currency || 'NGN').toUpperCase();
  const campaignId = String(flwData.meta?.campaignId || txRef.split('_')[2] || '').trim();

  if (!campaignId) {
    return { success: false, status: 400, error: 'Missing campaignId in Flutterwave metadata.' };
  }

  const revenueRef = adminDb.collection('ad_revenue_ledger').doc(cleanTxId);
  const campRef = adminDb.collection('ad_campaigns').doc(campaignId);

  let alreadyProcessed = false;

  await adminDb.runTransaction(async (tx) => {
    const [revSnap, campSnap] = await Promise.all([tx.get(revenueRef), tx.get(campRef)]);

    if (revSnap.exists) {
      alreadyProcessed = true;
      return;
    }

    if (!campSnap.exists) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }

    const campData = campSnap.data()!;
    const expectedAmount = Number(campData.amountPaid || 0);
    const expectedCurrency = String(campData.currencyPaid || 'NGN').toUpperCase();

    if (paidCurrency !== expectedCurrency || paidAmount + 0.01 < expectedAmount) {
      throw new Error(
        `AMOUNT_MISMATCH: expected ${expectedCurrency} ${expectedAmount}, got ${paidCurrency} ${paidAmount}`
      );
    }

    // 1. Record isolated ad revenue in `ad_revenue_ledger` (never touches creator payouts/Diamonds)
    tx.set(revenueRef, {
      id: cleanTxId,
      transactionId: cleanTxId,
      txRef,
      type: 'direct_ad_revenue',
      provider: 'flutterwave',
      campaignId,
      payerUid: campData.publisherUid || '',
      payerHandle: campData.publisherHandle || '',
      amount: paidAmount,
      currency: paidCurrency,
      status: 'settled',
      withdrawable: false,
      countsTowardCreatorPayout: false,
      verifiedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Mark ad campaign as paid and route into mow's "Pending Approvals" queue
    tx.update(campRef, {
      status: 'pending_review',
      paymentMethod: 'flutterwave',
      paymentStatus: 'paid',
      flutterwaveTxRef: txRef,
      flutterwaveTransactionId: cleanTxId,
      amountPaid: paidAmount,
      currencyPaid: paidCurrency,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Tag promoted post as `pending_review` so creator sees "Under Review" badge
    if (campData.targetType === 'post' && campData.targetPostId) {
      tx.set(
        adminDb.collection('posts').doc(campData.targetPostId),
        {
          promotionStatus: 'pending_review',
          activeCampaignId: campaignId,
        },
        { merge: true }
      );
    }

    // 4. Notify creator that payment succeeded and ad is under review
    if (campData.publisherUid) {
      const notifRef = adminDb
        .collection('users')
        .doc(campData.publisherUid)
        .collection('notifications')
        .doc();
      tx.set(notifRef, {
        type: 'ad_payment_confirmed',
        title: 'Ad Payment Confirmed — Under Review',
        message: `Your payment of ${paidCurrency} ${paidAmount.toLocaleString()} for "${campData.title}" is confirmed! Your ad is now in review.`,
        campaignId,
        transactionId: cleanTxId,
        read: false,
        timestamp: FieldValue.serverTimestamp(),
      });
    }
  });

  return {
    success: true,
    alreadyProcessed,
    campaignId,
    transactionId: cleanTxId,
    amount: paidAmount,
    currency: paidCurrency,
  };
}
