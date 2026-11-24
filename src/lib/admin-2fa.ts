import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getClientIp, writeSecurityAuditLog } from '@/lib/security-shield';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Lonkind Security <no-reply@lonkind.com>';

export const ADMIN_2FA_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const ADMIN_2FA_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes step-up window
export const ADMIN_FRESH_AUTH_MAX_AGE_SEC = 24 * 60 * 60; // 24 hours max auth_time age

function hashOtp(uid: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`lonkind_admin_2fa:${uid}:${code.trim()}`, 'utf8')
    .digest('hex');
}

/**
 * Creates a cryptographically secure 6-digit OTP challenge for Super-Admin (`mow`).
 * Sends via Resend email if configured AND drops a private self-only security notification
 * in `users/{uid}/notifications` so `mow` can never be locked out even without SMTP/Resend.
 */
export async function issueAdmin2faChallenge(params: {
  uid: string;
  email?: string | null;
  handle?: string | null;
  ipAddress: string;
  userAgent: string;
}): Promise<{ expiresAtIso: string; emailSent: boolean }> {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtp(params.uid, code);
  const expiresAt = new Date(Date.now() + ADMIN_2FA_OTP_TTL_MS);

  await adminDb.collection('admin_2fa_challenges').doc(params.uid).set({
    uid: params.uid,
    codeHash,
    attempts: 0,
    ipAddress: params.ipAddress,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: FieldValue.serverTimestamp(),
  });

  // Private in-app security notification readable ONLY by `mow`
  await adminDb
    .collection('users')
    .doc(params.uid)
    .collection('notifications')
    .add({
      type: 'admin_security_otp',
      title: 'Super-Admin 2FA Verification Code',
      message: `Your 6-digit Lonkind Admin verification code is ${code}. It expires in 10 minutes. Never share this code.`,
      read: false,
      timestamp: FieldValue.serverTimestamp(),
    });

  let emailSent = false;
  if (RESEND_API_KEY && params.email && params.email.includes('@')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [params.email],
          subject: 'Lonkind Super-Admin 2FA Verification Code',
          text: [
            `Your Lonkind Super-Admin 2FA verification code is: ${code}`,
            '',
            'This code expires in 10 minutes and unlocks high-risk actions (payout approvals, Flutterwave refunds, role changes) for 15 minutes.',
            `Request IP: ${params.ipAddress}`,
          ].join('\n'),
        }),
      });
      emailSent = res.ok;
    } catch {
      emailSent = false;
    }
  }

  await writeSecurityAuditLog({
    action: 'admin_2fa_requested',
    actorUid: params.uid,
    actorHandle: params.handle,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    status: 'success',
    details: { emailSent },
  });

  return { expiresAtIso: expiresAt.toISOString(), emailSent };
}

/**
 * Verifies the 6-digit OTP using constant-time comparison and grants a 15-minute
 * step-up verification session in `admin_2fa_sessions/{uid}`.
 */
export async function verifyAdmin2faChallenge(params: {
  uid: string;
  handle?: string | null;
  code: string;
  ipAddress: string;
  userAgent: string;
}): Promise<{ ok: true; expiresAtIso: string } | { ok: false; error: string }> {
  const cleanCode = String(params.code || '').replace(/\D/g, '').slice(0, 6);
  if (cleanCode.length !== 6) {
    return { ok: false, error: 'Please enter the 6-digit verification code.' };
  }

  const ref = adminDb.collection('admin_2fa_challenges').doc(params.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: 'No active 2FA challenge found. Request a new code.' };
  }

  const data = snap.data()!;
  const expiresAtMs = data.expiresAt?.toMillis?.() || 0;
  if (Date.now() > expiresAtMs) {
    await ref.delete().catch(() => {});
    return { ok: false, error: 'Verification code expired. Please request a new code.' };
  }

  const attempts = Number(data.attempts || 0);
  if (attempts >= 5) {
    await ref.delete().catch(() => {});
    return { ok: false, error: 'Too many failed code attempts. Please request a new code.' };
  }

  const expectedHex = String(data.codeHash || '');
  const providedHex = hashOtp(params.uid, cleanCode);
  const matches =
    expectedHex.length === providedHex.length &&
    crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(providedHex, 'hex'));

  if (!matches) {
    await ref.update({ attempts: FieldValue.increment(1) }).catch(() => {});
    await writeSecurityAuditLog({
      action: 'admin_2fa_failed',
      actorUid: params.uid,
      actorHandle: params.handle,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      status: 'failed',
      details: { attempts: attempts + 1 },
    });
    return { ok: false, error: 'Incorrect verification code. Please check and try again.' };
  }

  const sessionExpiresAt = new Date(Date.now() + ADMIN_2FA_SESSION_TTL_MS);
  await Promise.all([
    ref.delete().catch(() => {}),
    adminDb.collection('admin_2fa_sessions').doc(params.uid).set({
      uid: params.uid,
      ipAddress: params.ipAddress,
      verifiedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(sessionExpiresAt),
    }),
  ]);

  await writeSecurityAuditLog({
    action: 'admin_2fa_verified',
    actorUid: params.uid,
    actorHandle: params.handle,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    status: 'success',
    details: { sessionExpiresAt: sessionExpiresAt.toISOString() },
  });

  return { ok: true, expiresAtIso: sessionExpiresAt.toISOString() };
}

/**
 * Checks whether the Super-Admin (`mow`) has BOTH:
 *  1. A fresh Firebase ID token (`auth_time` within 24 hours)
 *  2. An active 15-minute 2FA step-up verification session in `admin_2fa_sessions/{uid}`
 */
export async function checkAdminStepUpSession(
  req: NextRequest,
  uid: string
): Promise<{
  verified: boolean;
  freshAuth: boolean;
  expiresAtIso: string | null;
  reason?: string;
}> {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    let freshAuth = false;
    if (token) {
      const decoded = await adminAuth.verifyIdToken(token);
      const authTimeSec = Number(decoded.auth_time || 0);
      const nowSec = Math.floor(Date.now() / 1000);
      freshAuth = authTimeSec > 0 && nowSec - authTimeSec <= ADMIN_FRESH_AUTH_MAX_AGE_SEC;
    }

    const snap = await adminDb.collection('admin_2fa_sessions').doc(uid).get();
    if (!snap.exists) {
      return {
        verified: false,
        freshAuth,
        expiresAtIso: null,
        reason: 'Super-Admin 2FA verification required before executing this sensitive action.',
      };
    }

    const expiresAtMs = snap.data()?.expiresAt?.toMillis?.() || 0;
    if (Date.now() > expiresAtMs) {
      return {
        verified: false,
        freshAuth,
        expiresAtIso: null,
        reason: 'Your 15-minute Super-Admin 2FA session expired. Please verify again.',
      };
    }

    if (!freshAuth) {
      return {
        verified: false,
        freshAuth: false,
        expiresAtIso: new Date(expiresAtMs).toISOString(),
        reason: 'Please sign in again for a fresh session before executing this sensitive action.',
      };
    }

    return {
      verified: true,
      freshAuth: true,
      expiresAtIso: new Date(expiresAtMs).toISOString(),
    };
  } catch {
    return {
      verified: false,
      freshAuth: false,
      expiresAtIso: null,
      reason: 'Unable to validate Super-Admin 2FA session.',
    };
  }
}

export function admin2faRequiredResponse(reason?: string): NextResponse {
  return NextResponse.json(
    {
      error:
        reason ||
        '2FA verification required. Verify your 6-digit Super-Admin security code in the Security Shield panel above.',
      code: 'ADMIN_2FA_REQUIRED',
    },
    { status: 428 }
  );
}

export function extractAuditRequestMeta(req: NextRequest) {
  return {
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') || '',
  };
}
