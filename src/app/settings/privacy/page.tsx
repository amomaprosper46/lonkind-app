'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useUserSettings, type SettingsRouteId } from '@/lib/settings-schema';
import {
  PrivacySecurityMenu,
  ActivityStatusMenu,
  TwoFactorAuthMenu,
  BlockedAccountsMenu,
} from '@/components/social/settings-privacy-submenus';
import { LiveChatSafetySettingsPanel } from '@/components/social/live-moderation-system';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useSettingsContext } from '../settings-context';

export default function SettingsPrivacyPage() {
  const router = useRouter();
  const { currentUser, blockedUsers, onUnblockUser } = useSettingsContext();
  const { settings, updateSettings } = useUserSettings(currentUser?.uid);
  const [subView, setSubView] = useState<'main' | 'activity' | '2fa' | 'blocked'>('main');

  if (!currentUser) return null;

  const handleNavigate = (route: SettingsRouteId) => {
    if (route === 'privacy-followers' || route === 'privacy-pending-requests' || route === 'privacy-remove-followers') {
      router.push('/settings/privacy/followers');
      return;
    }
    if (route === 'privacy-activity') setSubView('activity');
    else if (route === 'privacy-2fa') setSubView('2fa');
    else if (route === 'privacy-blocked') setSubView('blocked');
    else setSubView('main');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-emerald-950/25 to-slate-900/95 p-5 shadow-md space-y-2">
        {subView !== 'main' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubView('main')}
            className="rounded-xl -ml-2 gap-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Privacy &amp; Safety
          </Button>
        )}
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
          Privacy &amp; Safety
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          {subView === 'main'
            ? 'Privacy, Followers & Security'
            : subView === 'activity'
            ? 'Activity Status & Read Receipts'
            : subView === '2fa'
            ? 'Two-Factor Authentication (2FA)'
            : 'Blocked Accounts'}
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage private follower requests, online activity visibility, telemetry opt-out, 2FA, and blocked accounts.
        </p>
      </div>

      {subView === 'main' && (
        <div className="space-y-5">
          <PrivacySecurityMenu
            user={currentUser}
            settings={settings}
            updateSettings={updateSettings}
            onNavigate={handleNavigate}
            blockedUsers={blockedUsers}
            onUnblockUser={onUnblockUser}
          />
          <LiveChatSafetySettingsPanel user={currentUser} />
        </div>
      )}

      {subView === 'activity' && (
        <ActivityStatusMenu
          user={currentUser}
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={handleNavigate}
          blockedUsers={blockedUsers}
          onUnblockUser={onUnblockUser}
        />
      )}

      {subView === '2fa' && (
        <TwoFactorAuthMenu
          user={currentUser}
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={handleNavigate}
          blockedUsers={blockedUsers}
          onUnblockUser={onUnblockUser}
        />
      )}

      {subView === 'blocked' && (
        <BlockedAccountsMenu blockedUsers={blockedUsers} onUnblockUser={onUnblockUser} />
      )}
    </div>
  );
}
