'use client';

import { useCallback, useEffect, useState } from 'react';

export type AutoPlayOption = 'wifi_only' | 'always' | 'never';
export type MediaQualityOption = 'high' | 'standard' | 'data_saver';
export type SyncFrequencyOption = 'realtime' | 'every_15_min' | 'manual';

export interface NetworkSettingsState {
  dataSaverMode: boolean;
  autoPlayVideos: AutoPlayOption;
  mediaDownloadQuality: MediaQualityOption;
  backgroundDataSync: boolean;
  syncFrequency: SyncFrequencyOption;
  autoRetryFailedRequests: boolean;
}

export const DEFAULT_NETWORK_SETTINGS: NetworkSettingsState = {
  dataSaverMode: false,
  autoPlayVideos: 'wifi_only',
  mediaDownloadQuality: 'standard',
  backgroundDataSync: true,
  syncFrequency: 'realtime',
  autoRetryFailedRequests: true,
};

export const NETWORK_SETTINGS_STORAGE_KEY = 'lonkind_network_settings_v1';

/**
 * Endpoints that MUST NEVER be auto-retried from an offline queue so
 * coin purchases, wallet credits, or creator payouts can never double-submit.
 */
export const NON_RETRYABLE_FINANCIAL_PATHS = [
  '/api/payments/',
  '/api/paystack/',
  '/api/flutterwave/',
  '/api/payouts/',
  '/api/wallet/',
  '/api/coins/',
  '/api/withdraw',
  '/api/checkout',
] as const;

export function isSafeForOfflineAutoRetry(urlOrPath: string): boolean {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;
  const normalized = urlOrPath.trim().toLowerCase();
  return !NON_RETRYABLE_FINANCIAL_PATHS.some((prefix) => normalized.includes(prefix));
}

export function loadNetworkSettingsSafe(): NetworkSettingsState {
  if (typeof window === 'undefined') return DEFAULT_NETWORK_SETTINGS;
  try {
    const raw = window.localStorage.getItem(NETWORK_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_NETWORK_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      dataSaverMode:
        typeof parsed?.dataSaverMode === 'boolean'
          ? parsed.dataSaverMode
          : DEFAULT_NETWORK_SETTINGS.dataSaverMode,
      autoPlayVideos:
        parsed?.autoPlayVideos === 'wifi_only' ||
        parsed?.autoPlayVideos === 'always' ||
        parsed?.autoPlayVideos === 'never'
          ? parsed.autoPlayVideos
          : DEFAULT_NETWORK_SETTINGS.autoPlayVideos,
      mediaDownloadQuality:
        parsed?.mediaDownloadQuality === 'high' ||
        parsed?.mediaDownloadQuality === 'standard' ||
        parsed?.mediaDownloadQuality === 'data_saver'
          ? parsed.mediaDownloadQuality
          : DEFAULT_NETWORK_SETTINGS.mediaDownloadQuality,
      backgroundDataSync:
        typeof parsed?.backgroundDataSync === 'boolean'
          ? parsed.backgroundDataSync
          : DEFAULT_NETWORK_SETTINGS.backgroundDataSync,
      syncFrequency:
        parsed?.syncFrequency === 'realtime' ||
        parsed?.syncFrequency === 'every_15_min' ||
        parsed?.syncFrequency === 'manual'
          ? parsed.syncFrequency
          : DEFAULT_NETWORK_SETTINGS.syncFrequency,
      autoRetryFailedRequests:
        typeof parsed?.autoRetryFailedRequests === 'boolean'
          ? parsed.autoRetryFailedRequests
          : DEFAULT_NETWORK_SETTINGS.autoRetryFailedRequests,
    };
  } catch {
    return DEFAULT_NETWORK_SETTINGS;
  }
}

export function saveNetworkSettingsSafe(next: NetworkSettingsState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(NETWORK_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function estimateNetworkCacheBytes(): number {
  if (typeof window === 'undefined') return 0;
  try {
    let bytes = 0;
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (!k) continue;
      const v = window.sessionStorage.getItem(k) || '';
      bytes += (k.length + v.length) * 2;
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === NETWORK_SETTINGS_STORAGE_KEY || k === 'lonkind_user_settings_cache') continue;
      if (k.startsWith('firebase:')) continue;
      const v = window.localStorage.getItem(k) || '';
      bytes += (k.length + v.length) * 2;
    }
    return bytes;
  } catch {
    return 0;
  }
}

export function formatBytesHuman(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export async function clearNetworkCacheSafely(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore storage errors
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      // Preserve auth, user settings, and network settings
      if (
        k === NETWORK_SETTINGS_STORAGE_KEY ||
        k === 'lonkind_user_settings_cache' ||
        k.startsWith('firebase:') ||
        k.startsWith('lonkind_layout') ||
        k.startsWith('lonkind_language')
      ) {
        continue;
      }
      if (k.includes('cache') || k.includes('feed') || k.includes('thumb')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !name.includes('auth'))
          .map((name) => window.caches.delete(name))
      );
    }
  } catch {
    // Ignore Cache API errors
  }
}

export type ConnectionQuality = 'strong' | 'slow' | 'offline';

export interface LiveConnectionInfo {
  quality: ConnectionQuality;
  statusLabel: string;
  connectionTypeLabel: string;
  latencyMs: number | null;
  isTesting: boolean;
  lastTestedAt: string | null;
  testConnection: () => Promise<{ ok: boolean; latencyMs: number | null }>;
}

export function useLiveConnectionStatus(): LiveConnectionInfo {
  const [quality, setQuality] = useState<ConnectionQuality>('strong');
  const [connectionTypeLabel, setConnectionTypeLabel] = useState<string>('Wi-Fi / Network');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  const readNavigatorConnection = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) {
      setQuality('offline');
      setConnectionTypeLabel('No Connection');
      return;
    }

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const rawType = String(conn.type || '').toLowerCase();
      const effectiveType = String(conn.effectiveType || '').toLowerCase();
      const rtt = typeof conn.rtt === 'number' ? conn.rtt : null;

      if (rawType === 'wifi') {
        setConnectionTypeLabel('Wi-Fi');
      } else if (rawType === 'cellular') {
        setConnectionTypeLabel(effectiveType ? `Mobile Data (${effectiveType.toUpperCase()})` : 'Mobile Data');
      } else if (rawType === 'ethernet') {
        setConnectionTypeLabel('Ethernet');
      } else if (effectiveType) {
        setConnectionTypeLabel(
          effectiveType === '4g' ? 'Wi-Fi / 4G' : `Mobile Data (${effectiveType.toUpperCase()})`
        );
      } else {
        setConnectionTypeLabel('Wi-Fi / Network');
      }

      if (effectiveType === 'slow-2g' || effectiveType === '2g' || (rtt !== null && rtt > 450)) {
        setQuality('slow');
      } else {
        setQuality('strong');
      }
      if (rtt !== null && rtt > 0) {
        setLatencyMs((prev) => (prev === null ? rtt : prev));
      }
    } else {
      setQuality('strong');
      setConnectionTypeLabel('Wi-Fi / Network');
    }
  }, []);

  useEffect(() => {
    readNavigatorConnection();
    if (typeof window === 'undefined') return;

    const onOnline = () => readNavigatorConnection();
    const onOffline = () => {
      setQuality('offline');
      setConnectionTypeLabel('No Connection');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const conn = (navigator as any).connection;
    if (conn?.addEventListener) {
      conn.addEventListener('change', readNavigatorConnection);
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (conn?.removeEventListener) {
        conn.removeEventListener('change', readNavigatorConnection);
      }
    };
  }, [readNavigatorConnection]);

  const testConnection = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) {
      setQuality('offline');
      setLatencyMs(null);
      return { ok: false, latencyMs: null };
    }

    setIsTesting(true);
    const started = performance.now();
    try {
      const res = await fetch('/robots.txt', { method: 'HEAD', cache: 'no-store' });
      const elapsed = Math.max(1, Math.round(performance.now() - started));
      setLatencyMs(elapsed);
      setLastTestedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (!res.ok) {
        setQuality('slow');
        return { ok: false, latencyMs: elapsed };
      }
      setQuality(elapsed > 450 ? 'slow' : 'strong');
      return { ok: true, latencyMs: elapsed };
    } catch {
      setQuality(navigator.onLine ? 'slow' : 'offline');
      setLatencyMs(null);
      return { ok: false, latencyMs: null };
    } finally {
      setIsTesting(false);
    }
  }, []);

  const statusLabel =
    quality === 'offline'
      ? 'Offline'
      : quality === 'slow'
      ? 'Slow Connection'
      : 'Connected • Strong';

  return {
    quality,
    statusLabel,
    connectionTypeLabel,
    latencyMs,
    isTesting,
    lastTestedAt,
    testConnection,
  };
}
