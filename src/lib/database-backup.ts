import crypto from 'crypto';
import zlib from 'zlib';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

/**
 * Critical Firestore collections exported in every Lonkind Daily Backup.
 * Ephemeral/heavy caches (notifications, webhookLogs, view_windows, 2FA OTPs,
 * temporary stream chat) are intentionally excluded to keep snapshots tiny & fast.
 */
export const CRITICAL_BACKUP_COLLECTIONS = [
  'users',
  'wallets',
  'transactions',
  'coin_transactions',
  'payoutRequests',
  'payout_requests',
  'ad_campaigns',
  'ad_revenue_ledger',
  'security_audit_logs',
] as const;

export const BACKUP_RETENTION_DAYS = 14;
export const BACKUP_RETENTION_MS = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const BACKUP_PREFIX = 'backups/';

export interface BackupMetadataRecord {
  id: string;
  fileName: string;
  storagePath: string;
  sizeBytes: number;
  totalDocs: number;
  docCounts: Record<string, number>;
  trigger: 'scheduled' | 'manual';
  status: 'healthy' | 'failed';
  errorMessage?: string | null;
  prunedOldBackups?: number;
  createdByUid: string;
  createdAt: string | null;
}

function resolveBackupBucketName(): string {
  const configured =
    process.env.BACKUP_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    '';
  if (configured) return configured.replace(/^gs:\/\//, '').trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'impactful-ideas';
  return `${projectId}.appspot.com`;
}

/**
 * Recursively converts Firestore Timestamps / Dates / GeoPoints into clean JSON.
 */
function serializeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val?.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map(serializeFirestoreValue);
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      // Strip bulky ephemeral push token arrays from user docs to keep backups compact
      if (k === 'fcmTokens' || k === 'ephemeralCache') continue;
      out[k] = serializeFirestoreValue(v);
    }
    return out;
  }
  return val;
}

/**
 * Builds an in-memory Gzip-compressed JSON snapshot of all critical collections.
 * Never writes temporary files to local PC or server disk.
 */
export async function buildCompressedSnapshotBuffer(): Promise<{
  gzipBuffer: Buffer;
  fileName: string;
  docCounts: Record<string, number>;
  totalDocs: number;
}> {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStamp = now.toISOString().slice(11, 19).replace(/:/g, ''); // HHmmss
  const fileName = `lonkind_backup_${dateStamp}_${timeStamp}.json.gz`;

  const collectionsData: Record<string, Record<string, any>[]> = {};
  const docCounts: Record<string, number> = {};
  let totalDocs = 0;

  for (const colName of CRITICAL_BACKUP_COLLECTIONS) {
    try {
      const snap = await adminDb.collection(colName).limit(5000).get();
      if (snap.empty) {
        docCounts[colName] = 0;
        continue;
      }
      const docs = snap.docs.map((d) => ({
        _id: d.id,
        ...serializeFirestoreValue(d.data()),
      }));
      collectionsData[colName] = docs;
      docCounts[colName] = docs.length;
      totalDocs += docs.length;
    } catch (err) {
      console.warn(`[DatabaseBackup] Skipped collection ${colName}:`, err);
      docCounts[colName] = 0;
    }
  }

  const snapshotPayload = {
    schemaVersion: '1.0',
    app: 'Lonkind',
    exportedAt: now.toISOString(),
    retentionDays: BACKUP_RETENTION_DAYS,
    totalDocs,
    docCounts,
    collections: collectionsData,
  };

  const rawJson = Buffer.from(JSON.stringify(snapshotPayload), 'utf8');
  const gzipBuffer = zlib.gzipSync(rawJson, { level: 9 });

  return { gzipBuffer, fileName, docCounts, totalDocs };
}

/**
 * Encrypts a `.json.gz` snapshot buffer using AES-256-GCM for offline PC / USB safekeeping.
 * Format: JSON envelope `{ format, alg, iv, authTag, ciphertext }` (base64 encoded).
 */
export function encryptBackupBufferForDownload(gzipBuffer: Buffer): {
  encryptedBuffer: Buffer;
  encrypted: boolean;
} {
  const rawSecret =
    process.env.BACKUP_ENCRYPTION_KEY ||
    process.env.CRON_SECRET ||
    process.env.FLW_SECRET_KEY ||
    '';

  if (!rawSecret) {
    return { encryptedBuffer: gzipBuffer, encrypted: false };
  }

  const key = crypto.createHash('sha256').update(rawSecret, 'utf8').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(gzipBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope = {
    format: 'lonkind-encrypted-backup-v1',
    algorithm: 'aes-256-gcm',
    compression: 'gzip',
    createdAt: new Date().toISOString(),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return {
    encryptedBuffer: Buffer.from(JSON.stringify(envelope), 'utf8'),
    encrypted: true,
  };
}

/**
 * Uploads the compressed snapshot to private Firebase Cloud Storage (`backups/...`),
 * enforces the rolling 14-day retention policy, and records metadata in `system_backups`.
 */
export async function executeDatabaseBackup(params: {
  trigger: 'scheduled' | 'manual';
  actorUid: string;
}): Promise<BackupMetadataRecord> {
  const backupRef = adminDb.collection('system_backups').doc();
  const bucketName = resolveBackupBucketName();

  try {
    const { gzipBuffer, fileName, docCounts, totalDocs } =
      await buildCompressedSnapshotBuffer();
    const storagePath = `${BACKUP_PREFIX}${fileName}`;

    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);

    await file.save(gzipBuffer, {
      resumable: false,
      contentType: 'application/gzip',
      private: true,
      metadata: {
        cacheControl: 'no-store, max-age=0',
        metadata: {
          app: 'lonkind',
          trigger: params.trigger,
          actorUid: params.actorUid,
          totalDocs: String(totalDocs),
        },
      },
    });

    // Enforce rolling 14-day cloud retention policy (delete older archives)
    let prunedOldBackups = 0;
    try {
      const cutoffMs = Date.now() - BACKUP_RETENTION_MS;
      const [files] = await bucket.getFiles({ prefix: BACKUP_PREFIX });
      for (const f of files) {
        const createdIso = f.metadata?.timeCreated;
        const createdMs = createdIso ? Date.parse(createdIso) : 0;
        if (createdMs > 0 && createdMs < cutoffMs && f.name !== storagePath) {
          await f.delete().catch(() => {});
          prunedOldBackups += 1;
        }
      }
    } catch (pruneErr) {
      console.warn('[DatabaseBackup] Retention pruning warning:', pruneErr);
    }

    const recordData = {
      id: backupRef.id,
      fileName,
      storagePath,
      bucketName,
      sizeBytes: gzipBuffer.length,
      totalDocs,
      docCounts,
      trigger: params.trigger,
      status: 'healthy' as const,
      errorMessage: null,
      prunedOldBackups,
      createdByUid: params.actorUid,
      createdAt: FieldValue.serverTimestamp(),
    };

    await backupRef.set(recordData);

    return {
      ...recordData,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Database backup failed.';
    await backupRef.set({
      id: backupRef.id,
      fileName: 'failed',
      storagePath: '',
      bucketName,
      sizeBytes: 0,
      totalDocs: 0,
      docCounts: {},
      trigger: params.trigger,
      status: 'failed',
      errorMessage,
      prunedOldBackups: 0,
      createdByUid: params.actorUid,
      createdAt: FieldValue.serverTimestamp(),
    });
    throw err;
  }
}

/**
 * Fetches the latest healthy backup bytes from private Firebase Cloud Storage,
 * or generates a fresh in-memory compressed snapshot if no archive exists yet.
 */
export async function getLatestBackupGzipBuffer(backupId?: string): Promise<{
  gzipBuffer: Buffer;
  fileName: string;
  source: 'cloud_storage' | 'live_snapshot';
}> {
  try {
    let docSnap;
    if (backupId) {
      docSnap = await adminDb.collection('system_backups').doc(backupId).get();
    } else {
      const snap = await adminDb
        .collection('system_backups')
        .where('status', '==', 'healthy')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      docSnap = snap.docs[0];
    }

    if (docSnap?.exists) {
      const data = docSnap.data()!;
      const storagePath = String(data.storagePath || '');
      const bucketName = String(data.bucketName || resolveBackupBucketName());
      if (storagePath) {
        const [buffer] = await adminStorage.bucket(bucketName).file(storagePath).download();
        return {
          gzipBuffer: buffer,
          fileName: String(data.fileName || 'lonkind_backup.json.gz'),
          source: 'cloud_storage',
        };
      }
    }
  } catch (err) {
    console.warn('[DatabaseBackup] Cloud download fallback to live snapshot:', err);
  }

  const fresh = await buildCompressedSnapshotBuffer();
  return {
    gzipBuffer: fresh.gzipBuffer,
    fileName: fresh.fileName,
    source: 'live_snapshot',
  };
}
