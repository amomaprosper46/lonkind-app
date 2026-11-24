import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { BACKUP_RETENTION_DAYS, type BackupMetadataRecord } from '@/lib/database-backup';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backups
 * Super-Admin (`role === "super_admin"` / `@mow`) endpoint returning the latest
 * database backup status (`Healthy` / `Failed`), file size, timestamp, and recent history.
 */
export async function GET(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const snap = await adminDb
      .collection('system_backups')
      .orderBy('createdAt', 'desc')
      .limit(14)
      .get();

    const backups: BackupMetadataRecord[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fileName: String(data.fileName || ''),
        storagePath: String(data.storagePath || ''),
        sizeBytes: Number(data.sizeBytes || 0),
        totalDocs: Number(data.totalDocs || 0),
        docCounts: data.docCounts || {},
        trigger: data.trigger === 'scheduled' ? 'scheduled' : 'manual',
        status: data.status === 'healthy' ? 'healthy' : 'failed',
        errorMessage: data.errorMessage || null,
        prunedOldBackups: Number(data.prunedOldBackups || 0),
        createdByUid: String(data.createdByUid || ''),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    const lastHealthy = backups.find((b) => b.status === 'healthy') || null;
    const latest = backups[0] || null;

    return NextResponse.json({
      retentionDays: BACKUP_RETENTION_DAYS,
      latest,
      lastHealthy,
      backups,
    });
  } catch (err: any) {
    console.error('[GET /api/admin/backups] Error:', err);
    return NextResponse.json({ error: 'Unable to load backup history.' }, { status: 500 });
  }
}
