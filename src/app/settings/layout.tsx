'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Wallet,
  Bookmark,
  Shield,
  UserPlus,
  LogOut,
  Loader2,
  Lock,
  Home,
  HelpCircle,
  FileText,
  Scale,
  Sliders,
  Wifi,
} from 'lucide-react';
import { isFirebaseConfigValid } from '@/lib/firebase';
import { SettingsProvider, useSettingsContext } from './settings-context';
import { cn } from '@/lib/utils';

interface NavGroup {
  section: string;
  items: {
    href: string;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    badgeKey?: 'coins' | 'saved' | 'pending';
  }[];
}

const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    section: 'Account',
    items: [
      {
        href: '/settings',
        label: 'Account & Profile',
        shortLabel: 'Account',
        icon: User,
        iconColor: 'text-indigo-400',
      },
    ],
  },
  {
    section: 'Billing & Finance',
    items: [
      {
        href: '/settings/wallet',
        label: 'Creator Wallet',
        shortLabel: 'Wallet',
        icon: Wallet,
        iconColor: 'text-amber-400',
        badgeKey: 'coins',
      },
    ],
  },
  {
    section: 'Activity & Content',
    items: [
      {
        href: '/settings/saved',
        label: 'Saved Posts',
        shortLabel: 'Saved',
        icon: Bookmark,
        iconColor: 'text-purple-400',
        badgeKey: 'saved',
      },
    ],
  },
  {
    section: 'Privacy & Safety',
    items: [
      {
        href: '/settings/privacy',
        label: 'Privacy & Security',
        shortLabel: 'Privacy',
        icon: Shield,
        iconColor: 'text-emerald-400',
      },
      {
        href: '/settings/privacy/followers',
        label: 'Follower Requests',
        shortLabel: 'Followers',
        icon: UserPlus,
        iconColor: 'text-cyan-400',
        badgeKey: 'pending',
      },
      {
        href: '/settings/permissions',
        label: 'App Permissions Manager',
        shortLabel: 'Permissions',
        icon: Sliders,
        iconColor: 'text-violet-400',
      },
      {
        href: '/settings/network',
        label: 'Network Settings',
        shortLabel: 'Network',
        icon: Wifi,
        iconColor: 'text-sky-400',
      },
    ],
  },
  {
    section: 'Legal & Support',
    items: [
      {
        href: '/settings/support',
        label: 'Help & Support',
        shortLabel: 'Support',
        icon: HelpCircle,
        iconColor: 'text-sky-400',
      },
      {
        href: '/settings/privacy-policy',
        label: 'Privacy Policy',
        shortLabel: 'Privacy Policy',
        icon: FileText,
        iconColor: 'text-emerald-400',
      },
      {
        href: '/settings/terms',
        label: 'Terms of Service',
        shortLabel: 'Terms',
        icon: Scale,
        iconColor: 'text-amber-400',
      },
    ],
  },
];

const PUBLIC_LEGAL_ROUTES = new Set([
  '/settings/support',
  '/settings/privacy-policy',
  '/settings/terms',
]);

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [{ label: 'Settings', href: '/settings' }];
  if (pathname === '/settings/wallet') {
    crumbs.push({ label: 'Wallet', href: '/settings/wallet' });
  } else if (pathname === '/settings/saved') {
    crumbs.push({ label: 'Saved Posts', href: '/settings/saved' });
  } else if (pathname === '/settings/privacy') {
    crumbs.push({ label: 'Privacy & Safety', href: '/settings/privacy' });
  } else if (pathname === '/settings/privacy/followers') {
    crumbs.push({ label: 'Privacy & Safety', href: '/settings/privacy' });
    crumbs.push({ label: 'Follower Requests', href: '/settings/privacy/followers' });
  } else if (pathname === '/settings/support') {
    crumbs.push({ label: 'Help & Support', href: '/settings/support' });
  } else if (pathname === '/settings/privacy-policy') {
    crumbs.push({ label: 'Privacy Policy', href: '/settings/privacy-policy' });
  } else if (pathname === '/settings/terms') {
    crumbs.push({ label: 'Terms of Service', href: '/settings/terms' });
  }
  return crumbs;
}

function getMobileBackTarget(pathname: string): { href: string; label: string } {
  if (pathname === '/settings/privacy/followers') {
    return { href: '/settings/privacy', label: 'Settings / Privacy' };
  }
  if (pathname === '/settings/wallet') {
    return { href: '/settings', label: 'Settings / Wallet' };
  }
  if (pathname === '/settings/saved') {
    return { href: '/settings', label: 'Settings / Saved Posts' };
  }
  if (pathname === '/settings/privacy') {
    return { href: '/settings', label: 'Settings / Privacy & Safety' };
  }
  if (pathname === '/settings/support') {
    return { href: '/settings', label: 'Settings / Help & Support' };
  }
  if (pathname === '/settings/privacy-policy') {
    return { href: '/settings', label: 'Settings / Privacy Policy' };
  }
  if (pathname === '/settings/terms') {
    return { href: '/settings', label: 'Settings / Terms of Service' };
  }
  return { href: '/', label: 'Back to Dashboard' };
}

function SettingsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/settings';
  const {
    currentUser,
    authLoading,
    isSignedIn,
    savedPostIds,
    pendingRequestsCount,
    onSignOut,
  } = useSettingsContext();

  const breadcrumbs = getBreadcrumbs(pathname);
  const mobileBack = getMobileBackTarget(pathname);
  const isPublicLegalRoute = PUBLIC_LEGAL_ROUTES.has(pathname);
  const visibleGroups = isSignedIn
    ? SETTINGS_NAV_GROUPS
    : SETTINGS_NAV_GROUPS.filter((g) => g.section === 'Legal & Support');
  const allFlatItems = visibleGroups.flatMap((g) => g.items);

  const renderBadge = (badgeKey?: 'coins' | 'saved' | 'pending') => {
    if (badgeKey === 'coins' && currentUser) {
      return (
        <Badge variant="secondary" className="text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {(currentUser.coins || 0).toLocaleString()}
        </Badge>
      );
    }
    if (badgeKey === 'saved' && savedPostIds.size > 0) {
      return (
        <Badge variant="secondary" className="text-[10px] font-bold">
          {savedPostIds.size}
        </Badge>
      );
    }
    if (badgeKey === 'pending' && pendingRequestsCount > 0) {
      return (
        <Badge className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0">
          {pendingRequestsCount}
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Top Sticky Header (Mobile Back-Button Header + Desktop Brand & Breadcrumb Bar) */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container max-w-6xl mx-auto h-16 px-4 flex items-center justify-between gap-3">
          {/* Mobile / Tablet Back-Button Header (e.g., "← Settings / Wallet") */}
          <div className="flex items-center gap-2 lg:hidden min-w-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-xl -ml-2 gap-1.5 font-bold text-sm text-foreground hover:bg-secondary/60"
            >
              <Link href={mobileBack.href}>
                <ChevronLeft className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="truncate">{mobileBack.label}</span>
              </Link>
            </Button>
          </div>

          {/* Wide Desktop Brand Logo + Breadcrumb Trail */}
          <div className="hidden lg:flex items-center gap-4 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <Image
                src="/logo.png"
                alt="Lonkind Logo"
                width={34}
                height={34}
                className="h-9 w-9 rounded-xl object-cover border border-cyan-400/40 shadow-md shadow-blue-500/20"
              />
              <span className="text-lg font-bold tracking-tight">Lonkind</span>
            </Link>

            <div className="h-5 w-[1px] bg-border" />

            <nav aria-label="Settings breadcrumb" className="flex items-center gap-1 text-xs font-semibold">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.href}>
                    {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
                    {isLast ? (
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right Quick Home Button */}
          <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs font-semibold shrink-0">
            <Link href="/">
              <Home className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Back to Feed</span>
              <span className="sm:hidden">Feed</span>
            </Link>
          </Button>
        </div>

        {/* Mobile/Tablet Instant Horizontal Sub-Navigation Pills */}
        {(isSignedIn || isPublicLegalRoute) && (
          <div className="lg:hidden border-t border-border/40 bg-background/70 px-3 py-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 min-w-max">
              {allFlatItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border',
                      active
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/70'
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', active ? 'text-white' : item.iconColor)} />
                    <span>{item.shortLabel}</span>
                    {item.badgeKey === 'pending' && pendingRequestsCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0 rounded-full bg-rose-500 text-white text-[10px]">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {!isPublicLegalRoute && !isFirebaseConfigValid ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-muted-foreground">
            Firebase configuration is required to access Settings.
          </div>
        ) : !isPublicLegalRoute && authLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading your secure Settings hub...</p>
          </div>
        ) : !isPublicLegalRoute && (!isSignedIn || !currentUser) ? (
          <div className="max-w-md mx-auto rounded-2xl border border-border/60 bg-card p-10 text-center space-y-4">
            <Lock className="h-10 w-10 mx-auto text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold">Sign In Required</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sign in to access your Account, Creator Wallet, Saved Posts, and Privacy controls.
              </p>
            </div>
            <Button asChild className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
              <Link href="/">Go to Sign In</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Wide Desktop Secondary Left-Hand Sub-Navigation Sidebar */}
            <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-4">
              {/* Compact Profile Identity Mini-Card (Shown when Signed In) */}
              {currentUser ? (
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 flex items-center gap-3 shadow-sm">
                  <Avatar className="h-11 w-11 border border-indigo-500/40 shrink-0">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                    <AvatarFallback className="bg-indigo-600 text-white font-bold">
                      {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{currentUser.handle}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2 shadow-sm">
                  <p className="font-bold text-sm text-foreground">Lonkind Trust Center</p>
                  <p className="text-xs text-muted-foreground">
                    Official support, privacy disclosures, and platform terms for lonkind.com.
                  </p>
                </div>
              )}

              {/* Categorized Sub-Navigation Menu */}
              <nav className="rounded-2xl border border-border/60 bg-card p-2.5 space-y-4 shadow-sm">
                {visibleGroups.map((group) => (
                  <div key={group.section} className="space-y-1">
                    <div className="px-2.5 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/75">
                      {group.section}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
                            active
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                          )}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : item.iconColor)} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {renderBadge(item.badgeKey)}
                        </Link>
                      );
                    })}
                  </div>
                ))}

                {isSignedIn && (
                  <div className="pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </nav>
            </aside>

            {/* Active Nested Settings Route Panel */}
            <main className="lg:col-span-9 min-w-0">{children}</main>
          </div>
        )}
      </div>
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
