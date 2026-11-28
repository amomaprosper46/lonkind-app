'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Home, Lock } from 'lucide-react';
import { isFirebaseConfigValid } from '@/lib/firebase';
import { SettingsProvider, useSettingsContext } from './settings-context';
import { SettingsRowSkeleton } from '@/components/ui/skeletons';

const PUBLIC_LEGAL_ROUTES = new Set([
  '/settings/privacy-policy',
  '/settings/terms',
  '/settings/support',
]);

function getPageMeta(pathname: string): { title: string; backHref: string; backLabel: string } {
  if (pathname === '/settings/promotions') {
    return { title: 'Ads & Promotions', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/wallet') {
    return { title: 'Creator Wallet', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/saved') {
    return { title: 'Saved Posts', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/privacy') {
    return { title: 'Privacy & Followers', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/privacy/followers') {
    return { title: 'Follower Requests', backHref: '/settings/privacy', backLabel: 'Privacy' };
  }
  if (pathname === '/settings/permissions') {
    return { title: 'App Permissions', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/network') {
    return { title: 'Network & Media', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/support') {
    return { title: 'Help & Support', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/privacy-policy') {
    return { title: 'Privacy Policy', backHref: '/settings', backLabel: 'Settings' };
  }
  if (pathname === '/settings/terms') {
    return { title: 'Terms of Service', backHref: '/settings', backLabel: 'Settings' };
  }
  return { title: 'Settings', backHref: '/', backLabel: 'Home' };
}

function SettingsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/settings';
  const { authLoading, isSignedIn } = useSettingsContext();
  const meta = getPageMeta(pathname);
  const isPublicLegalRoute = PUBLIC_LEGAL_ROUTES.has(pathname);

  if (!isFirebaseConfigValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-muted-foreground">
        Firebase configuration is unavailable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Clean Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="w-full max-w-[680px] mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link
            href={meta.backHref}
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{meta.backLabel}</span>
          </Link>

          <h1 className="text-sm sm:text-base font-extrabold tracking-tight truncate">
            {meta.title}
          </h1>

          <Link href="/" className="inline-flex items-center gap-1.5 shrink-0">
            <Image src="/logo.png" alt="Lonkind" width={24} height={24} className="rounded-md" />
          </Link>
        </div>
      </header>

      {/* Strict Single-Column Centered Container (max-width 680px on desktop, 16px side padding on mobile) */}
      <main className="flex-1 w-full max-w-[680px] mx-auto px-4 py-6 pb-16">
        {authLoading && !isPublicLegalRoute ? (
          <div className="space-y-5">
            <SettingsRowSkeleton count={3} />
            <SettingsRowSkeleton count={4} />
          </div>
        ) : !isSignedIn && !isPublicLegalRoute ? (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold">Sign In Required</h2>
              <p className="text-xs text-muted-foreground">
                Please sign in to access your Lonkind account settings and promotions.
              </p>
            </div>
            <Link href="/">
              <Button className="rounded-xl font-bold gap-2">
                <Home className="h-4 w-4" />
                Return to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <SettingsLayoutShell>{children}</SettingsLayoutShell>
    </SettingsProvider>
  );
}
