import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { sendMandatoryOtp, type OtpProviderId } from '@/services/otpFailoverRouter';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

const VALID_PROVIDERS = new Set<OtpProviderId>(['firebase', 'sendchamp', 'backup_sms']);

/**
 * POST /api/auth/phone-otp/send
 * Unified 3-Provider Automatic SMS Failover OTP Dispatcher.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  const body = await req.json().catch(() => null);
  const rawPhone = String(body?.phone || '').trim();
  const isAutoFailoverRetry = Boolean(body?.failedClientProvider);

  // Don't double-count immediate silent client-to-server failover retries against the 5/15m limit
  if (!isAutoFailoverRetry) {
    const rl = checkRateLimit({
      namespace: 'mandatory_phone_otp_send',
      key: `${uid}:${ipAddress}`,
      ...RATE_LIMIT_PRESETS.AUTH_BRUTE_FORCE,
    });
    if (!rl.allowed) {
      await writeSecurityAuditLog({
        action: 'rate_limit_exceeded',
        actorUid: uid,
        ipAddress,
        userAgent,
        status: 'blocked',
        details: { endpoint: '/api/auth/phone-otp/send' },
      });
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }
  }

  const skipProviders: OtpProviderId[] = Array.isArray(body?.skipProviders)
    ? body.skipProviders.filter((id: any): id is OtpProviderId => VALID_PROVIDERS.has(id))
    : [];

  const failedClientProvider =
    body?.failedClientProvider && VALID_PROVIDERS.has(body.failedClientProvider.id)
      ? {
          id: body.failedClientProvider.id as OtpProviderId,
          error: String(body.failedClientProvider.error || 'Client provider failed').slice(0, 200),
        }
      : undefined;

  const result = await sendMandatoryOtp({
    uid,
    rawPhone,
    skipProviders,
    failedClientProvider,
    ipAddress,
    userAgent,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, failoverTrace: result.failoverTrace },
      { status: result.status }
    );
  }

  return NextResponse.json(result);
}
