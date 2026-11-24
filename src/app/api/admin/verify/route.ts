import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { getClientIp, writeSecurityAuditLog } from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/verify
 * Strict server-side Super-Admin verification endpoint for `/admin` and `/admin/*`.
 */
export async function GET(req: NextRequest) {
  const result = await verifySuperAdminRequest(req);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  if (!result.authorized) {
    await writeSecurityAuditLog({
      action: 'admin_login',
      ipAddress,
      userAgent,
      status: 'blocked',
      details: { error: result.error },
    });
    return NextResponse.json(
      { authorized: false, error: result.error },
      { status: result.status }
    );
  }

  await writeSecurityAuditLog({
    action: 'admin_login',
    actorUid: result.uid,
    actorHandle: result.handle || 'mow',
    ipAddress,
    userAgent,
    status: 'success',
    details: { role: result.role },
  });

  return NextResponse.json({
    authorized: true,
    uid: result.uid,
    role: result.role,
    handle: result.handle || 'mow',
    name: result.userData?.name || 'Prosper Amoma',
  });
}
