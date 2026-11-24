import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { executeDatabaseBackup } from '@/lib/database-backup';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * POST /api/admin/backups/run
 * Super-Admin (`role === "super_admin"` / `@mow`) manual backup trigger.
 * Strictly rate-limited to 1 manual backup per hour (both in-memory and Firestore).
 */
export async function POST(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  // 1. In-memory rate limit: max 1 manual backup per hour
  const rl = checkRateLimit({
    namespace: 'admin_manual_backup',
    key: authCheck.uid,
    maxRequests: 1,
    windowMs: ONE_HOUR_MS,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  // 2. Durable Firestore check (survives serverless cold starts)
  try {
    const recentManualSnap = await adminDb
      .collection('system_backups')
      .where('trigger', '==', 'manual')
      .where('status', '==', 'healthy')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const lastManualMs = recentManualSnap.docs[0]?.data()?.createdAt?.toMillis?.() || 0;
    if (lastManualMs > 0 && Date.now() - lastManualMs < ONE_HOUR_MS) {
      const waitSec = Math.ceil((ONE_HOUR_MS - (Date.now() - lastManualMs)) / 1000);
      return NextResponse.json(
        {
          error: `Manual backups are rate-limited to 1 per hour. Please wait ${Math.ceil(
            waitSec / 60
          )} minute(s).`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: waitSec,
        },
        { status: 429, headers: { 'Retry-After': String(waitSec) } }
      );
    }
  } catch {
    // Fallback gracefully if composite index is still building
  }

  try {
    const backup = await executeDatabaseBackup({
      trigger: 'manual',
      actorUid: authCheck.uid,
    });

    await writeSecurityAuditLog({
      action: 'database_backup_created',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ipAddress,
      userAgent,
      status: 'success',
      details: {
        backupId: backup.id,
        fileName: backup.fileName,
        sizeBytes: backup.sizeBytes,
        totalDocs: backup.totalDocs,
        prunedOldBackups: backup.prunedOldBackups || 0,
        trigger: 'manual',
      },
    });

    return NextResponse.json({ success: true, backup });
  } catch (err: any) {
    await writeSecurityAuditLog({
      action: 'database_backup_created',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ipAddress,
      userAgent,
      status: 'failed',
      details: { error: err?.message || 'Manual backup failed', trigger: 'manual' },
    });
    console.error('[POST /api/admin/backups/run] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unable to create database backup.' },
      { status: 500 }
    );
  }
}
