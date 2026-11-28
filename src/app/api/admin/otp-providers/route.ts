import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import {
  getOtpFailoverConfig,
  saveOtpFailoverConfig,
  type OtpProviderConfig,
} from '@/services/otpFailoverRouter';
import { getClientIp, writeSecurityAuditLog } from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/otp-providers
 * Super-Admin (`mow`) endpoint returning live 3-provider SMS failover configuration & health.
 */
export async function GET(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const providers = await getOtpFailoverConfig();
  return NextResponse.json({ providers });
}

/**
 * POST /api/admin/otp-providers
 * Super-Admin (`mow`) endpoint to toggle providers on/off, reorder priorities, or reset health
 * without redeploying code.
 */
export async function POST(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.providers) || body.providers.length === 0) {
    return NextResponse.json({ error: 'Invalid providers array.' }, { status: 400 });
  }

  const updated = await saveOtpFailoverConfig(
    body.providers as OtpProviderConfig[],
    authCheck.uid
  );

  await writeSecurityAuditLog({
    action: 'admin_platform_control',
    actorUid: authCheck.uid,
    actorHandle: authCheck.handle,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') || '',
    status: 'success',
    details: {
      control: 'otp_failover_config',
      order: updated.map((p) => `${p.priority}:${p.id}(${p.enabled ? 'on' : 'off'})`),
    },
  });

  return NextResponse.json({ success: true, providers: updated });
}
