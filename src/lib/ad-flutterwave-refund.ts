const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Lonkind Ads <no-reply@lonkind.com>';

export type FlutterwaveRefundCallResult =
  | {
      ok: true;
      flutterwaveRefundId: string;
      rawStatus: string;
      message: string;
    }
  | {
      ok: false;
      flutterwaveMessage: string;
    };

/**
 * Executes Flutterwave's official transaction refund API:
 *   POST https://api.flutterwave.com/v3/transactions/{id}/refund
 * Strictly isolated to Lonkind Ad refunds (`LONKIND_AD_` transactions).
 * Never throws unhandled errors — returns a typed result so Bank Transfer / USSD
 * channels that require manual dashboard settlement are handled gracefully.
 */
export async function executeFlutterwaveAdRefund(params: {
  flutterwaveTransactionId: string;
  txRef: string;
  amount: number;
  reason: string;
}): Promise<FlutterwaveRefundCallResult> {
  const { flutterwaveTransactionId, txRef, amount, reason } = params;

  if (!txRef.startsWith('LONKIND_AD_')) {
    return {
      ok: false,
      flutterwaveMessage: 'Refused: transaction reference does not start with LONKIND_AD_.',
    };
  }

  if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
    return {
      ok: false,
      flutterwaveMessage:
        'Flutterwave secret key (FLW_SECRET_KEY) is not configured on the server. Complete the refund manually in the Flutterwave dashboard.',
    };
  }

  const cleanTxId = String(flutterwaveTransactionId || '').trim();
  if (!cleanTxId) {
    return {
      ok: false,
      flutterwaveMessage: 'Missing Flutterwave transaction_id for automated refund.',
    };
  }

  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(cleanTxId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(amount),
          comments: `Lonkind Ad Rejected (${reason}) [${txRef}]`,
        }),
        cache: 'no-store',
      }
    );

    const json = await res.json().catch(() => null);
    if (res.ok && json?.status === 'success') {
      const flwRefundId = String(
        json?.data?.id || json?.data?.flw_ref || `flw_refund_${cleanTxId}`
      );
      return {
        ok: true,
        flutterwaveRefundId: flwRefundId,
        rawStatus: String(json?.data?.status || 'completed'),
        message: String(json?.message || 'Refund initiated successfully.'),
      };
    }

    const flwMessage = String(
      json?.message ||
        `Flutterwave returned HTTP ${res.status} — this payment channel (e.g. Bank Transfer / USSD) may require a manual refund from the Flutterwave dashboard.`
    );
    return {
      ok: false,
      flutterwaveMessage: flwMessage,
    };
  } catch (err: any) {
    return {
      ok: false,
      flutterwaveMessage:
        err?.message || 'Network error contacting Flutterwave Refund API. Manual refund required.',
    };
  }
}

/**
 * Optional transactional email helper (fires only when RESEND_API_KEY is configured).
 * Never throws so an email outage can never block a refund state update.
 */
export async function sendAdRefundEmailIfConfigured(params: {
  toEmail?: string | null;
  advertiserName?: string;
  campaignTitle: string;
  reason: string;
  txRef: string;
  amount: number;
  currency: string;
  refundStatus: 'refunded' | 'manual_refund_required' | 'refunded_manually';
  refundId?: string | null;
}): Promise<void> {
  if (!RESEND_API_KEY || !params.toEmail || !params.toEmail.includes('@')) {
    return;
  }

  const statusLine =
    params.refundStatus === 'refunded'
      ? `Your full refund of ${params.currency} ${params.amount.toLocaleString()} has been processed via Flutterwave (Refund ID: ${params.refundId || 'Confirmed'}).`
      : params.refundStatus === 'refunded_manually'
      ? `Your full refund of ${params.currency} ${params.amount.toLocaleString()} has been settled manually via Flutterwave (Reference: ${params.refundId || params.txRef}).`
      : `Because your payment channel requires manual settlement, our team has queued your full refund of ${params.currency} ${params.amount.toLocaleString()} and will confirm once settled.`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.toEmail],
        subject: `Lonkind Ad Update: "${params.campaignTitle}" — Refund Status`,
        text: [
          `Hello ${params.advertiserName || 'Creator'},`,
          '',
          `Your ad campaign "${params.campaignTitle}" was not approved during review.`,
          `Reason: ${params.reason}`,
          `Transaction Reference (tx_ref): ${params.txRef}`,
          '',
          statusLine,
          '',
          '— Lonkind Trust & Ads Team',
        ].join('\n'),
      }),
    });
  } catch {
    // Non-blocking email failure
  }
}
