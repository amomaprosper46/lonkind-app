import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { extractAuditRequestMeta, issueAdmin2faChallenge } from '@/lib/admin-2fa';
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const meta = extractAuditRequestMeta(req);
  const rl = checkRateLimit({
    namespace: 'admin_2fa_req',
    key: `${authCheck.uid}:${meta.ipAddress}`,
    ...RATE_LIMIT_PRESETS.AUTH_BRUTE_FORCE,
  });
  if (!rl.allowed) {
    await writeSecurityAuditLog({
      action: 'rate_limit_exceeded',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ...meta,
      status: 'blocked',
      details: { endpoint: '/api/admin/2fa/request' },
    });
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  const result = await issueAdmin2faChallenge({
    uid: authCheck.uid,
    email: authCheck.email,
    handle: authCheck.handle,
    ...meta,
  });

  return NextResponse.json({
    success: true,
    expiresAt: result.expiresAtIso,
    emailSent: result.emailSent,
    message: result.emailSent
      ? '6-digit verification code sent to your email and private in-app notifications.'
      : '6-digit verification code delivered to your private in-app notifications.',
  });
}
