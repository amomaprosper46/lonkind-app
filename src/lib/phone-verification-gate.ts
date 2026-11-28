import { adminDb } from '@/lib/firebase-admin';

/**
 * Mandatory Phone Verification Gate:
 *  - Super-Admin (`role === 'super_admin'` / `@mow`) is ALWAYS allowed without lockout.
 *  - New signups (`phoneVerificationRequired === true`) MUST verify a unique phone number
 *    before unlocking coin purchases, live streaming, promotions, and creator payouts.
 *  - Legacy accounts (`phoneVerificationRequired !== true`) are grandfathered for general
 *    features, and prompted cleanly to verify a phone number on their next creator payout
 *    request when `enforceForLegacyPayouts: true`.
 */
export async function assertPhoneVerifiedForAction(
  uid: string,
  actionLabel: string,
  options?: { enforceForLegacyPayouts?: boolean }
): Promise<{ allowed: true } | { allowed: false; error: string; code: 'PHONE_VERIFICATION_REQUIRED' }> {
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) {
      return { allowed: true };
    }
    const data = snap.data() || {};

    // Never lock out super_admin (`mow`)
    if (data.role === 'super_admin' || data.isAdmin === true) {
      return { allowed: true };
    }

    const isPhoneVerified = Boolean(data.phoneVerified === true && data.phoneNumber);
    if (isPhoneVerified) {
      return { allowed: true };
    }

    const isNewMandatoryAccount = data.phoneVerificationRequired === true;
    const mustVerifyForPayout = Boolean(options?.enforceForLegacyPayouts);

    if (isNewMandatoryAccount || mustVerifyForPayout) {
      return {
        allowed: false,
        code: 'PHONE_VERIFICATION_REQUIRED',
        error: `Please verify your phone number via 6-digit SMS OTP before ${actionLabel}.`,
      };
    }

    // Legacy user grandfathered for non-payout features
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
