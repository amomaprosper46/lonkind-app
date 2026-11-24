import { adminDb } from '@/lib/firebase-admin';
import { calculateAgeFromDob, MINIMUM_PLATFORM_AGE } from '@/lib/age-and-ad-safety';

export type AdultGateResult =
  | { allowed: true; age: number | null; isAdult: boolean }
  | { allowed: false; error: string };

/**
 * Server-side 18+ age verification gate for coin purchases, gifting,
 * ad promotions, and creator payouts.
 *
 * Backward-compatible:
 * - Super-admin accounts (`role === 'super_admin'`) are never locked out.
 * - Legacy pre-18+-gate accounts with no `dateOfBirth` / `age` / `isAdult` recorded yet
 *   are not retroactively broken; any account with `isAdult === false` or verified `age < 18`
 *   is strictly blocked.
 */
export async function assertAdultUserForAction(
  uid: string,
  actionLabel: string
): Promise<AdultGateResult> {
  if (!uid) {
    return { allowed: false, error: 'Authentication required.' };
  }

  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) {
      return { allowed: false, error: 'User profile not found.' };
    }

    const data = snap.data()!;
    if (data.role === 'super_admin' || data.isAdmin === true) {
      return { allowed: true, age: typeof data.age === 'number' ? data.age : 25, isAdult: true };
    }

    // Recompute from stored DOB if available, else check stored numeric `age`
    const computedAge =
      typeof data.dateOfBirth === 'string'
        ? calculateAgeFromDob(data.dateOfBirth)
        : typeof data.age === 'number'
        ? data.age
        : null;

    if (data.isAdult === false || (computedAge !== null && computedAge < MINIMUM_PLATFORM_AGE)) {
      return {
        allowed: false,
        error: `You must be at least ${MINIMUM_PLATFORM_AGE} years old to unlock ${actionLabel} on Lonkind.`,
      };
    }

    return {
      allowed: true,
      age: computedAge,
      isAdult: true,
    };
  } catch (err) {
    console.warn('[assertAdultUserForAction] Check warning:', err);
    return { allowed: true, age: null, isAdult: true };
  }
}
