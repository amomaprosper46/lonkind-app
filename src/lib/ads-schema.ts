/**
 * Shared Ads & Promote schema, promotion packages, and validation helpers.
 * Zero React hooks — safe to import in both Server API Routes and Client Components.
 */

export type PromoPackageId = 'starter' | 'growth' | 'spotlight';

export interface PromoPackage {
  id: PromoPackageId;
  name: string;
  coins: number;
  durationHours: number;
  durationLabel: string;
  targetImpressions: number;
  tagline: string;
  badge?: string;
}

export const PROMO_PACKAGES: Record<PromoPackageId, PromoPackage> = {
  starter: {
    id: 'starter',
    name: 'Starter Boost',
    coins: 100,
    durationHours: 24,
    durationLabel: '24 Hours',
    targetImpressions: 1000,
    tagline: 'Great for quick feed visibility',
  },
  growth: {
    id: 'growth',
    name: 'Growth Reach',
    coins: 300,
    durationHours: 72,
    durationLabel: '3 Days',
    targetImpressions: 4000,
    tagline: 'Balanced reach across Feed & Live',
    badge: 'Most Popular',
  },
  spotlight: {
    id: 'spotlight',
    name: 'Spotlight Pro',
    coins: 750,
    durationHours: 168,
    durationLabel: '7 Days',
    targetImpressions: 12000,
    tagline: 'Maximum creator & brand discovery',
    badge: 'Best Value',
  },
};

export const PROMO_PACKAGE_LIST: PromoPackage[] = [
  PROMO_PACKAGES.starter,
  PROMO_PACKAGES.growth,
  PROMO_PACKAGES.spotlight,
];

export const AD_CTA_OPTIONS = [
  'Learn More',
  'Visit Site',
  'Join Live',
  'Watch Now',
  'View Post',
  'Shop Now',
] as const;

export type AdCtaLabel = (typeof AD_CTA_OPTIONS)[number];

export type AdCampaignStatus = 'active' | 'paused' | 'completed' | 'deleted';
export type AdCampaignKind = 'brand_ad' | 'user_promote';
export type AdTargetType = 'external' | 'post' | 'live';

export interface AdCampaign {
  id: string;
  kind: AdCampaignKind;
  status: AdCampaignStatus;
  publisherUid: string;
  publisherName: string;
  publisherHandle: string;
  publisherAvatar: string;
  isOfficialBrand: boolean;
  title: string;
  description: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: 'image' | 'video';
  ctaLabel: string;
  destinationUrl: string;
  targetType: AdTargetType;
  targetPostId?: string | null;
  targetHostUid?: string | null;
  placement: 'all' | 'feed' | 'live';
  packageId: string;
  budgetTier: string;
  coinsSpent: number;
  targetImpressions: number;
  durationHours: number;
  impressions: number;
  uniqueClicks: number;
  createdAt: string | null;
  expiresAt: string | null;
}

export const OFFICIAL_BRAND_UID = 'lonkind_official_brand';
export const OFFICIAL_BRAND_PROFILE = {
  uid: OFFICIAL_BRAND_UID,
  name: 'Lonkind',
  handle: 'lonkind',
  username: 'lonkind',
  avatarUrl: '/logo.png',
  bio: 'Official Lonkind Brand & Sponsored Partner Announcements — https://lonkind.com',
  isOfficialBrand: true,
  isVerified: true,
  isAdmin: false,
  role: 'brand',
};

export function isSafeAdDestinationUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatCtrPercent(impressions: number, uniqueClicks: number): string {
  if (!impressions || impressions <= 0) return '0.00%';
  const pct = (Math.max(0, uniqueClicks) / impressions) * 100;
  return `${pct.toFixed(2)}%`;
}
