import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { checkAdminStepUpSession } from '@/lib/admin-2fa';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const [stepUp, logsSnap] = await Promise.all([
    checkAdminStepUpSession(req, authCheck.uid),
    adminDb
      .collection('security_audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get()
      .catch(() => null),
  ]);

  const auditLogs = (logsSnap?.docs || []).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: String(data.action || ''),
      actorUid: String(data.actorUid || ''),
      actorHandle: data.actorHandle || null,
      ipAddress: String(data.ipAddress || 'unknown'),
      status: String(data.status || 'success'),
      details: data.details || {},
      timestamp: data.timestamp?.toDate?.()?.toISOString?.() || null,
    };
  });

  return NextResponse.json({
    verified: stepUp.verified,
    freshAuth: stepUp.freshAuth,
    expiresAt: stepUp.expiresAtIso,
    reason: stepUp.reason || null,
    auditLogs,
  });
}
