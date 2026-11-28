'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Search,
  User,
  Mail,
  ShieldCheck,
  Bookmark,
  Lock,
  UserPlus,
  Ban,
  Shield,
  Megaphone,
  Wallet,
  Radio,
  Wifi,
  Bell,
  Moon,
  Sun,
  KeyRound,
  Info,
  FileText,
  Scale,
  Coins,
  HelpCircle,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SettingsRowSkeleton } from '@/components/ui/skeletons';
import { useSettingsContext } from './settings-context';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface SettingsRowItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string;
  rightSlot?: React.ReactNode;
  keywords: string;
}

interface SettingsGroupSection {
  id: string;
  title: string;
  items: SettingsRowItem[];
}

export default function SettingsHomePage() {
  const { theme, setTheme } = useTheme();
  const {
    currentUser,
    savedPostIds,
    pendingRequestsCount,
    blockedUsers,
    onSignOut,
    onPasswordReset,
  } = useSettingsContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [privateAccount, setPrivateAccount] = useState<boolean>(
    Boolean((currentUser as any)?.privateAccount)
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  React.useEffect(() => {
    setPrivateAccount(Boolean((currentUser as any)?.privateAccount));
  }, [currentUser]);

  const handleTogglePrivate = async (checked: boolean) => {
    if (!currentUser) return;
    setPrivateAccount(checked);
    setSavingPrivacy(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          privateAccount: checked,
          followerPrivacy: checked ? 'private' : 'public',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast({
        title: checked ? 'Private Account Enabled' : 'Public Account Enabled',
        description: checked
          ? 'Only approved followers can see your private profile details.'
          : 'Anyone on Lonkind can follow and view your public posts.',
      });
    } catch {
      setPrivateAccount(!checked);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const isSuperAdmin =
    (currentUser as any)?.role === 'super_admin' || (currentUser as any)?.isAdmin === true;
  const isDark = theme === 'dark';

  const groups: SettingsGroupSection[] = useMemo(() => {
    if (!currentUser) return [];
    return [
      {
        id: 'account',
        title: '1. Account & Identity',
        items: [
          {
            id: 'profile-identity',
            title: currentUser.name || 'Your Profile',
            subtitle: `@${currentUser.handle || 'member'} • Real-Name verified account`,
            icon: <User className="h-4 w-4 text-indigo-500" />,
            href: `/profile/${currentUser.handle || currentUser.uid}`,
            keywords: 'account identity profile real name handle bio avatar',
          },
          {
            id: 'gmail-status',
            title: 'Verified @gmail.com & 18+ Status',
            subtitle: `${currentUser.email || 'Connected'} • ${(currentUser as any)?.isAdult !== false ? '18+ Verified' : 'Age Check'}`,
            icon: <Mail className="h-4 w-4 text-emerald-500" />,
            badge: '18+ ✓',
            keywords: 'gmail email verification age 18+ dob date of birth',
          },
          {
            id: 'saved-posts',
            title: 'Saved Posts',
            subtitle: `${savedPostIds.size} bookmarked ${savedPostIds.size === 1 ? 'post' : 'posts'}`,
            icon: <Bookmark className="h-4 w-4 text-purple-500" />,
            href: '/settings/saved',
            keywords: 'saved posts bookmarks favorites',
          },
        ],
      },
      {
        id: 'privacy',
        title: '2. Privacy & Followers',
        items: [
          {
            id: 'private-toggle',
            title: 'Private Account',
            subtitle: 'Require approval before new users can follow you',
            icon: <Lock className="h-4 w-4 text-emerald-500" />,
            rightSlot: (
              <Switch
                checked={privateAccount}
                disabled={savingPrivacy}
                onCheckedChange={handleTogglePrivate}
                aria-label="Toggle Private Account"
              />
            ),
            keywords: 'private account public lock followers visibility',
          },
          {
            id: 'follow-requests',
            title: 'Follow Requests',
            subtitle: 'Approve or decline pending follower requests',
            icon: <UserPlus className="h-4 w-4 text-cyan-500" />,
            href: '/settings/privacy/followers',
            badge: pendingRequestsCount > 0 ? String(pendingRequestsCount) : undefined,
            keywords: 'follow requests pending followers approve',
          },
          {
            id: 'blocked-users',
            title: 'Blocked & Restricted Users',
            subtitle: `${blockedUsers.length} blocked ${blockedUsers.length === 1 ? 'account' : 'accounts'} & interaction filters`,
            icon: <Ban className="h-4 w-4 text-rose-500" />,
            href: '/settings/privacy',
            keywords: 'blocked restricted muted users privacy interactions messages tags',
          },
        ],
      },
      {
        id: 'creator',
        title: '3. Creator Tools & Promotions',
        items: [
          {
            id: 'ads-promotions',
            title: 'Ads & Promotions Manager',
            subtitle: 'Launch post/live boosts & track impressions, clicks, and status',
            icon: <Megaphone className="h-4 w-4 text-amber-500" />,
            href: '/settings/promotions',
            badge: 'Boost',
            keywords: 'ads promotions promote boost campaign sponsored impressions clicks',
          },
          {
            id: 'wallet-payouts',
            title: 'Creator Wallet & Payouts',
            subtitle: `${(currentUser.coins || 0).toLocaleString()} Coins • ${(currentUser.diamonds || 0).toLocaleString()} Diamonds`,
            icon: <Wallet className="h-4 w-4 text-emerald-500" />,
            href: '/settings/wallet',
            keywords: 'wallet coins diamonds top up payouts withdraw flutterwave',
          },
          {
            id: 'live-permissions',
            title: 'Live Stream & App Permissions',
            subtitle: 'Manage camera, microphone, and contextual device permissions',
            icon: <Radio className="h-4 w-4 text-rose-500" />,
            href: '/settings/permissions',
            keywords: 'live stream camera microphone permissions studio preferences',
          },
          ...(isSuperAdmin
            ? [
                {
                  id: 'super-admin-console',
                  title: 'Super-Admin Console (/admin)',
                  subtitle: 'Ad approvals, @lonkind brand ads, payouts, 2FA & daily backups',
                  icon: <Shield className="h-4 w-4 text-rose-500" />,
                  href: '/admin',
                  badge: 'Admin',
                  keywords: 'admin super_admin mow console approvals backups 2fa',
                },
              ]
            : []),
        ],
      },
      {
        id: 'network',
        title: '4. Network & App Experience',
        items: [
          {
            id: 'network-data-saver',
            title: 'Data Saver Mode & Auto-Play Videos',
            subtitle: 'Control video quality, data usage, and feed auto-play',
            icon: <Wifi className="h-4 w-4 text-sky-500" />,
            href: '/settings/network',
            keywords: 'network data saver auto play videos quality bandwidth',
          },
          {
            id: 'notifications',
            title: 'Notifications & Alerts',
            subtitle: 'Manage push notifications, live alerts, and gift activity',
            icon: <Bell className="h-4 w-4 text-indigo-500" />,
            href: '/settings/permissions',
            keywords: 'notifications push alerts sound',
          },
          {
            id: 'appearance',
            title: 'Dark Mode Appearance',
            subtitle: isDark ? 'Dark theme is active' : 'Light theme is active',
            icon: isDark ? (
              <Moon className="h-4 w-4 text-violet-400" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500" />
            ),
            rightSlot: (
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                aria-label="Toggle Dark Mode"
              />
            ),
            keywords: 'appearance theme dark light mode display',
          },
        ],
      },
      {
        id: 'security-legal',
        title: '5. Security, Legal & Support',
        items: [
          {
            id: 'password-2fa',
            title: 'Password Reset & 2FA Security',
            subtitle: 'Send a password reset link or review account security',
            icon: <KeyRound className="h-4 w-4 text-amber-500" />,
            onClick: () => {
              onPasswordReset();
            },
            keywords: 'security password reset 2fa two factor active sessions',
          },
          {
            id: 'about-lonkind',
            title: 'About Lonkind Technologies',
            subtitle: 'Global creator platform (CAC, Nigeria)',
            icon: <Info className="h-4 w-4 text-primary" />,
            href: '/about',
            keywords: 'about lonkind technologies company cac nigeria global',
          },
          {
            id: 'terms-link',
            title: 'Terms of Service',
            subtitle: '18+ rules, Real-Name, Coins & Sponsored Ads policy',
            icon: <Scale className="h-4 w-4 text-muted-foreground" />,
            href: '/terms',
            keywords: 'terms of service legal rules',
          },
          {
            id: 'privacy-link',
            title: 'Privacy Policy',
            subtitle: 'Firebase security, GDPR/CCPA rights & data deletion',
            icon: <FileText className="h-4 w-4 text-muted-foreground" />,
            href: '/privacy',
            keywords: 'privacy policy gdpr ccpa data',
          },
          {
            id: 'refund-link',
            title: 'Virtual Coins & Refund Policy',
            subtitle: 'Flutterwave PCI-DSS security, 20% bonus & refund timelines',
            icon: <Coins className="h-4 w-4 text-amber-500" />,
            href: '/refund-policy',
            keywords: 'refund policy coins bonus flutterwave payouts',
          },
          {
            id: 'help-center',
            title: 'Help & Support Center',
            subtitle: 'FAQs, support@lonkind.com & ticket submission',
            icon: <HelpCircle className="h-4 w-4 text-sky-500" />,
            href: '/contact',
            keywords: 'help support contact faq ticket',
          },
        ],
      },
    ];
  }, [
    currentUser,
    savedPostIds.size,
    pendingRequestsCount,
    blockedUsers.length,
    privateAccount,
    savingPrivacy,
    isSuperAdmin,
    isDark,
    setTheme,
    onPasswordReset,
  ]);

  if (!currentUser) {
    return (
      <div className="space-y-4">
        <SettingsRowSkeleton count={4} />
        <SettingsRowSkeleton count={4} />
      </div>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: normalizedQuery
        ? group.items.filter(
            (item) =>
              item.title.toLowerCase().includes(normalizedQuery) ||
              item.subtitle.toLowerCase().includes(normalizedQuery) ||
              item.keywords.toLowerCase().includes(normalizedQuery)
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      {/* Compact Account Summary Header */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 border border-border/60 shrink-0">
            <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
            <AvatarFallback>{currentUser.name?.charAt(0) || 'L'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-extrabold text-sm sm:text-base truncate flex items-center gap-1.5">
              {currentUser.name}
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{currentUser.handle} • {(currentUser.coins || 0).toLocaleString()} Coins
            </p>
          </div>
        </div>
        <Link href="/settings/promotions">
          <Button
            size="sm"
            className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-black shrink-0"
          >
            <Megaphone className="h-3.5 w-3.5" />
            Promote
          </Button>
        </Link>
      </div>

      {/* Live Instant Search Bar */}
      <div className="relative">
        <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search settings (e.g., Promote, Wallet, Privacy, Data Saver, 2FA)..."
          className="h-10 pl-10 pr-9 rounded-xl bg-card border-border/70 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 5 Clean Grouped Cards */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          No settings match &ldquo;{searchQuery}&rdquo;. Try another keyword.
        </div>
      ) : (
        filteredGroups.map((group) => (
          <Card key={group.id} className="rounded-2xl border-border/70 overflow-hidden shadow-sm">
            <CardHeader className="px-4 py-3 bg-muted/25 border-b border-border/50">
              <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/50">
              {group.items.map((item) => {
                const rowInner = (
                  <div className="min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        >
                          {item.badge}
                        </Badge>
                      )}
                      {item.rightSlot ? (
                        item.rightSlot
                      ) : item.href || item.onClick ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : null}
                    </div>
                  </div>
                );

                if (item.href) {
                  return (
                    <Link key={item.id} href={item.href} className="block">
                      {rowInner}
                    </Link>
                  );
                }

                if (item.onClick) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="w-full text-left block"
                    >
                      {rowInner}
                    </button>
                  );
                }

                return <div key={item.id}>{rowInner}</div>;
              })}
            </CardContent>
          </Card>
        ))
      )}

      {/* Sign Out Button & Footer Copyright */}
      <div className="pt-2 space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSignOut}
          className="w-full h-11 rounded-xl font-bold text-rose-500 border-rose-500/35 hover:bg-rose-500/10 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          © 2026 Lonkind Technologies. All rights reserved.
        </p>
      </div>
    </div>
  );
}
