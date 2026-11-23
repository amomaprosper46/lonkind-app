import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export type SuperAdminCheckResult =
  | {
      authorized: true;
      uid: string;
      email?: string;
      handle?: string;
      role: 'super_admin';
      userData: Record<string, any>;
    }
  | {
      authorized: false;
      status: 401 | 403;
      error: string;
    };

/**
 * Strict server-side Super-Admin authorization check.
 * Verifies the Firebase ID token AND confirms `role === 'super_admin'`
 * from Firestore (`users/{uid}` / `admins/{uid}`) or verified Auth custom claims.
 * No hardcoded legacy email or mock handle bypasses are permitted.
 */
export async function verifySuperAdminRequest(
  req: NextRequest
): Promise<SuperAdminCheckResult> {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return {
        authorized: false,
        status: 401,
        error: 'Authentication required.',
      };
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return {
        authorized: false,
        status: 401,
        error: 'Missing authentication token.',
      };
    }

    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return {
        authorized: false,
        status: 401,
        error: 'Invalid or expired authentication token.',
      };
    }

    const uid = decodedToken.uid as string;
    const [userSnap, adminSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('admins').doc(uid).get(),
    ]);

    const userData = userSnap.exists ? (userSnap.data() as Record<string, any>) : {};
    const adminData = adminSnap.exists ? (adminSnap.data() as Record<string, any>) : {};

    const isSuperAdmin =
      userData.role === 'super_admin' ||
      adminData.role === 'super_admin' ||
      decodedToken.role === 'super_admin';

    if (!isSuperAdmin) {
      return {
        authorized: false,
        status: 403,
        error: 'Forbidden: Super-admin privileges required.',
      };
    }

    return {
      authorized: true,
      uid,
      email: decodedToken.email || userData.email,
      handle: userData.handle || userData.username || adminData.handle,
      role: 'super_admin',
      userData,
    };
  } catch (err) {
    console.error('[verifySuperAdminRequest] Unexpected error:', err);
    return {
      authorized: false,
      status: 401,
      error: 'Unable to verify administrator session.',
    };
  }
}
