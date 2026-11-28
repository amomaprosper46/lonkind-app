'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Smartphone,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PowerOff,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface ProviderRow {
  id: 'firebase' | 'sendchamp' | 'backup_sms';
  label: string;
  description: string;
  enabled: boolean;
  priority: number;
  health: 'active' | 'low_credit_or_failed' | 'disabled';
  lastError?: string | null;
  lastFailedAt?: string | null;
}

export function AdminOtpFailoverMonitor() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/otp-providers', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setProviders(data.providers || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const toggleProvider = (id: ProviderRow['id'], enabled: boolean) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              enabled,
              health: enabled ? 'active' : 'disabled',
            }
          : p
      )
    );
  };

  const moveProvider = (index: number, direction: -1 | 1) => {
    setProviders((prev) => {
      const next = [...prev];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
      return next.map((p, idx) => ({ ...p, priority: idx + 1 }));
    });
  };

  const resetHealth = (id: ProviderRow['id']) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, health: p.enabled ? 'active' : 'disabled', lastError: null, lastFailedAt: null }
          : p
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/otp-providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ providers }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save OTP provider config.');
      setProviders(data.providers || providers);
      toast({
        title: '✅ SMS Failover Router Updated',
        description: 'Provider priorities and toggles are live immediately (no redeploy needed).',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-500" />
            SMS &amp; OTP Failover Monitor (3-Provider Auto-Router)
          </CardTitle>
          <CardDescription className="text-xs">
            Reorder or toggle Firebase Phone Auth, SendChamp, and Backup SMS live without
            redeploying. Out-of-credit or API errors fail over silently and log alerts in Security
            Audit.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProviders} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {providers.map((p, idx) => (
              <div
                key={p.id}
                className="rounded-xl border border-border/70 bg-muted/15 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Priority #{p.priority}
                    </Badge>
                    <span className="font-bold text-sm text-foreground">{p.label}</span>
                    {!p.enabled || p.health === 'disabled' ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <PowerOff className="h-3 w-3" /> Disabled
                      </Badge>
                    ) : p.health === 'low_credit_or_failed' ? (
                      <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/40 text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Low Credit / Failed
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.description}</p>
                  {p.lastError && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <p className="text-[11px] text-rose-500">
                        Last error: <code>{p.lastError}</code>
                      </p>
                      <button
                        type="button"
                        onClick={() => resetHealth(p.id)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Mark Topped Up / Healthy
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={idx === 0}
                    onClick={() => moveProvider(idx, -1)}
                    className="h-8 w-8 p-0 rounded-lg"
                    aria-label="Move up priority"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={idx === providers.length - 1}
                    onClick={() => moveProvider(idx, 1)}
                    className="h-8 w-8 p-0 rounded-lg"
                    aria-label="Move down priority"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={(v) => toggleProvider(p.id, v)}
                    aria-label={`Toggle ${p.label}`}
                  />
                </div>
              </div>
            ))}

            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl font-bold gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Provider Order &amp; Toggles
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
