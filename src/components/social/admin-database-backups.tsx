'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HardDriveDownload,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface BackupRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  totalDocs: number;
  trigger: 'scheduled' | 'manual';
  status: 'healthy' | 'failed';
  errorMessage?: string | null;
  prunedOldBackups?: number;
  createdAt: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AdminDatabaseBackups() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [lastHealthy, setLastHealthy] = useState<BackupRecord | null>(null);
  const [latest, setLatest] = useState<BackupRecord | null>(null);
  const [retentionDays, setRetentionDays] = useState(14);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/backups', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setBackups(data.backups || []);
      setLastHealthy(data.lastHealthy || null);
      setLatest(data.latest || null);
      setRetentionDays(data.retentionDays || 14);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleRunManualBackup = async () => {
    setIsRunning(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/backups/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not run manual backup.');
      }
      toast({
        title: '✅ Database Backup Complete',
        description: `Saved ${data.backup?.fileName} (${formatBytes(
          data.backup?.sizeBytes || 0
        )}, ${(data.backup?.totalDocs || 0).toLocaleString()} records) to private cloud storage.`,
      });
      await fetchBackups();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Backup Not Started',
        description: err.message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownloadEncrypted = async (backupId?: string) => {
    setIsDownloading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = backupId
        ? `/api/admin/backups/download?backupId=${encodeURIComponent(backupId)}`
        : '/api/admin/backups/download';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error ||
            '2FA verification required. Unlock the Super-Admin 2FA Security Shield above first.'
        );
      }

      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const nameMatch = disp.match(/filename="([^"]+)"/);
      const fileName = nameMatch?.[1] || `lonkind_backup_${new Date().toISOString().slice(0, 10)}.json.gz.enc`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      toast({
        title: '🔐 Encrypted Snapshot Downloaded',
        description: `Saved "${fileName}" (${formatBytes(blob.size)}) for offline PC / USB safekeeping.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Download Blocked',
        description: err.message,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const isHealthy = latest ? latest.status === 'healthy' : true;

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-500" />
            Database Backups &amp; Recovery
            <Badge
              className={
                isHealthy
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 text-[10px]'
                  : 'bg-rose-500/15 text-rose-500 border border-rose-500/40 text-[10px]'
              }
            >
              {latest ? (isHealthy ? 'Healthy' : 'Failed') : 'Ready'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Daily 03:00 AM WAT Gzip snapshots of users, wallets, transactions, payouts, ads &amp;
            audit logs stored in private cloud storage with {retentionDays}-day automatic retention.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBackups} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sky-500" /> Last Successful Backup
            </p>
            <p className="text-sm font-extrabold mt-1">
              {lastHealthy?.createdAt
                ? new Date(lastHealthy.createdAt).toLocaleString()
                : 'No backup run yet'}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <HardDriveDownload className="h-3.5 w-3.5 text-emerald-500" /> Compressed Size
            </p>
            <p className="text-sm font-extrabold mt-1">
              {lastHealthy
                ? `${formatBytes(lastHealthy.sizeBytes)} (${lastHealthy.totalDocs.toLocaleString()} docs)`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {isHealthy ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              )}
              Cloud Retention Policy
            </p>
            <p className="text-sm font-extrabold mt-1">Rolling {retentionDays} Days (Private)</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            onClick={handleRunManualBackup}
            disabled={isRunning}
            className="rounded-xl font-bold gap-1.5"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {isRunning ? 'Creating Snapshot...' : 'Run Manual Backup Now'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleDownloadEncrypted()}
            disabled={isDownloading}
            className="rounded-xl font-bold gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading ? 'Preparing Encrypted Archive...' : 'Download Encrypted Snapshot'}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Manual backup: 1/hour limit • Download requires 2FA unlock above
          </span>
        </div>

        {/* Recent Cloud Backups List */}
        {backups.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Recent Cloud Snapshots (Last {backups.length})
            </p>
            {backups.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border/70 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-bold text-foreground truncate">{b.fileName}</code>
                    <Badge variant="secondary" className="text-[10px]">
                      {b.trigger === 'scheduled' ? 'Daily 03:00 WAT' : 'Manual'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        b.status === 'healthy'
                          ? 'border-emerald-500/40 text-emerald-500 text-[10px]'
                          : 'border-rose-500/40 text-rose-500 text-[10px]'
                      }
                    >
                      {b.status === 'healthy' ? 'Healthy' : 'Failed'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(b.sizeBytes)} • {b.totalDocs.toLocaleString()} records
                    {b.createdAt ? ` • ${new Date(b.createdAt).toLocaleString()}` : ''}
                    {b.errorMessage ? ` • Error: ${b.errorMessage}` : ''}
                  </p>
                </div>
                {b.status === 'healthy' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isDownloading}
                    onClick={() => handleDownloadEncrypted(b.id)}
                    className="h-7 rounded-lg text-[11px] gap-1 shrink-0"
                  >
                    <Download className="h-3 w-3" /> Export
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
