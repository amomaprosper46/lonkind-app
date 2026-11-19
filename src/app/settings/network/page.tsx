'use client';

import React from 'react';
import { Wifi } from 'lucide-react';
import { useUserSettings } from '@/lib/settings-schema';
import { StandaloneNetworkSettings } from '@/components/social/network-settings-menu';
import { useSettingsContext } from '../settings-context';

export default function NetworkSettingsPage() {
  const { currentUser } = useSettingsContext();
  const { settings, updateSettings } = useUserSettings(currentUser?.uid);

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-cyan-400" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Network Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Check your live connection, save mobile data, manage background sync, and configure safe offline retries.
        </p>
      </div>

      <StandaloneNetworkSettings settings={settings} updateSettings={updateSettings} />
    </div>
  );
}
