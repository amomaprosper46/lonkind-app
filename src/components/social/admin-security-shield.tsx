'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface AuditLogItem {
  id: string;
  action: string;
  actorUid: string;
  actorHandle: string | null;
  ipAddress: string;
  status: string;
  details: Record<string, any>;
  timestamp: string | null;
}

export function AdminSecurityShield({ showAuditTable = false }: { showAuditTable?: boolean }) {
  const [verified, setVerified] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/2fa/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setVerified(Boolean(data.verified));
      setExpiresAt(data.expiresAt || null);
      setAuditLogs(data.auditLogs || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRequestOtp = async () => {
    setIsRequesting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/2fa/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not request 2FA code.');
      setCodeSent(true);
      toast({
        title: '🔐 2FA Code Sent',
        description:
          data?.message ||
          'Check your email or private Lonkind notifications for your 6-digit security code.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '2FA Request Failed', description: err.message });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Invalid 2FA code.');
      setVerified(true);
      setExpiresAt(data.expiresAt || null);
      setOtpCode('');
      setCodeSent(false);
      toast({
        title: '✅ Super-Admin 2FA Unlocked',
        description:
          'Payout approvals, Flutterwave refunds, and role changes are unlocked for 15 minutes.',
      });
      await fetchStatus();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Verification Failed', description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!showAuditTable) {
    return (
      <div
        className={`rounded-2xl border px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          verified
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-amber-500/40 bg-amber-500/5'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {verified ? (
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5 text-xs">
            <p className="font-extrabold text-foreground flex items-center gap-2">
              Super-Admin 2FA Security Shield
              <Badge
                className={
                  verified
                    ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 text-[10px]'
                    : 'bg-amber-500/20 text-amber-500 border border-amber-500/40 text-[10px]'
                }
              >
                {verified ? '2FA UNLOCKED' : '2FA LOCKED'}
              </Badge>
            </p>
            <p className="text-muted-foreground">
              {verified
                ? `High-risk actions (payout approvals, Flutterwave refunds, role updates) unlocked${
                    expiresAt ? ` until ${new Date(expiresAt).toLocaleTimeString()}` : ''
                  }.`
                : 'Verify a 6-digit 2FA code before approving payouts, issuing Flutterwave refunds, or changing roles.'}
            </p>
          </div>
        </div>

        {!verified && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRequestOtp}
              disabled={isRequesting}
              className="rounded-xl h-8 text-xs font-bold gap-1.5"
            >
              {isRequesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              {codeSent ? 'Resend Code' : 'Send 6-Digit 2FA Code'}
            </Button>

            {codeSent && (
              <form onSubmit={handleVerifyOtp} className="flex items-center gap-1.5">
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className="h-8 w-28 text-xs font-mono tracking-widest rounded-xl"
                  maxLength={6}
                  required
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isVerifying || otpCode.length !== 6}
                  className="rounded-xl h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                >
                  {isVerifying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Verify
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-500" />
            Immutable Security Audit Trail (`security_audit_logs`)
          </CardTitle>
          <CardDescription className="text-xs">
            Append-only server audit trail recording admin logins, 2FA events, payout approvals,
            Flutterwave refunds, failed login spikes, and rejected webhook signatures.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : auditLogs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No security audit events recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-border/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-bold text-foreground">{log.action}</code>
                    <Badge
                      variant="outline"
                      className={
                        log.status === 'success'
                          ? 'border-emerald-500/40 text-emerald-500 text-[10px]'
                          : 'border-rose-500/40 text-rose-500 text-[10px]'
                      }
                    >
                      {log.status.toUpperCase()}
                    </Badge>
                    <span className="text-muted-foreground">
                      Actor: {log.actorHandle ? `@${log.actorHandle}` : log.actorUid}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    IP: <code>{log.ipAddress}</code>
                    {log.details && Object.keys(log.details).length > 0
                      ? ` • ${JSON.stringify(log.details)}`
                      : ''}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
