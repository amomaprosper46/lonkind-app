/**
 * Server-safe default user settings & legal consent constants.
 * Safe to import in Next.js App Router API routes and Server Components
 * without pulling in client-only React hooks.
 */

export const CONSENT_VERSION = '2026-11-v1';

export const DEFAULT_USER_SETTINGS_SERVER = {
  privacy: {
    privateAccount: false,
    hideFollowersList: false,
    showActivityStatus: true,
    readReceipts: true,
    ghostMode: false,
    disableTelemetryAndTraining: true,
    twoFactorEnabled: false,
    twoFactorMethod: 'authenticator' as const,
    loginAlerts: true,
    whoCanMessage: 'everyone' as const,
    whoCanTag: 'everyone' as const,
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
    language: 'en' as const,
    layoutStyle: 'knowledge_work' as const,
    reduceMotion: false,
    compactSidebar: false,
  },
  dataStorage: {
    autoPlayVideos: 'always' as const,
    highQualityUploads: true,
    dataSaverMode: false,
    mediaDownloadQuality: 'standard' as const,
    backgroundDataSync: true,
    syncFrequency: 'realtime' as const,
    autoRetryFailedRequests: true,
  },
  appPermissions: {
    notifications: {
      masterEnabled: false,
      followRequests: true,
      messages: true,
      coinWalletAlerts: true,
      browserPermission: 'default' as const,
    },
    media: {
      cameraEnabled: false,
      microphoneEnabled: false,
      photoLibraryEnabled: false,
      cameraStatus: 'prompt' as const,
      microphoneStatus: 'prompt' as const,
    },
    contactsDiscovery: {
      findFriendsViaContacts: false,
      allowFindByEmailOrPhone: false,
      contactsStatus: 'prompt' as const,
    },
  },
};
