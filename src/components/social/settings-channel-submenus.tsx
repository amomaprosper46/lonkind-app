'use client';

import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Bell,
  Smartphone,
  Mail,
  Volume2,
  Palette,
  Sun,
  Moon,
  Monitor,
  Globe,
  BookOpen,
  Terminal,
  Database,
  HardDrive,
  Wifi,
  Trash2,
  Sparkles,
  Check,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SettingsNavRow } from './settings-privacy-submenus';
import type { SettingsRouteId, UserSettings } from '@/lib/settings-schema';

interface ChannelMenuProps {
  settings: UserSettings;
  updateSettings: (updater: (prev: UserSettings) => UserSettings) => Promise<boolean>;
  onNavigate: (route: SettingsRouteId) => void;
}

// ============================================================================
// STACK LEVEL 1: NOTIFICATIONS HUB (DRILLS DOWN INTO PUSH / EMAIL / IN-APP)
// ============================================================================
export function NotificationsHubMenu({ settings, onNavigate }: ChannelMenuProps) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Bell className="h-4 w-4 text-indigo-400" />
          Notification Channels
        </CardTitle>
        <CardDescription className="text-xs">
          Fine-tune how Lonkind reaches you across Push, Email, and In-App audio/visual channels.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/50">
        <SettingsNavRow
          icon={Smartphone}
          iconColor="text-emerald-400"
          title="Push Notifications"
          description="Mobile & browser alerts for DMs, incoming audio/video calls, live streams, and follower requests."
          statusText={settings.notifications.push.enabled ? 'On' : 'Paused'}
          onClick={() => onNavigate('notifications-push')}
        />
        <SettingsNavRow
          icon={Mail}
          iconColor="text-amber-400"
          title="Email Notifications"
          description="Account security login alerts, Creator Wallet payout confirmations, and weekly digests."
          statusText={settings.notifications.email.enabled ? 'On' : 'Paused'}
          onClick={() => onNavigate('notifications-email')}
        />
        <SettingsNavRow
          icon={Volume2}
          iconColor="text-purple-400"
          title="In-App Alerts & Live Gift Audio"
          description="3D live gift cinema soundtracks, message chimes, haptic vibration, and unread badge counters."
          statusText={settings.notifications.inApp.enabled ? 'On' : 'Muted'}
          onClick={() => onNavigate('notifications-inapp')}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 2: PUSH NOTIFICATIONS
// ============================================================================
export function PushNotificationsScreen({ settings, updateSettings }: Omit<ChannelMenuProps, 'onNavigate'>) {
  const push = settings.notifications.push;
  const setPush = (patch: Partial<UserSettings['notifications']['push']>) =>
    updateSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        push: { ...prev.notifications.push, ...patch },
      },
    }));

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-emerald-400" />
          Push Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Delivered immediately to your Android, iOS, or desktop browser even when Lonkind is minimized.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/50">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-indigo-950/15">
          <div>
            <Label className="font-bold text-sm">Enable All Push Notifications</Label>
            <p className="text-xs text-muted-foreground">Master switch for all mobile & browser push alerts.</p>
          </div>
          <Switch checked={push.enabled} onCheckedChange={(v) => setPush({ enabled: v })} />
        </div>

        {[
          { key: 'directMessages' as const, label: 'Direct Messages & Voice Notes', desc: 'Alert when friends send messages or voice notes.' },
          { key: 'calls' as const, label: 'Incoming Audio & Video Calls', desc: 'High-priority ring alerts for live calls.' },
          { key: 'followerRequests' as const, label: 'New Follower Requests', desc: 'Alert when someone requests to follow your private account.' },
          { key: 'liveStreams' as const, label: 'Friends Going Live', desc: 'Notify when creators you follow start a live broadcast.' },
          { key: 'gifts' as const, label: 'Super Gifts & Diamonds', desc: 'Notify when supporters send you 3D virtual gifts.' },
        ].map((item) => (
          <div key={item.key} className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className={!push.enabled ? 'opacity-50' : ''}>
              <Label className="font-semibold text-sm">{item.label}</Label>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              disabled={!push.enabled}
              checked={push[item.key]}
              onCheckedChange={(v) => setPush({ [item.key]: v })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 2: EMAIL NOTIFICATIONS
// ============================================================================
export function EmailNotificationsScreen({ settings, updateSettings }: Omit<ChannelMenuProps, 'onNavigate'>) {
  const email = settings.notifications.email;
  const setEmail = (patch: Partial<UserSettings['notifications']['email']>) =>
    updateSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        email: { ...prev.notifications.email, ...patch },
      },
    }));

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Mail className="h-4 w-4 text-amber-400" />
          Email Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Manage which account updates and creator summaries are sent to your inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/50">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-indigo-950/15">
          <div>
            <Label className="font-bold text-sm">Enable Email Notifications</Label>
            <p className="text-xs text-muted-foreground">Master switch for non-essential email notifications.</p>
          </div>
          <Switch checked={email.enabled} onCheckedChange={(v) => setEmail({ enabled: v })} />
        </div>

        {[
          { key: 'securityAlerts' as const, label: 'Security & New Login Alerts', desc: 'Critical alerts for password resets, 2FA, and new devices.' },
          { key: 'creatorPayouts' as const, label: 'Creator Wallet & Payout Receipts', desc: 'Confirmation emails for coin purchases and diamond withdrawals.' },
          { key: 'weeklyDigest' as const, label: 'Weekly Highlights Digest', desc: 'Top trending posts and community highlights from your network.' },
          { key: 'productUpdates' as const, label: 'Lonkind New Features & Events', desc: 'Announcements about new 3D gifts and special holiday events.' },
        ].map((item) => (
          <div key={item.key} className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className={!email.enabled ? 'opacity-50' : ''}>
              <Label className="font-semibold text-sm">{item.label}</Label>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              disabled={!email.enabled}
              checked={email[item.key]}
              onCheckedChange={(v) => setEmail({ [item.key]: v })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 2: IN-APP ALERTS & LIVE GIFT AUDIO
// ============================================================================
export function InAppNotificationsScreen({ settings, updateSettings }: Omit<ChannelMenuProps, 'onNavigate'>) {
  const inApp = settings.notifications.inApp;
  const setInApp = (patch: Partial<UserSettings['notifications']['inApp']>) =>
    updateSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        inApp: { ...prev.notifications.inApp, ...patch },
      },
    }));

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-purple-400" />
          In-App Alerts & Live Gift Audio
        </CardTitle>
        <CardDescription className="text-xs">
          Configure sounds, live stream gift audio, haptics, and unread notification badges inside Lonkind.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/50">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-indigo-950/15">
          <div>
            <Label className="font-bold text-sm">Enable In-App Alerts</Label>
            <p className="text-xs text-muted-foreground">Master switch for in-app toast banners and audio cues.</p>
          </div>
          <Switch checked={inApp.enabled} onCheckedChange={(v) => setInApp({ enabled: v })} />
        </div>

        {[
          { key: 'giftCinemaSounds' as const, label: '3D Live Gift Cinema Soundtracks', desc: 'Play spatial audio for Phoenix, Golden Lion, Yacht, and Universe gifts.' },
          { key: 'messageSounds' as const, label: 'Message & Call Chimes', desc: 'Play crisp audio tones when new messages arrive while browsing.' },
          { key: 'hapticVibration' as const, label: 'Haptic Feedback & Vibration', desc: 'Subtle tactile feedback on mobile taps, reactions, and gift combos.' },
          { key: 'badgeCounters' as const, label: 'Unread Notification Badges', desc: 'Show live unread counts on the bell, messages, and friends icons.' },
        ].map((item) => (
          <div key={item.key} className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className={!inApp.enabled ? 'opacity-50' : ''}>
              <Label className="font-semibold text-sm">{item.label}</Label>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              disabled={!inApp.enabled}
              checked={inApp[item.key]}
              onCheckedChange={(v) => setInApp({ [item.key]: v })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 1: APPEARANCE & DISPLAY (THEME, LANGUAGE, WORKSPACE LAYOUT STYLE)
// ============================================================================
export function AppearanceDisplayMenu({ settings, updateSettings }: Omit<ChannelMenuProps, 'onNavigate'>) {
  const { theme, setTheme } = useTheme();
  const app = settings.appearance;

  const setAppearance = (patch: Partial<UserSettings['appearance']>) =>
    updateSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...patch },
    }));

  const LANGUAGES: { code: UserSettings['appearance']['language']; name: string; native: string }[] = [
    { code: 'en', name: 'English', native: 'English (US/Global)' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
    { code: 'ig', name: 'Igbo', native: 'Asụsụ Igbo' },
    { code: 'ha', name: 'Hausa', native: 'Harshen Hausa' },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Theme Mode */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Palette className="h-4 w-4 text-indigo-400" />
            Color Theme
          </CardTitle>
          <CardDescription className="text-xs">Choose your preferred surface contrast across Lonkind.</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'dark', label: 'Dark Mode', desc: 'Sleek midnight obsidian', icon: Moon },
              { id: 'light', label: 'Light Mode', desc: 'Crisp bright daylight', icon: Sun },
              { id: 'system', label: 'System Sync', desc: 'Follow OS preference', icon: Monitor },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id)}
                  className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-md'
                      : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-400' : 'text-muted-foreground'}`} />
                    {isActive && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-sm text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Workspace Layout Style: Knowledge Work vs Software Engineering */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Interface Layout Style
          </CardTitle>
          <CardDescription className="text-xs">
            Switch between spacious editorial reading cards or high-density power-user engineering views.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={async () => {
                await setAppearance({ layoutStyle: 'knowledge_work' });
                toast({ title: 'Layout Updated', description: 'Switched to Knowledge Work layout style.' });
              }}
              className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                app.layoutStyle === 'knowledge_work'
                  ? 'border-indigo-500 bg-indigo-500/15 shadow-md'
                  : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-indigo-400" />
                </div>
                {app.layoutStyle === 'knowledge_work' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                    <Check className="h-3 w-3" /> Selected
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Knowledge Work Style</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generous whitespace, editorial typography, calm card spacing, and distraction-free reading for creators & writers.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={async () => {
                await setAppearance({ layoutStyle: 'software_engineering' });
                toast({ title: 'Layout Updated', description: 'Switched to Software Engineering high-density style.' });
              }}
              className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                app.layoutStyle === 'software_engineering'
                  ? 'border-cyan-500 bg-cyan-500/15 shadow-md'
                  : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-cyan-400" />
                </div>
                {app.layoutStyle === 'software_engineering' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-600 text-white">
                    <Check className="h-3 w-3" /> Selected
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-sm font-mono text-foreground">Software Engineering Style</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  High-density compact spacing, crisp monospace telemetry/metadata badges, and keyboard-first power-user precision.
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-xl border border-border/50 divide-y divide-border/50 bg-secondary/15">
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <Label className="font-semibold text-sm">Reduce Motion & Animations</Label>
                <p className="text-xs text-muted-foreground">Minimize UI transition animations for accessibility and battery savings.</p>
              </div>
              <Switch checked={app.reduceMotion} onCheckedChange={(v) => setAppearance({ reduceMotion: v })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Language Selector */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-400" />
            App Display Language
          </CardTitle>
          <CardDescription className="text-xs">Select your preferred language across menus and feeds.</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {LANGUAGES.map((lang) => {
              const active = app.language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={async () => {
                    await setAppearance({ language: lang.code });
                    toast({ title: 'Language Saved', description: `Display language set to ${lang.name}.` });
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/15'
                      : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
                  }`}
                >
                  <p className="font-bold text-xs text-foreground">{lang.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{lang.native}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STACK LEVEL 1: DATA, STORAGE & TELEMETRY PREFERENCES
// ============================================================================
export function DataStorageTelemetryMenu({ settings, updateSettings }: Omit<ChannelMenuProps, 'onNavigate'>) {
  const [clearingCache, setClearingCache] = useState(false);
  const ds = settings.dataStorage;

  const setDataStorage = (patch: Partial<UserSettings['dataStorage']>) =>
    updateSettings((prev) => ({
      ...prev,
      dataStorage: { ...prev.dataStorage, ...patch },
    }));

  const handleClearLocalCache = () => {
    setClearingCache(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const keep = localStorage.getItem('lonkind_user_settings_cache');
        sessionStorage.clear();
        if (keep) localStorage.setItem('lonkind_user_settings_cache', keep);
      }
      setClearingCache(false);
      toast({
        title: 'Local Cache Cleared',
        description: 'Temporary thumbnails and session cache have been freed while preserving your login and settings.',
      });
    }, 350);
  };

  return (
    <div className="space-y-5">
      {/* Global Telemetry & Model Training Opt-Out (Synced with Privacy & Security) */}
      <Card className="rounded-2xl border-emerald-500/30 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-emerald-950/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-300">
            <Database className="h-4 w-4" />
            Global Telemetry & AI Model Training Privacy
          </CardTitle>
          <CardDescription className="text-xs">
            Synced directly with Privacy & Security. Controls whether Lonkind collects diagnostic telemetry or uses your content for AI training.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <Label className="font-bold text-sm">Disable Telemetry & Model Training Data Usage</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, your telemetry logs, voice notes, posts, and Lonki AI prompts are never used to train models.
            </p>
          </div>
          <Switch
            checked={settings.privacy.disableTelemetryAndTraining}
            onCheckedChange={(checked) =>
              updateSettings((prev) => ({
                ...prev,
                privacy: { ...prev.privacy, disableTelemetryAndTraining: checked },
              }))
            }
          />
        </CardContent>
      </Card>

      {/* Media Bandwidth & Storage Controls */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-indigo-400" />
            Media Quality, Bandwidth & Cache
          </CardTitle>
          <CardDescription className="text-xs">
            Optimize video playback and uploads for mobile cellular networks or Wi-Fi.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          <div className="p-4 sm:p-5 space-y-3">
            <Label className="font-bold text-sm flex items-center gap-1.5">
              <Wifi className="h-4 w-4 text-indigo-400" />
              Auto-Play Feed Videos & Live Previews
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'always' as const, label: 'Always' },
                { id: 'wifi_only' as const, label: 'Wi-Fi Only' },
                { id: 'never' as const, label: 'Never' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDataStorage({ autoPlayVideos: opt.id })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    ds.autoPlayVideos === opt.id
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <Label className="font-semibold text-sm">Upload Photos & Videos in HD</Label>
              <p className="text-xs text-muted-foreground">Keep crisp resolution on posts, profile covers, and stories.</p>
            </div>
            <Switch checked={ds.highQualityUploads} onCheckedChange={(v) => setDataStorage({ highQualityUploads: v })} />
          </div>

          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <Label className="font-semibold text-sm">Mobile Data Saver Mode</Label>
              <p className="text-xs text-muted-foreground">Lower video stream preload bitrate when on cellular data.</p>
            </div>
            <Switch checked={ds.dataSaverMode} onCheckedChange={(v) => setDataStorage({ dataSaverMode: v })} />
          </div>

          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">Clear Temporary App Cache</p>
              <p className="text-xs text-muted-foreground">Free up browser/device storage without logging you out.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={clearingCache}
              onClick={handleClearLocalCache}
              className="rounded-xl gap-1.5 self-start sm:self-center"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              {clearingCache ? 'Clearing...' : 'Clear Cache'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
