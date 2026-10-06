'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, WifiOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    }

    // Monitor Online/Offline Status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      toast({
        variant: 'destructive',
        title: '📶 You are Offline',
        description: 'Viewing cached posts. Connect to internet for live updates.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for PWA Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({ title: '🎉 Lonkind Installed!', description: 'App added to your home screen.' });
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

      {/* PWA Mobile Native Install Prompt Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[90] max-w-sm bg-slate-900 border border-indigo-500/40 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-600 flex items-center justify-center font-black text-white text-lg shadow-md shrink-0">
              L
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs">Install Lonkind App</span>
              <span className="text-[11px] text-slate-400">Fast, offline-capable mobile experience</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl shadow-md gap-1"
            >
              <Download className="h-3.5 w-3.5" /> Install
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInstallBanner(false)}
              className="h-7 w-7 text-slate-400 hover:text-white rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
