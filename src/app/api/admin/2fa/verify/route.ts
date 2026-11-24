import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { extractAuditRequestMeta, verifyAdmin2faChallenge } from '@/lib/admin-2fa';
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
    namespace: 'admin_2fa_verify',
    key: `${authCheck.uid}:${meta.ipAddress}`,
    ...RATE_LIMIT_PRESETS.AUTH_BRUTE_FORCE,
  });
  if (!rl.allowed) {
    await writeSecurityAuditLog({
      action: 'failed_login_spike',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ...meta,
      status: 'blocked',
      details: { endpoint: '/api/admin/2fa/verify' },
    });
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code || '').trim();
  const res = await verifyAdmin2faChallenge({
    uid: authCheck.uid,
    handle: authCheck.handle,
    code,
    ...meta,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    verified: true,
    expiresAt: res.expiresAtIso,
  });
}
