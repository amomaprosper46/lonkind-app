import { useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================================================
// 1. MULTI-LAYERED SETTINGS NAVIGATION STACK ROUTES (3 LEVELS DEEP)
// ============================================================================
export type SettingsRouteId =
  // Level 0: Main Dashboard
  | 'root'
  // Level 1: Primary Categories
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'appearance'
  | 'network'
  | 'network-data-saver'
  | 'network-background-sync'
  | 'network-offline-queue'
  | 'data-storage'
  | 'support-legal'
  // Level 2: Privacy & Security Sub-Menus
  | 'privacy-followers'
  | 'privacy-activity'
  | 'privacy-2fa'
  | 'privacy-blocked'
  // Level 3: Deep Follower Management Tools ("Settings on Top of Settings")
  | 'privacy-pending-requests'
  | 'privacy-remove-followers'
  // Level 2: Notifications Channel Sub-Menus
  | 'notifications-push'
  | 'notifications-email'
  | 'notifications-inapp';

export interface SettingsRouteMeta {
  id: SettingsRouteId;
  title: string;
  subtitle: string;
  parent: SettingsRouteId | null;
  level: 0 | 1 | 2 | 3;
  keywords: string[];
}

export const SETTINGS_ROUTE_MAP: Record<SettingsRouteId, SettingsRouteMeta> = {
  root: {
    id: 'root',
    title: 'Settings',
    subtitle: 'Manage your account, privacy, notifications, display, and data preferences.',
    parent: null,
    level: 0,
    keywords: ['settings', 'home', 'preferences'],
  },
  account: {
    id: 'account',
    title: 'Account & Profile Management',
    subtitle: 'Profile photo, cover banner, @handle, bio, password reset, and account deletion.',
    parent: 'root',
    level: 1,
    keywords: ['account', 'profile', 'name', 'handle', 'bio', 'avatar', 'cover', 'password', 'delete'],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy & Security',
    subtitle: 'Private followers, activity status, telemetry opt-out, 2FA, and blocked users.',
    parent: 'root',
    level: 1,
    keywords: ['privacy', 'security', '2fa', 'telemetry', 'followers', 'private', 'blocked', 'training'],
  },
  'privacy-followers': {
    id: 'privacy-followers',
    title: 'Private Followers & Requests',
    subtitle: 'Require approval for new followers, review pending requests, or remove followers.',
    parent: 'privacy',
    level: 2,
    keywords: ['private account', 'followers', 'approval', 'requests', 'remove'],
  },
  'privacy-pending-requests': {
    id: 'privacy-pending-requests',
    title: 'Pending Follower Requests',
    subtitle: 'Approve or decline people waiting to follow and connect with you.',
    parent: 'privacy-followers',
    level: 3,
    keywords: ['pending', 'requests', 'accept', 'decline', 'approve'],
  },
  'privacy-remove-followers': {
    id: 'privacy-remove-followers',
    title: 'Remove Existing Followers',
    subtitle: 'Search your active followers and remove anyone silently.',
    parent: 'privacy-followers',
    level: 3,
    keywords: ['remove', 'followers', 'friends', 'search', 'unfollow'],
  },
  'privacy-activity': {
    id: 'privacy-activity',
    title: 'Activity Status & Read Receipts',
    subtitle: 'Control online visibility, ghost mode, and direct message read receipts.',
    parent: 'privacy',
    level: 2,
    keywords: ['activity', 'online', 'last seen', 'read receipts', 'ghost mode'],
  },
  'privacy-2fa': {
    id: 'privacy-2fa',
    title: 'Two-Factor Authentication (2FA)',
    subtitle: 'Protect your Lonkind account with an extra verification step on sign-in.',
    parent: 'privacy',
    level: 2,
    keywords: ['2fa', 'two factor', 'authenticator', 'sms', 'security', 'otp', 'login alerts'],
  },
  'privacy-blocked': {
    id: 'privacy-blocked',
    title: 'Blocked Accounts',
    subtitle: 'Accounts you have blocked cannot view your profile, message you, or interact.',
    parent: 'privacy',
    level: 2,
    keywords: ['blocked', 'unblock', 'safety', 'mute'],
  },
  notifications: {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Configure Push, Email, and In-App notification channels individually.',
    parent: 'root',
    level: 1,
    keywords: ['notifications', 'push', 'email', 'in-app', 'sounds', 'alerts'],
  },
  'notifications-push': {
    id: 'notifications-push',
    title: 'Push Notifications',
    subtitle: 'Mobile and browser push alerts for messages, calls, live streams, and gifts.',
    parent: 'notifications',
    level: 2,
    keywords: ['push', 'mobile', 'alerts', 'calls', 'live'],
  },
  'notifications-email': {
    id: 'notifications-email',
    title: 'Email Notifications',
    subtitle: 'Security alerts, weekly community digests, and creator payout receipts.',
    parent: 'notifications',
    level: 2,
    keywords: ['email', 'digest', 'payouts', 'security'],
  },
  'notifications-inapp': {
    id: 'notifications-inapp',
    title: 'In-App Alerts & Audio',
    subtitle: '3D live gift cinema audio, message chimes, vibration, and badge counters.',
    parent: 'notifications',
    level: 2,
    keywords: ['in-app', 'sound', 'gift audio', 'chime', 'badges'],
  },
  appearance: {
    id: 'appearance',
    title: 'Appearance & Display',
    subtitle: 'Theme mode, display language, and Knowledge Work vs Software Engineering layout.',
    parent: 'root',
    level: 1,
    keywords: ['appearance', 'display', 'theme', 'dark', 'light', 'language', 'layout', 'knowledge work', 'software engineering'],
  },
  network: {
    id: 'network',
    title: 'Network & Connection',
    subtitle: 'Connection status, data saver, background sync, and safe offline retry rules.',
    parent: 'root',
    level: 1,
    keywords: ['network', 'wifi', 'mobile data', 'data saver', 'offline', 'sync', 'connection', 'cache'],
  },
  'network-data-saver': {
    id: 'network-data-saver',
    title: 'Data Usage & Saver',
    subtitle: 'Data saver mode, video auto-play, media download quality, and network cache.',
    parent: 'network',
    level: 2,
    keywords: ['data saver', 'auto-play', 'video quality', 'download quality', 'cache', 'bandwidth'],
  },
  'network-background-sync': {
    id: 'network-background-sync',
    title: 'Background Sync & Notifications',
    subtitle: 'Control how often messages, follow requests, and coin balances refresh.',
    parent: 'network',
    level: 2,
    keywords: ['background sync', 'sync frequency', 'real-time', 'refresh', 'updates'],
  },
  'network-offline-queue': {
    id: 'network-offline-queue',
    title: 'Offline Mode & Queue',
    subtitle: 'Auto-retry safe actions when reconnected while protecting payments and payouts.',
    parent: 'network',
    level: 2,
    keywords: ['offline', 'queue', 'retry', 'reconnect', 'payments safety'],
  },
  'data-storage': {
    id: 'data-storage',
    title: 'Data, Storage & Telemetry',
    subtitle: 'Global telemetry & AI training opt-out, video playback quality, and local cache.',
    parent: 'root',
    level: 1,
    keywords: ['data', 'storage', 'telemetry', 'model training', 'cache', 'video', 'saver'],
  },
  'support-legal': {
    id: 'support-legal',
    title: 'Creator Wallet, Help & Legal',
    subtitle: 'Wallet balance summary, support tickets, privacy policy, and platform rules.',
    parent: 'root',
    level: 1,
    keywords: ['help', 'support', 'wallet', 'legal', 'privacy policy', 'terms', 'rules'],
  },
};

export function getBreadcrumbTrail(routeId: SettingsRouteId): SettingsRouteMeta[] {
  const trail: SettingsRouteMeta[] = [];
  let current: SettingsRouteId | null = routeId;
  let guard = 0;
  while (current && guard < 6) {
    const meta: SettingsRouteMeta = SETTINGS_ROUTE_MAP[current];
    trail.unshift(meta);
    current = meta.parent;
    guard++;
  }
  return trail;
}

// ============================================================================
// 2. ZOD SCHEMA & TYPES FOR PERSISTED USER SETTINGS & LAYERED PERMISSIONS
// ============================================================================
export const CONSENT_VERSION = '2026-11-v1';

export const LegalConsentSchema = z.object({
  consentVersion: z.string().default(CONSENT_VERSION),
  agreedAt: z.string(),
  termsAndPrivacyAccepted: z.boolean(),
  ageVerified: z.boolean(),
  realNameAndGuidelinesAccepted: z.boolean(),
});

export type LegalConsentRecord = z.infer<typeof LegalConsentSchema>;

export const AudienceOptionSchema = z.enum(['everyone', 'followers', 'nobody']);
export type AudienceOption = z.infer<typeof AudienceOptionSchema>;

export const UserSettingsSchema = z.object({
  privacy: z.object({
    privateAccount: z.boolean().default(false),
    hideFollowersList: z.boolean().default(false),
    showActivityStatus: z.boolean().default(true),
    readReceipts: z.boolean().default(true),
    ghostMode: z.boolean().default(false),
    disableTelemetryAndTraining: z.boolean().default(true),
    twoFactorEnabled: z.boolean().default(false),
    twoFactorMethod: z.enum(['authenticator', 'sms', 'email']).default('authenticator'),
    loginAlerts: z.boolean().default(true),
    whoCanMessage: AudienceOptionSchema.default('everyone'),
    whoCanTag: AudienceOptionSchema.default('everyone'),
  }),
  notifications: z.object({
    push: z.object({
      enabled: z.boolean().default(true),
      directMessages: z.boolean().default(true),
      calls: z.boolean().default(true),
      followerRequests: z.boolean().default(true),
      liveStreams: z.boolean().default(true),
      gifts: z.boolean().default(true),
    }),
    email: z.object({
      enabled: z.boolean().default(true),
      securityAlerts: z.boolean().default(true),
      weeklyDigest: z.boolean().default(false),
      creatorPayouts: z.boolean().default(true),
      productUpdates: z.boolean().default(false),
    }),
    inApp: z.object({
      enabled: z.boolean().default(true),
      giftCinemaSounds: z.boolean().default(true),
      messageSounds: z.boolean().default(true),
      hapticVibration: z.boolean().default(true),
      badgeCounters: z.boolean().default(true),
    }),
  }),
  appearance: z.object({
    language: z.enum(['en', 'es', 'fr', 'pt', 'ar', 'yo', 'ig', 'ha']).default('en'),
    layoutStyle: z.enum(['knowledge_work', 'software_engineering']).default('knowledge_work'),
    reduceMotion: z.boolean().default(false),
    compactSidebar: z.boolean().default(false),
  }),
  dataStorage: z.object({
    autoPlayVideos: z.enum(['always', 'wifi_only', 'never']).default('always'),
    highQualityUploads: z.boolean().default(true),
    dataSaverMode: z.boolean().default(false),
    mediaDownloadQuality: z.enum(['high', 'standard', 'data_saver']).default('standard'),
    backgroundDataSync: z.boolean().default(true),
    syncFrequency: z.enum(['realtime', 'every_15_min', 'manual']).default('realtime'),
    autoRetryFailedRequests: z.boolean().default(true),
  }),
  appPermissions: z.object({
    notifications: z.object({
      masterEnabled: z.boolean().default(false),
      followRequests: z.boolean().default(true),
      messages: z.boolean().default(true),
      coinWalletAlerts: z.boolean().default(true),
      browserPermission: z.enum(['default', 'granted', 'denied', 'unsupported']).default('default'),
    }),
    media: z.object({
      cameraEnabled: z.boolean().default(false),
      microphoneEnabled: z.boolean().default(false),
      photoLibraryEnabled: z.boolean().default(false),
      cameraStatus: z.enum(['prompt', 'granted', 'denied', 'unsupported']).default('prompt'),
      microphoneStatus: z.enum(['prompt', 'granted', 'denied', 'unsupported']).default('prompt'),
    }),
    contactsDiscovery: z.object({
      findFriendsViaContacts: z.boolean().default(false),
      allowFindByEmailOrPhone: z.boolean().default(false),
      contactsStatus: z.enum(['prompt', 'granted', 'denied', 'unsupported']).default('prompt'),
    }),
  }),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  privacy: {
    privateAccount: false,
    hideFollowersList: false,
    showActivityStatus: true,
    readReceipts: true,
    ghostMode: false,
    disableTelemetryAndTraining: true,
    twoFactorEnabled: false,
    twoFactorMethod: 'authenticator',
    loginAlerts: true,
    whoCanMessage: 'everyone',
    whoCanTag: 'everyone',
  },
  notifications: {
    push: {
      enabled: true,
      directMessages: true,
      calls: true,
      followerRequests: true,
      liveStreams: true,
      gifts: true,
    },
    email: {
      enabled: true,
      securityAlerts: true,
      weeklyDigest: false,
      creatorPayouts: true,
      productUpdates: false,
    },
    inApp: {
      enabled: true,
      giftCinemaSounds: true,
      messageSounds: true,
      hapticVibration: true,
      badgeCounters: true,
    },
  },
  appearance: {
    language: 'en',
    layoutStyle: 'knowledge_work',
    reduceMotion: false,
    compactSidebar: false,
  },
  dataStorage: {
    autoPlayVideos: 'always',
    highQualityUploads: true,
    dataSaverMode: false,
    mediaDownloadQuality: 'standard',
    backgroundDataSync: true,
    syncFrequency: 'realtime',
    autoRetryFailedRequests: true,
  },
  appPermissions: {
    notifications: {
      masterEnabled: false,
      followRequests: true,
      messages: true,
      coinWalletAlerts: true,
      browserPermission: 'default',
    },
    media: {
      cameraEnabled: false,
      microphoneEnabled: false,
      photoLibraryEnabled: false,
      cameraStatus: 'prompt',
      microphoneStatus: 'prompt',
    },
    contactsDiscovery: {
      findFriendsViaContacts: false,
      allowFindByEmailOrPhone: false,
      contactsStatus: 'prompt',
    },
  },
};

function mergeUserSettings(raw?: Partial<UserSettings> | null, legacyDoc?: any): UserSettings {
  const merged: UserSettings = {
    privacy: {
      ...DEFAULT_USER_SETTINGS.privacy,
      ...(raw?.privacy || {}),
      // Respect existing top-level legacy fields on users/{uid}
      ...(legacyDoc?.followerPrivacy !== undefined
        ? { hideFollowersList: legacyDoc.followerPrivacy === 'private' }
        : {}),
      ...(legacyDoc?.privateAccount !== undefined
        ? { privateAccount: Boolean(legacyDoc.privateAccount) }
        : {}),
      ...(legacyDoc?.whoCanMessage !== undefined
        ? { whoCanMessage: legacyDoc.whoCanMessage }
        : {}),
      ...(legacyDoc?.whoCanTag !== undefined
        ? { whoCanTag: legacyDoc.whoCanTag }
        : {}),
      ...(legacyDoc?.lastSeenVisible !== undefined
        ? { showActivityStatus: Boolean(legacyDoc.lastSeenVisible) }
        : {}),
      ...(legacyDoc?.ghostMode !== undefined ? { ghostMode: Boolean(legacyDoc.ghostMode) } : {}),
    },
    notifications: {
      push: { ...DEFAULT_USER_SETTINGS.notifications.push, ...(raw?.notifications?.push || {}) },
      email: { ...DEFAULT_USER_SETTINGS.notifications.email, ...(raw?.notifications?.email || {}) },
      inApp: { ...DEFAULT_USER_SETTINGS.notifications.inApp, ...(raw?.notifications?.inApp || {}) },
    },
    appearance: {
      ...DEFAULT_USER_SETTINGS.appearance,
      ...(raw?.appearance || {}),
    },
    dataStorage: {
      ...DEFAULT_USER_SETTINGS.dataStorage,
      ...(raw?.dataStorage || {}),
    },
    appPermissions: {
      notifications: {
        ...DEFAULT_USER_SETTINGS.appPermissions.notifications,
        ...(raw?.appPermissions?.notifications || {}),
      },
      media: {
        ...DEFAULT_USER_SETTINGS.appPermissions.media,
        ...(raw?.appPermissions?.media || {}),
      },
      contactsDiscovery: {
        ...DEFAULT_USER_SETTINGS.appPermissions.contactsDiscovery,
        ...(raw?.appPermissions?.contactsDiscovery || {}),
      },
    },
  };
  return merged;
}

// ============================================================================
// 3. REAL-TIME STATE MANAGEMENT & FIRESTORE PERSISTENCE HOOK
// ============================================================================
export function useUserSettings(uid?: string) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync visual layout style & audio flags to DOM/localStorage immediately
  const applyLocalRuntimeEffects = useCallback((next: UserSettings) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('lonkind_user_settings_cache', JSON.stringify(next));
    localStorage.setItem('lonkind_gift_sounds', String(next.notifications.inApp.giftCinemaSounds));
    localStorage.setItem('lonkind_msg_sounds', String(next.notifications.inApp.messageSounds));
    localStorage.setItem('lonkind_layout_style', next.appearance.layoutStyle);
    localStorage.setItem('lonkind_language', next.appearance.language);
    localStorage.setItem(
      'lonkind_telemetry_disabled',
      String(next.privacy.disableTelemetryAndTraining)
    );
    document.documentElement.dataset.layoutStyle = next.appearance.layoutStyle;
    document.documentElement.dataset.reduceMotion = String(next.appearance.reduceMotion);
  }, []);

  // Hydrate immediately from localStorage cache before Firestore responds
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('lonkind_user_settings_cache');
      if (cached) {
        const parsed = mergeUserSettings(JSON.parse(cached));
        setSettings(parsed);
        applyLocalRuntimeEffects(parsed);
      }
    } catch {
      // Ignore malformed cache
    }
  }, [applyLocalRuntimeEffects]);

  // Subscribe to users/{uid} in Firestore for live multi-device settings sync
  useEffect(() => {
    if (!uid) return;
    const userRef = doc(db, 'users', uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const hydrated = mergeUserSettings(data?.settings, data);
          setSettings(hydrated);
          applyLocalRuntimeEffects(hydrated);
        }
        setIsLoaded(true);
      },
      (err) => {
        console.warn('[useUserSettings] Firestore read warning:', err);
        setIsLoaded(true);
      }
    );
    return () => unsub();
  }, [uid, applyLocalRuntimeEffects]);

  // Atomic optimistic updater + Firestore persistence handler
  const updateSettings = useCallback(
    async (updater: (prev: UserSettings) => UserSettings): Promise<boolean> => {
      let nextState: UserSettings = settings;
      setSettings((prev) => {
        nextState = updater(prev);
        applyLocalRuntimeEffects(nextState);
        return nextState;
      });

      if (!uid) return true;
      setIsSaving(true);
      try {
        const userRef = doc(db, 'users', uid);
        await setDoc(
          userRef,
          {
            settings: nextState,
            // Mirror key privacy flags to top-level user document so ProfileView & presence read them directly
            followerPrivacy: nextState.privacy.hideFollowersList ? 'private' : 'public',
            privateAccount: nextState.privacy.privateAccount,
            whoCanMessage: nextState.privacy.whoCanMessage,
            whoCanTag: nextState.privacy.whoCanTag,
            lastSeenVisible: nextState.privacy.showActivityStatus,
            readReceipts: nextState.privacy.readReceipts,
            ghostMode: nextState.privacy.ghostMode,
            telemetryOptOut: nextState.privacy.disableTelemetryAndTraining,
            twoFactorEnabled: nextState.privacy.twoFactorEnabled,
            settingsUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        return true;
      } catch (err) {
        console.error('[useUserSettings] Persist error:', err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [uid, settings, applyLocalRuntimeEffects]
  );

  return {
    settings,
    isLoaded,
    isSaving,
    updateSettings,
  };
}
