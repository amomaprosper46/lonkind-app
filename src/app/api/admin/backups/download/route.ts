import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import {
  admin2faRequiredResponse,
  checkAdminStepUpSession,
  extractAuditRequestMeta,
} from '@/lib/admin-2fa';
import {
  encryptBackupBufferForDownload,
  getLatestBackupGzipBuffer,
} from '@/lib/database-backup';
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backups/download
 * Super-Admin (`role === "super_admin"` / `@mow`) + active 2FA step-up required.
 * Streams an AES-256-GCM encrypted, Gzip-compressed snapshot directly for PC / 64 GB USB safekeeping.
 */
export async function GET(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const auditMeta = extractAuditRequestMeta(req);
  const rl = checkRateLimit({
    namespace: 'admin_backup_download',
    key: authCheck.uid,
    ...RATE_LIMIT_PRESETS.ADMIN_SENSITIVE,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  const stepUp = await checkAdminStepUpSession(req, authCheck.uid);
  if (!stepUp.verified) {
    await writeSecurityAuditLog({
      action: 'database_backup_downloaded',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ...auditMeta,
      status: 'blocked',
      details: { reason: 'ADMIN_2FA_REQUIRED' },
    });
    return admin2faRequiredResponse(stepUp.reason);
  }

  try {
    const backupId = req.nextUrl.searchParams.get('backupId') || undefined;
    const { gzipBuffer, fileName, source } = await getLatestBackupGzipBuffer(backupId);
    const { encryptedBuffer, encrypted } = encryptBackupBufferForDownload(gzipBuffer);
    const downloadName = encrypted ? `${fileName}.enc` : fileName;

    await writeSecurityAuditLog({
      action: 'database_backup_downloaded',
      actorUid: authCheck.uid,
      actorHandle: authCheck.handle,
      ...auditMeta,
      status: 'success',
      details: {
        fileName: downloadName,
        sizeBytes: encryptedBuffer.length,
        encrypted,
        source,
      },
    });

    return new NextResponse(new Uint8Array(encryptedBuffer), {
      status: 200,
      headers: {
        'Content-Type': encrypted ? 'application/octet-stream' : 'application/gzip',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Lonkind-Backup-Encrypted': encrypted ? 'aes-256-gcm' : 'gzip-only',
      },
    });
  } catch (err: any) {
    console.error('[GET /api/admin/backups/download] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unable to download database snapshot.' },
      { status: 500 }
    );
  }
}
