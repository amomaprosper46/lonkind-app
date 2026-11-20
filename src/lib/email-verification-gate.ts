import { adminAuth } from '@/lib/firebase-admin';

export type EmailVerificationGateResult =
  | { allowed: true }
  | { allowed: false; error: string };

/**
 * Server-side gate requiring Firebase Email Verification before unlocking
 * high-trust actions (coin purchases, live streaming, creator payouts).
 *
 * Backward-compatible: Phone-only users who do not have an email address
 * attached to their Firebase Auth account are allowed through.
 */
export async function assertEmailVerifiedForAction(
  uid: string,
  actionLabel: string
): Promise<EmailVerificationGateResult> {
  if (!uid) {
    return { allowed: false, error: 'Authentication required.' };
  }

  try {
    const authUser = await adminAuth.getUser(uid);
    // Phone-only accounts without an email address are not blocked
    if (!authUser.email) {
      return { allowed: true };
    }

    if (!authUser.emailVerified) {
      return {
        allowed: false,
        error: `Please verify your Gmail address (${authUser.email}) before unlocking ${actionLabel}. Check your inbox for the verification link.`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.warn('[EmailVerificationGate] Could not fetch Auth user record:', err);
    return { allowed: true };
  }
}
