'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, WifiOff, Share } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const DISMISS_STORAGE_KEY = 'lonkind-pwa-dismissed';

export default function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Register Service Worker for standalone PWA installability & offline shell
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[Lonkind PWA] Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('[Lonkind PWA] Service Worker registration warning:', err);
          });
      });

      // Also register immediately if document already loaded
      if (document.readyState === 'complete') {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
      }
    }

    // Monitor Online/Offline Status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      toast({
        variant: 'destructive',
        title: '📶 You are Offline',
        description: 'Viewing cached content. Connect to the internet for live updates.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const isAlreadyDismissed = (() => {
      try {
        return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
      } catch {
        return false;
      }
    })();

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any)?.standalone === true;

    // Android / Chrome native install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isAlreadyDismissed && !isStandalone) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Safari Add-to-Home-Screen prompt
    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari && !isStandalone && !isAlreadyDismissed) {
      setShowIosBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const dismissPrompt = () => {
    setShowInstallBanner(false);
    setShowIosBanner(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({ title: '🎉 Lonkind Installed!', description: 'Lonkind has been added to your home screen.' });
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  return (
    <>
      {/* Offline Status Top Bar */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg">
          <WifiOff className="h-4 w-4 animate-pulse" />
          <span>Offline Mode Active — Cached Content Available</span>
        </div>
      )}

      {/* Android / Chrome Native Install Prompt Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[90] max-w-sm bg-black border border-white/15 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon-192x192.png"
              alt="Lonkind"
              className="h-10 w-10 rounded-xl border border-white/15 shrink-0 object-cover"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-white truncate">Install Lonkind App</span>
              <span className="text-[11px] text-slate-300 truncate">
                Add to Home Screen for full-screen live mode
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="h-8 px-3 text-xs bg-white text-black hover:bg-slate-200 font-bold rounded-xl shadow-md gap-1"
            >
              <Download className="h-3.5 w-3.5" /> Install
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismissPrompt}
              aria-label="Dismiss install banner"
              className="h-7 w-7 text-slate-400 hover:text-white rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* iOS Safari Add-to-Home-Screen Helper Banner */}
      {showIosBanner && !showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-[90] max-w-sm mx-auto bg-black border border-white/15 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-start justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3 min-w-0">
            <img
              src="/icon-192x192.png"
              alt="Lonkind"
              className="h-10 w-10 rounded-xl border border-white/15 shrink-0 object-cover mt-0.5"
            />
            <div className="space-y-1 min-w-0">
              <p className="font-bold text-xs text-white">Add Lonkind to Home Screen</p>
              <p className="text-[11px] text-slate-300 leading-snug">
                Tap the <Share className="inline h-3.5 w-3.5 mx-0.5 text-sky-400" />{' '}
                <strong className="text-white">Share</strong> button in Safari, then choose{' '}
                <strong className="text-white">Add to Home Screen</strong>.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissPrompt}
            aria-label="Dismiss iOS install banner"
            className="h-7 w-7 text-slate-400 hover:text-white rounded-full shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}
