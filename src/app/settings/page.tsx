'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Bookmark, Shield, ChevronRight } from 'lucide-react';
import SettingsView from '@/components/social/settings-view';
import { useSettingsContext } from './settings-context';

export default function SettingsHomePage() {
  const router = useRouter();
  const {
    currentUser,
    blockedUsers,
    savedPostIds,
    pendingRequestsCount,
    onSignOut,
    onUpdateProfile,
    onPasswordReset,
    onDeleteAccount,
    onUnblockUser,
  } = useSettingsContext();

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      {/* Quick-Jump Cards for Relocated Secondary Features (Wallet, Saved Posts, Privacy) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Link href="/settings/wallet" className="group">
          <Card className="h-full rounded-2xl border-border/60 hover:border-amber-500/45 bg-gradient-to-br from-amber-950/20 via-card to-card transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Billing &amp; Finance
                  </p>
                  <p className="font-bold text-sm text-foreground group-hover:text-amber-300 transition-colors truncate">
                    Creator Wallet
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {(currentUser.coins || 0).toLocaleString()} Coins • {(currentUser.diamonds || 0).toLocaleString()} 💎
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/saved" className="group">
          <Card className="h-full rounded-2xl border-border/60 hover:border-purple-500/45 bg-gradient-to-br from-purple-950/20 via-card to-card transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Bookmark className="h-5 w-5 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    Activity &amp; Content
                  </p>
                  <p className="font-bold text-sm text-foreground group-hover:text-purple-300 transition-colors truncate">
                    Saved Posts
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {savedPostIds.size} {savedPostIds.size === 1 ? 'bookmarked post' : 'bookmarked posts'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/privacy" className="group">
          <Card className="h-full rounded-2xl border-border/60 hover:border-emerald-500/45 bg-gradient-to-br from-emerald-950/20 via-card to-card transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Privacy &amp; Safety
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-foreground group-hover:text-emerald-300 transition-colors truncate">
                      Privacy &amp; Requests
                    </p>
                    {pendingRequestsCount > 0 && (
                      <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0">
                        {pendingRequestsCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Followers, 2FA &amp; Blocked
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Full Account, Appearance, Notifications & Security Hub */}
      <SettingsView
        user={currentUser}
        onSignOut={onSignOut}
        onUpdateProfile={onUpdateProfile}
        onPasswordReset={onPasswordReset}
        onDeleteAccount={onDeleteAccount}
        blockedUsers={blockedUsers}
        onUnblockUser={onUnblockUser}
        onGoToWallet={() => router.push('/settings/wallet')}
        onViewProfile={() => router.push('/?view=profile')}
      />
    </div>
  );
}
