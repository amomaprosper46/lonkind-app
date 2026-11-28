import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { verifyMandatoryOtp } from '@/services/otpFailoverRouter';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/phone-otp/verify
 * Verifies 6-digit SMS OTP (or Firebase Phone Auth credential) and atomically claims
 * `phone_registry/{e164Phone}` (strict 1-phone-per-account uniqueness).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let uid = '';
  let firebaseAuthPhone: string | null = null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
    uid = decoded.uid;
    firebaseAuthPhone = decoded.phone_number || null;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';
  const rl = checkRateLimit({
    namespace: 'mandatory_phone_otp_verify',
    key: `${uid}:${ipAddress}`,
    ...RATE_LIMIT_PRESETS.AUTH_BRUTE_FORCE,
  });
  if (!rl.allowed) {
    await writeSecurityAuditLog({
      action: 'failed_login_spike',
      actorUid: uid,
      ipAddress,
      userAgent,
      status: 'blocked',
      details: { endpoint: '/api/auth/phone-otp/verify' },
    });
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  const body = await req.json().catch(() => null);
  const rawPhone = String(body?.phone || firebaseAuthPhone || '').trim();
  const code = String(body?.code || '').trim();
  // Only trust Firebase Phone Auth verification if the verified Firebase ID token itself carries that phone_number
  const verifiedByFirebaseAuth = Boolean(
    body?.verifiedByFirebaseAuth && firebaseAuthPhone && firebaseAuthPhone === rawPhone
  );

  const result = await verifyMandatoryOtp({
    uid,
    rawPhone,
    code,
    verifiedByFirebaseAuth,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    phoneNumber: result.phoneE164,
    providerUsed: result.providerUsed,
  });
}
