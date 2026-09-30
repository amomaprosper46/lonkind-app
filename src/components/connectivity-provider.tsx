'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, WifiOff } from 'lucide-react';

export default function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  // Ping check to verify real internet connection and measure latency
  const checkInternetAccess = useCallback(async () => {
    const start = Date.now();
    try {
      const res = await fetch('/api/ping?ts=' + start, { method: 'GET', cache: 'no-store' });
      const ms = Date.now() - start;
      return { ok: res.ok, latency: ms };
    } catch (e) {
      return { ok: false, latency: null };
    }
  }, []);

  useEffect(() => {
    let pingInterval: NodeJS.Timeout;

    const handleOnline = async () => {
      const { ok, latency } = await checkInternetAccess();
      setIsOnline(ok);
      setLatency(latency);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLatency(null);
    };

    // Initial check on mount
    checkInternetAccess().then(({ ok, latency }) => {
      setIsOnline(ok && navigator.onLine);
      setLatency(latency);
      setIsInitialCheckDone(true);
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic ping every 30s
    pingInterval = setInterval(async () => {
      if (navigator.onLine) {
        const { ok, latency } = await checkInternetAccess();
        setIsOnline(ok);
        setLatency(latency);
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, [checkInternetAccess]);

  // Initial loading block until first check completes
  if (!isInitialCheckDone) return null;

  const slowThreshold = 1500; // ms
  const isSlow = latency !== null && latency > slowThreshold;

  if (!isOnline || isSlow) {
    const message = !isOnline ? 'No Internet Connection' : `Slow Network (${latency} ms) – Preparing…`;
    return (
      <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6">
        <div className="h-24 w-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-8 shadow-[0_0_100px_-15px_rgba(244,63,94,0.3)] animate-pulse">
          <WifiOff className="h-10 w-10 text-rose-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">{message}</h1>
        <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
          Connecting to network... Please check your internet connection to continue using Lonkind.
        </p>
        <div className="flex items-center gap-3 text-sm font-semibold text-rose-400 bg-rose-500/10 px-4 py-2.5 rounded-full">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for network
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
