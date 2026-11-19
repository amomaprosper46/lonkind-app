'use client';

import React, { useState } from 'react';
import {
  Bell,
  Camera,
  Mic,
  Image as ImageIcon,
  Users,
  Search,
  Coins,
  MessageSquare,
  UserPlus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Loader2,
  Sliders,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserSettings } from '@/lib/settings-schema';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AppPermissionsManagerProps {
  uid?: string;
  mode?: 'onboarding' | 'settings';
  onComplete?: () => void | Promise<void>;
  isCompleting?: boolean;
}

type StatusPillVariant = 'granted' | 'denied' | 'unsupported' | 'prompt' | 'default';

function PermissionStatusBadge({ status }: { status: StatusPillVariant }) {
  if (status === 'granted') {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" /> Allowed
      </Badge>
    );
  }
  if (status === 'denied') {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" /> Denied (Fallback)
      </Badge>
    );
  }
  if (status === 'unsupported') {
    return (
      <Badge variant="outline" className="border-slate-500/40 bg-slate-500/10 text-slate-500 text-[10px]">
        Browser Fallback
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
      Not Requested
    </Badge>
  );
}

export function AppPermissionsManager({
  uid,
  mode = 'settings',
  onComplete,
  isCompleting = false,
}: AppPermissionsManagerProps) {
  const { settings, isSaving, updateSettings } = useUserSettings(uid);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const perms = settings.appPermissions;

  // =========================================================================
  // 1. NOTIFICATIONS (Master -> Follow Requests, Messages, Coin/Wallet Alerts)
  // =========================================================================
  const handleToggleNotificationMaster = async (checked: boolean) => {
    setBusyKey('notif-master');
    try {
      let browserPermission: 'default' | 'granted' | 'denied' | 'unsupported' =
        perms.notifications.browserPermission;

      if (checked) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          browserPermission = 'unsupported';
          toast({
            title: 'In-App Notifications Enabled',
            description: 'Browser push is unavailable on this device, so alerts will appear inside Lonkind.',
          });
        } else {
          try {
            const result = await Notification.requestPermission();
            browserPermission =
              result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default';
            if (browserPermission === 'denied') {
              toast({
                title: 'Browser Notifications Blocked',
                description:
                  'You can re-enable push in your browser site settings anytime. In-app alerts remain active.',
              });
            }
          } catch {
            browserPermission = 'unsupported';
          }
        }
      }

      await updateSettings((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          push: {
            ...prev.notifications.push,
            enabled: checked && browserPermission !== 'denied',
          },
        },
        appPermissions: {
          ...prev.appPermissions,
          notifications: {
            ...prev.appPermissions.notifications,
            masterEnabled: checked,
            browserPermission,
          },
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleNotificationSub = async (
    key: 'followRequests' | 'messages' | 'coinWalletAlerts',
    checked: boolean
  ) => {
    await updateSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        push: {
          ...prev.notifications.push,
          followerRequests:
            key === 'followRequests' ? checked : prev.notifications.push.followerRequests,
          directMessages: key === 'messages' ? checked : prev.notifications.push.directMessages,
          gifts: key === 'coinWalletAlerts' ? checked : prev.notifications.push.gifts,
        },
      },
      appPermissions: {
        ...prev.appPermissions,
        notifications: {
          ...prev.appPermissions.notifications,
          [key]: checked,
        },
      },
    }));
  };

  // =========================================================================
  // 2. MEDIA & CAMERA (Camera -> Microphone -> Photo Library)
  // =========================================================================
  const handleToggleCamera = async (checked: boolean) => {
    setBusyKey('media-camera');
    try {
      let cameraStatus = perms.media.cameraStatus;
      let enabled = checked;

      if (checked) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          cameraStatus = 'unsupported';
          enabled = false;
          toast({
            title: 'Camera Not Detected',
            description: 'No camera API was detected on this browser. You can still upload photos and videos.',
          });
        } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach((track) => track.stop());
            cameraStatus = 'granted';
          } catch {
            cameraStatus = 'denied';
            enabled = false;
            toast({
              title: 'Camera Permission Denied',
              description:
                'Live streaming and camera capture are paused until you allow camera access in browser settings.',
            });
          }
        }
      }

      await updateSettings((prev) => ({
        ...prev,
        appPermissions: {
          ...prev.appPermissions,
          media: {
            ...prev.appPermissions.media,
            cameraEnabled: enabled,
            cameraStatus,
            // Turning off parent layer cleanly collapses dependent toggles
            ...(enabled ? {} : { microphoneEnabled: false, photoLibraryEnabled: false }),
          },
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleMicrophone = async (checked: boolean) => {
    setBusyKey('media-mic');
    try {
      let microphoneStatus = perms.media.microphoneStatus;
      let enabled = checked;

      if (checked) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          microphoneStatus = 'unsupported';
          enabled = false;
          toast({
            title: 'Microphone Unavailable',
            description: 'Audio capture is not available on this browser.',
          });
        } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            microphoneStatus = 'granted';
          } catch {
            microphoneStatus = 'denied';
            enabled = false;
            toast({
              title: 'Microphone Permission Denied',
              description:
                'Voice calls and live audio will stay muted until you allow microphone access in browser settings.',
            });
          }
        }
      }

      await updateSettings((prev) => ({
        ...prev,
        appPermissions: {
          ...prev.appPermissions,
          media: {
            ...prev.appPermissions.media,
            microphoneEnabled: enabled,
            microphoneStatus,
            ...(enabled ? {} : { photoLibraryEnabled: false }),
          },
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleTogglePhotoLibrary = async (checked: boolean) => {
    await updateSettings((prev) => ({
      ...prev,
      appPermissions: {
        ...prev.appPermissions,
        media: {
          ...prev.appPermissions.media,
          photoLibraryEnabled: checked,
        },
      },
    }));
  };

  // =========================================================================
  // 3. CONTACTS & DISCOVERY (Find via Contacts -> Find me by Email/Phone)
  // =========================================================================
  const handleToggleContacts = async (checked: boolean) => {
    setBusyKey('contacts');
    try {
      let contactsStatus = perms.contactsDiscovery.contactsStatus;

      if (checked) {
        const navAny = typeof navigator !== 'undefined' ? (navigator as any) : null;
        if (navAny?.contacts && typeof navAny.contacts.select === 'function') {
          contactsStatus = 'granted';
        } else {
          contactsStatus = 'unsupported';
          toast({
            title: 'Contacts Discovery Preference Saved',
            description:
              'Native device contact picker is only available on supported mobile browsers. Web friend search is ready.',
          });
        }
      }

      await updateSettings((prev) => ({
        ...prev,
        appPermissions: {
          ...prev.appPermissions,
          contactsDiscovery: {
            ...prev.appPermissions.contactsDiscovery,
            findFriendsViaContacts: checked,
            contactsStatus,
            ...(checked ? {} : { allowFindByEmailOrPhone: false }),
          },
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleEmailPhoneDiscovery = async (checked: boolean) => {
    await updateSettings((prev) => ({
      ...prev,
      appPermissions: {
        ...prev.appPermissions,
        contactsDiscovery: {
          ...prev.appPermissions.contactsDiscovery,
          allowFindByEmailOrPhone: checked,
        },
      },
    }));
  };

  return (
    <div className="space-y-4">
      {mode === 'onboarding' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-left">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sliders className="h-4 w-4 shrink-0" />
            <span>Layer 3: Contextual Device &amp; Feature Permissions</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lonkind never asks for all permissions at once. Enable only the layers you want now—each
            device prompt triggers only when you turn it on, and you can change these anytime in
            Settings.
          </p>
        </div>
      )}

      {/* GROUP 1: NOTIFICATIONS */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  Notifications
                  <PermissionStatusBadge status={perms.notifications.browserPermission} />
                </CardTitle>
                <CardDescription className="text-xs">
                  Master toggle unlocks granular alert categories below.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={perms.notifications.masterEnabled}
              disabled={busyKey === 'notif-master'}
              onCheckedChange={handleToggleNotificationMaster}
              aria-label="Enable Master Notifications"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {perms.notifications.browserPermission === 'denied' && (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Browser push notifications are blocked. Your sub-toggles below still control in-app
                alerts until you allow notifications in browser site settings.
              </span>
            </div>
          )}

          <div
            className={cn(
              'ml-4 pl-4 border-l-2 space-y-3 transition-opacity',
              perms.notifications.masterEnabled
                ? 'border-indigo-500/40 opacity-100'
                : 'border-border/50 opacity-50'
            )}
          >
            {!perms.notifications.masterEnabled && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Enable Notifications master toggle to customize alerts.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Follow Requests</p>
                  <p className="text-[11px] text-muted-foreground">
                    Alerts when someone requests or accepts a follow.
                  </p>
                </div>
              </div>
              <Switch
                checked={perms.notifications.followRequests}
                disabled={!perms.notifications.masterEnabled}
                onCheckedChange={(v) => handleToggleNotificationSub('followRequests', v)}
                aria-label="Follow Requests Notifications"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Messages</p>
                  <p className="text-[11px] text-muted-foreground">
                    Direct message alerts and encrypted chat pings.
                  </p>
                </div>
              </div>
              <Switch
                checked={perms.notifications.messages}
                disabled={!perms.notifications.masterEnabled}
                onCheckedChange={(v) => handleToggleNotificationSub('messages', v)}
                aria-label="Messages Notifications"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Coin &amp; Wallet Alerts</p>
                  <p className="text-[11px] text-muted-foreground">
                    Coin purchases, 20% bonuses, live gifts, and payout receipts.
                  </p>
                </div>
              </div>
              <Switch
                checked={perms.notifications.coinWalletAlerts}
                disabled={!perms.notifications.masterEnabled}
                onCheckedChange={(v) => handleToggleNotificationSub('coinWalletAlerts', v)}
                aria-label="Coin and Wallet Notifications"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GROUP 2: MEDIA & CAMERA (Camera -> Microphone -> Photo Library) */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  Camera Access
                  <PermissionStatusBadge status={perms.media.cameraStatus} />
                </CardTitle>
                <CardDescription className="text-xs">
                  Unlocks Live streaming, video calls, Microphone &amp; Photo Library layers.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={perms.media.cameraEnabled}
              disabled={busyKey === 'media-camera'}
              onCheckedChange={handleToggleCamera}
              aria-label="Enable Camera Access"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {perms.media.cameraStatus === 'denied' && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Camera access was denied by your browser. Allow camera permission in the address bar
                to go live or take photos.
              </span>
            </div>
          )}

          {/* Nested Layer 2: Microphone */}
          <div
            className={cn(
              'ml-4 pl-4 border-l-2 space-y-3 transition-opacity',
              perms.media.cameraEnabled ? 'border-emerald-500/40 opacity-100' : 'border-border/50 opacity-50'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    Microphone Access
                    <PermissionStatusBadge status={perms.media.microphoneStatus} />
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Required for voice calls, co-host live audio, and voice notes.
                  </p>
                </div>
              </div>
              <Switch
                checked={perms.media.microphoneEnabled}
                disabled={!perms.media.cameraEnabled || busyKey === 'media-mic'}
                onCheckedChange={handleToggleMicrophone}
                aria-label="Enable Microphone Access"
              />
            </div>

            {/* Nested Layer 3: Photo Library */}
            <div
              className={cn(
                'ml-4 pl-4 border-l-2 transition-opacity',
                perms.media.cameraEnabled && perms.media.microphoneEnabled
                  ? 'border-emerald-500/30 opacity-100'
                  : 'border-border/40 opacity-60'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Photo Library Access</p>
                    <p className="text-[11px] text-muted-foreground">
                      Allow selecting photos, avatars, and clips from your device gallery.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={perms.media.photoLibraryEnabled}
                  disabled={!perms.media.cameraEnabled || !perms.media.microphoneEnabled}
                  onCheckedChange={handleTogglePhotoLibrary}
                  aria-label="Enable Photo Library Access"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GROUP 3: CONTACTS & DISCOVERY */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-cyan-500/15 text-cyan-500 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  Contacts &amp; Discovery
                  <PermissionStatusBadge status={perms.contactsDiscovery.contactsStatus} />
                </CardTitle>
                <CardDescription className="text-xs">
                  Find friends via contacts, then choose if others can discover you.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={perms.contactsDiscovery.findFriendsViaContacts}
              disabled={busyKey === 'contacts'}
              onCheckedChange={handleToggleContacts}
              aria-label="Find Friends via Contacts"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div
            className={cn(
              'ml-4 pl-4 border-l-2 transition-opacity',
              perms.contactsDiscovery.findFriendsViaContacts
                ? 'border-cyan-500/40 opacity-100'
                : 'border-border/50 opacity-50'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Allow Others to Find Me by Email / Phone</p>
                  <p className="text-[11px] text-muted-foreground">
                    Let people who already have your contact info discover your Lonkind profile.
                  </p>
                </div>
              </div>
              <Switch
                checked={perms.contactsDiscovery.allowFindByEmailOrPhone}
                disabled={!perms.contactsDiscovery.findFriendsViaContacts}
                onCheckedChange={handleToggleEmailPhoneDiscovery}
                aria-label="Allow others to find me by email or phone"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === 'settings' && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Changes sync securely to your Lonkind account.
          </span>
          {isSaving && (
            <span className="flex items-center gap-1 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
        </div>
      )}

      {mode === 'onboarding' && onComplete && (
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            onClick={onComplete}
            className="w-full h-11 font-semibold"
            disabled={isCompleting || isSaving}
          >
            {(isCompleting || isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions &amp; Enter Lonkind
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="w-full text-muted-foreground"
            disabled={isCompleting}
          >
            Skip device permissions for now
          </Button>
        </div>
      )}
    </div>
  );
}
