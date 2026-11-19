'use client';

import React, { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  Gauge,
  RefreshCw,
  CloudOff,
  ChevronRight,
  ChevronLeft,
  Trash2,
  ShieldAlert,
  PlayCircle,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  Signal,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SettingsRouteId, UserSettings } from '@/lib/settings-schema';
import {
  clearNetworkCacheSafely,
  estimateNetworkCacheBytes,
  formatBytesHuman,
  loadNetworkSettingsSafe,
  NON_RETRYABLE_FINANCIAL_PATHS,
  saveNetworkSettingsSafe,
  useLiveConnectionStatus,
  type AutoPlayOption,
  type MediaQualityOption,
  type SyncFrequencyOption,
} from '@/lib/network-settings';

interface NetworkMenuProps {
  settings: UserSettings;
  updateSettings: (updater: (prev: UserSettings) => UserSettings) => Promise<boolean>;
  onNavigate?: (route: SettingsRouteId) => void;
}

function syncNetworkToLocalStorage(ds: UserSettings['dataStorage']) {
  saveNetworkSettingsSafe({
    dataSaverMode: ds.dataSaverMode,
    autoPlayVideos: ds.autoPlayVideos,
    mediaDownloadQuality: ds.mediaDownloadQuality,
    backgroundDataSync: ds.backgroundDataSync,
    syncFrequency: ds.syncFrequency,
    autoRetryFailedRequests: ds.autoRetryFailedRequests,
  });
}

// ============================================================================
// TOP SUMMARY CARD: LIVE CONNECTION STATUS
// ============================================================================
export function ConnectionStatusCard() {
  const conn = useLiveConnectionStatus();

  const handleTest = async () => {
    const result = await conn.testConnection();
    if (result.ok) {
      toast({
        title: 'Connection Looks Good',
        description: `Reachable in ${result.latencyMs} ms over ${conn.connectionTypeLabel}.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Connection Issue Detected',
        description: 'Your device appears offline or experiencing high latency.',
      });
    }
  };

  const badgeClasses =
    conn.quality === 'offline'
      ? 'border-rose-500/40 bg-rose-500/15 text-rose-500 dark:text-rose-400'
      : conn.quality === 'slow'
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';

  const iconWrapperClasses =
    conn.quality === 'offline'
      ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
      : conn.quality === 'slow'
      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
            <div
              className={cn(
                'h-11 w-11 rounded-xl border flex items-center justify-center shrink-0',
                iconWrapperClasses
              )}
            >
              {conn.quality === 'offline' ? (
                <WifiOff className="h-5 w-5" />
              ) : (
                <Wifi className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">Connection Status</span>
                <Badge variant="outline" className={cn('text-[11px] font-semibold', badgeClasses)}>
                  {conn.statusLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Signal className="h-3.5 w-3.5 shrink-0" />
                  {conn.connectionTypeLabel}
                </span>
                {conn.latencyMs !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5 shrink-0" />
                    {conn.latencyMs} ms
                  </span>
                )}
                {conn.lastTestedAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Tested {conn.lastTestedAt}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={conn.isTesting}
            className="rounded-xl gap-2 shrink-0 w-full sm:w-auto font-semibold"
          >
            {conn.isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4 text-primary" />
            )}
            {conn.isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 1: NETWORK SETTINGS HUB (NESTED SUB-MENU LAUNCHER)
// ============================================================================
export function NetworkSettingsHub({ settings, updateSettings, onNavigate }: NetworkMenuProps) {
  const ds = settings.dataStorage;

  // Hydrate localStorage fallback on first render if needed without overwriting Firestore
  useEffect(() => {
    const local = loadNetworkSettingsSafe();
    saveNetworkSettingsSafe({
      dataSaverMode: ds.dataSaverMode ?? local.dataSaverMode,
      autoPlayVideos: ds.autoPlayVideos ?? local.autoPlayVideos,
      mediaDownloadQuality: ds.mediaDownloadQuality ?? local.mediaDownloadQuality,
      backgroundDataSync: ds.backgroundDataSync ?? local.backgroundDataSync,
      syncFrequency: ds.syncFrequency ?? local.syncFrequency,
      autoRetryFailedRequests: ds.autoRetryFailedRequests ?? local.autoRetryFailedRequests,
    });
  }, [ds]);

  const rows: {
    route: SettingsRouteId;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    status: string;
  }[] = [
    {
      route: 'network-data-saver',
      icon: Gauge,
      iconBg: 'bg-indigo-500/15 border-indigo-500/25',
      iconColor: 'text-indigo-500',
      title: 'Data Usage & Saver',
      description: 'Control mobile data saver, video auto-play, media quality, and cache.',
      status: ds.dataSaverMode ? 'Saver On' : 'Standard',
    },
    {
      route: 'network-background-sync',
      icon: RefreshCw,
      iconBg: 'bg-cyan-500/15 border-cyan-500/25',
      iconColor: 'text-cyan-500',
      title: 'Background Sync & Notifications',
      description: 'Keep messages, follow requests, and coin balance fresh automatically.',
      status: ds.backgroundDataSync
        ? ds.syncFrequency === 'realtime'
          ? 'Real-Time'
          : ds.syncFrequency === 'every_15_min'
          ? 'Every 15m'
          : 'Manual'
        : 'Paused',
    },
    {
      route: 'network-offline-queue',
      icon: CloudOff,
      iconBg: 'bg-emerald-500/15 border-emerald-500/25',
      iconColor: 'text-emerald-500',
      title: 'Offline Mode & Queue',
      description: 'Safely retry messages when reconnected while protecting financial actions.',
      status: ds.autoRetryFailedRequests ? 'Auto-Retry On' : 'Manual',
    },
  ];

  // Keep quick reference to updateSettings to avoid unused prop lint
  void updateSettings;

  return (
    <div className="space-y-4">
      <ConnectionStatusCard />

      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="px-4 py-4 sm:px-5 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-sm font-bold">Network Preferences</CardTitle>
          <CardDescription className="text-xs">
            Choose a category below to fine-tune how Lonkind uses Wi-Fi, mobile data, and offline sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          {rows.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => onNavigate?.(item.route)}
                className="w-full px-4 py-4 sm:px-5 flex items-center justify-between gap-3.5 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-muted/50"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl border flex items-center justify-center shrink-0',
                      item.iconBg
                    )}
                  >
                    <Icon className={cn('h-5 w-5', item.iconColor)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="hidden xs:inline-flex text-[11px] font-medium">
                    {item.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STACK LEVEL 2A: DATA USAGE & SAVER SUB-MENU
// ============================================================================
export function NetworkDataSaverSubMenu({
  settings,
  updateSettings,
}: Omit<NetworkMenuProps, 'onNavigate'>) {
  const ds = settings.dataStorage;
  const [cacheBytes, setCacheBytes] = useState<number>(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setCacheBytes(estimateNetworkCacheBytes());
  }, []);

  const patchDataStorage = async (patch: Partial<UserSettings['dataStorage']>) => {
    const nextDs = { ...ds, ...patch };
    syncNetworkToLocalStorage(nextDs);
    await updateSettings((prev) => ({
      ...prev,
      dataStorage: { ...prev.dataStorage, ...patch },
    }));
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await clearNetworkCacheSafely();
      setCacheBytes(estimateNetworkCacheBytes());
      toast({
        title: 'Network Cache Cleared',
        description: 'Temporary media and feed caches were removed without signing you out.',
      });
    } finally {
      setClearing(false);
    }
  };

  const autoPlayOptions: { id: AutoPlayOption; label: string; hint: string }[] = [
    { id: 'wifi_only', label: 'Wi-Fi Only', hint: 'Saves mobile data' },
    { id: 'always', label: 'Wi-Fi & Mobile Data', hint: 'Instant playback' },
    { id: 'never', label: 'Never', hint: 'Tap to play videos' },
  ];

  const qualityOptions: { id: MediaQualityOption; label: string; hint: string }[] = [
    { id: 'high', label: 'High', hint: 'Crisp HD media' },
    { id: 'standard', label: 'Standard', hint: 'Balanced speed' },
    { id: 'data_saver', label: 'Data Saver', hint: 'Lowest data use' },
  ];

  return (
    <div className="space-y-4">
      {/* Data Saver Mode */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="px-4 py-4 sm:px-5 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gauge className="h-4 w-4 text-indigo-500 shrink-0" />
            Data Usage &amp; Saver
          </CardTitle>
          <CardDescription className="text-xs">
            Reduce cellular data usage while browsing feeds, images, and live streams.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-border/50">
          {/* Row 1: Data Saver Mode Toggle */}
          <div className="px-4 py-4 sm:px-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Label className="text-sm font-semibold text-foreground block">
                Data Saver Mode
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Lowers image and video resolution automatically when using mobile data.
              </p>
            </div>
            <Switch
              className="shrink-0"
              checked={ds.dataSaverMode}
              onCheckedChange={(checked) =>
                patchDataStorage({
                  dataSaverMode: checked,
                  ...(checked ? { mediaDownloadQuality: 'data_saver', autoPlayVideos: 'wifi_only' } : {}),
                })
              }
              aria-label="Toggle Data Saver Mode"
            />
          </div>

          {/* Row 2: Auto-Play Videos Selector */}
          <div className="px-4 py-4 sm:px-5 space-y-3">
            <div className="min-w-0">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-indigo-500 shrink-0" />
                Auto-Play Videos
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Choose when feed videos and live stream previews play automatically.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {autoPlayOptions.map((opt) => {
                const selected = ds.autoPlayVideos === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchDataStorage({ autoPlayVideos: opt.id })}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border/70 bg-background hover:bg-muted/40'
                    )}
                  >
                    <p className="text-xs font-bold text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Media Download Quality Selector */}
          <div className="px-4 py-4 sm:px-5 space-y-3">
            <div className="min-w-0">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Download className="h-4 w-4 text-cyan-500 shrink-0" />
                Media Download Quality
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Controls quality for downloaded photos, clips, and chat attachments.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {qualityOptions.map((opt) => {
                const selected = ds.mediaDownloadQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchDataStorage({ mediaDownloadQuality: opt.id })}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border/70 bg-background hover:bg-muted/40'
                    )}
                  >
                    <p className="text-xs font-bold text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Live Data Usage Breakdown & Cache Clear */}
          <div className="px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Live Network Cache</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  {formatBytesHuman(cacheBytes)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Temporary thumbnails and session files stored on this device. Clearing keeps your login and settings safe.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={clearing}
              onClick={handleClearCache}
              className="rounded-xl gap-2 shrink-0 w-full sm:w-auto font-semibold"
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-rose-500" />
              )}
              {clearing ? 'Clearing...' : 'Clear Network Cache'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STACK LEVEL 2B: BACKGROUND SYNC & NOTIFICATIONS SUB-MENU
// ============================================================================
export function NetworkBackgroundSyncSubMenu({
  settings,
  updateSettings,
}: Omit<NetworkMenuProps, 'onNavigate'>) {
  const ds = settings.dataStorage;

  const patchDataStorage = async (patch: Partial<UserSettings['dataStorage']>) => {
    const nextDs = { ...ds, ...patch };
    syncNetworkToLocalStorage(nextDs);
    await updateSettings((prev) => ({
      ...prev,
      dataStorage: { ...prev.dataStorage, ...patch },
    }));
  };

  const frequencyOptions: { id: SyncFrequencyOption; label: string; hint: string }[] = [
    { id: 'realtime', label: 'Real-Time', hint: 'Instant live updates' },
    { id: 'every_15_min', label: 'Every 15 Minutes', hint: 'Saves battery & data' },
    { id: 'manual', label: 'Manual Only', hint: 'Refresh when you open' },
  ];

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="px-4 py-4 sm:px-5 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-cyan-500 shrink-0" />
          Background Sync &amp; Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Choose how often Lonkind checks for new messages, follow requests, and coin balance updates.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-border/50">
        <div className="px-4 py-4 sm:px-5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label className="text-sm font-semibold text-foreground block">
              Background Data Sync
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Keep messages, follow requests, and coin balance updated automatically in the background.
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={ds.backgroundDataSync}
            onCheckedChange={(checked) => patchDataStorage({ backgroundDataSync: checked })}
            aria-label="Toggle Background Data Sync"
          />
        </div>

        <div
          className={cn(
            'px-4 py-4 sm:px-5 space-y-3 transition-opacity',
            ds.backgroundDataSync ? 'opacity-100' : 'opacity-55 pointer-events-none'
          )}
        >
          <div className="min-w-0">
            <Label className="text-sm font-semibold text-foreground block">Sync Frequency</Label>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {ds.backgroundDataSync
                ? 'Pick how frequently Lonkind syncs new activity.'
                : 'Turn on Background Data Sync above to choose a sync schedule.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {frequencyOptions.map((opt) => {
              const selected = ds.syncFrequency === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!ds.backgroundDataSync}
                  onClick={() => patchDataStorage({ syncFrequency: opt.id })}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition-all',
                    selected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border/70 bg-background hover:bg-muted/40'
                  )}
                >
                  <p className="text-xs font-bold text-foreground">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</p>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 2C: OFFLINE MODE & QUEUE SUB-MENU
// ============================================================================
export function NetworkOfflineQueueSubMenu({
  settings,
  updateSettings,
}: Omit<NetworkMenuProps, 'onNavigate'>) {
  const ds = settings.dataStorage;

  const patchDataStorage = async (patch: Partial<UserSettings['dataStorage']>) => {
    const nextDs = { ...ds, ...patch };
    syncNetworkToLocalStorage(nextDs);
    await updateSettings((prev) => ({
      ...prev,
      dataStorage: { ...prev.dataStorage, ...patch },
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="px-4 py-4 sm:px-5 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CloudOff className="h-4 w-4 text-emerald-500 shrink-0" />
            Offline Mode &amp; Queue
          </CardTitle>
          <CardDescription className="text-xs">
            Stay productive even when your signal drops briefly.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-border/50">
          <div className="px-4 py-4 sm:px-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Label className="text-sm font-semibold text-foreground block">
                Auto-Retry Failed Requests
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Safely queues non-financial actions (like chat messages and likes) when offline and sends them once reconnected.
              </p>
            </div>
            <Switch
              className="shrink-0"
              checked={ds.autoRetryFailedRequests}
              onCheckedChange={(checked) => patchDataStorage({ autoRetryFailedRequests: checked })}
              aria-label="Toggle Auto-Retry Failed Requests"
            />
          </div>

          <div className="px-4 py-4 sm:px-5 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  Financial Transaction Protection Active
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  For your safety, coin purchases, wallet top-ups, and creator payouts are{' '}
                  <strong className="text-foreground">never</strong> auto-retried offline. This
                  prevents accidental double charges when your connection returns.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Protected routes: {NON_RETRYABLE_FINANCIAL_PATHS.length} payment &amp; payout
                  endpoints permanently excluded.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STANDALONE WRAPPER FOR /settings/network ROUTE
// ============================================================================
export function StandaloneNetworkSettings({
  settings,
  updateSettings,
}: Omit<NetworkMenuProps, 'onNavigate'>) {
  const [subRoute, setSubRoute] = useState<SettingsRouteId>('network');

  const subTitles: Record<string, string> = {
    'network-data-saver': 'Data Usage & Saver',
    'network-background-sync': 'Background Sync & Notifications',
    'network-offline-queue': 'Offline Mode & Queue',
  };

  return (
    <div className="space-y-5">
      {subRoute !== 'network' && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSubRoute('network')}
            className="rounded-xl gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Network Settings
          </Button>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-semibold text-foreground truncate">
            {subTitles[subRoute]}
          </span>
        </div>
      )}

      {subRoute === 'network' && (
        <NetworkSettingsHub
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={setSubRoute}
        />
      )}
      {subRoute === 'network-data-saver' && (
        <NetworkDataSaverSubMenu settings={settings} updateSettings={updateSettings} />
      )}
      {subRoute === 'network-background-sync' && (
        <NetworkBackgroundSyncSubMenu settings={settings} updateSettings={updateSettings} />
      )}
      {subRoute === 'network-offline-queue' && (
        <NetworkOfflineQueueSubMenu settings={settings} updateSettings={updateSettings} />
      )}
    </div>
  );
}
