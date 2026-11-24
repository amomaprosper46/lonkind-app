import { NextRequest, NextResponse } from 'next/server';
import { executeDatabaseBackup } from '@/lib/database-backup';
import {
  getClientIp,
  verifyWebhookSignatureTimingSafe,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/daily-backup
 * Scheduled daily backup endpoint (03:00 AM WAT / 02:00 UTC).
 * Strictly authenticated via `Authorization: Bearer <CRON_SECRET>` using constant-time comparison.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = req.headers.get('Authorization') || '';
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  if (
    !cronSecret ||
    !providedSecret ||
    !verifyWebhookSignatureTimingSafe(providedSecret, cronSecret)
  ) {
    await writeSecurityAuditLog({
      action: 'database_backup_created',
      actorUid: 'system_cron',
      ipAddress,
      userAgent,
      status: 'blocked',
      details: { reason: 'Invalid or missing CRON_SECRET' },
    });
    return NextResponse.json({ error: 'Unauthorized cron trigger.' }, { status: 401 });
  }

  try {
    const backup = await executeDatabaseBackup({
      trigger: 'scheduled',
      actorUid: 'system_cron',
    });

    await writeSecurityAuditLog({
      action: 'database_backup_created',
      actorUid: 'system_cron',
      ipAddress,
      userAgent,
      status: 'success',
      details: {
        backupId: backup.id,
        fileName: backup.fileName,
        sizeBytes: backup.sizeBytes,
        totalDocs: backup.totalDocs,
        prunedOldBackups: backup.prunedOldBackups || 0,
        trigger: 'scheduled',
      },
    });

    return NextResponse.json({ success: true, backup });
  } catch (err: any) {
    await writeSecurityAuditLog({
      action: 'database_backup_created',
      actorUid: 'system_cron',
      ipAddress,
      userAgent,
      status: 'failed',
      details: { error: err?.message || 'Backup failed', trigger: 'scheduled' },
    });
    console.error('[POST /api/cron/daily-backup] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Daily database backup failed.' },
      { status: 500 }
    );
  }
}
