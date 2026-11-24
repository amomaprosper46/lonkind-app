/**
 * Shared Ads & Promote schema, promotion packages, and validation helpers.
 * Zero React hooks — safe to import in both Server API Routes and Client Components.
 */

export type PromoPackageId = 'starter' | 'growth' | 'spotlight';

export interface PromoPackage {
  id: PromoPackageId;
  name: string;
  coins: number;
  priceNgn: number;
  priceUsd: number;
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
    priceNgn: 1000,
    priceUsd: 1.5,
    durationHours: 24,
    durationLabel: '24 Hours',
    targetImpressions: 1000,
    tagline: 'Great for quick feed visibility',
  },
  growth: {
    id: 'growth',
    name: 'Growth Reach',
    coins: 300,
    priceNgn: 3000,
    priceUsd: 4.0,
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
    priceNgn: 7500,
    priceUsd: 9.5,
    durationHours: 168,
    durationLabel: '7 Days',
    targetImpressions: 12000,
    tagline: 'Maximum creator & brand discovery',
    badge: 'Best Value',
  },
};

export const AD_CURRENCY_RATES_FROM_NGN: Record<string, { symbol: string; multFromNgn: number }> = {
  NGN: { symbol: '₦', multFromNgn: 1 },
  USD: { symbol: '$', multFromNgn: 0.0015 },
  GHS: { symbol: '₵', multFromNgn: 0.015 },
  KES: { symbol: 'KSh', multFromNgn: 0.15 },
  GBP: { symbol: '£', multFromNgn: 0.0012 },
  EUR: { symbol: '€', multFromNgn: 0.0014 },
  ZAR: { symbol: 'R', multFromNgn: 0.025 },
};

export function getPromoPackagePrice(pkg: PromoPackage, currency: string): number {
  const code = String(currency || 'NGN').toUpperCase();
  if (code === 'NGN') return pkg.priceNgn;
  if (code === 'USD') return pkg.priceUsd;
  const info = AD_CURRENCY_RATES_FROM_NGN[code];
  if (!info) return pkg.priceNgn;
  return Number((pkg.priceNgn * info.multFromNgn).toFixed(2));
}

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

export type AdCampaignStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'awaiting_payment'
  | 'pending_review'
  | 'pending_approval'
  | 'rejected'
  | 'rejected_refund_needed'
  | 'deleted';
export type AdRefundStatus =
  | 'none'
  | 'refund_processing'
  | 'refunded'
  | 'manual_refund_required'
  | 'refunded_manually';
export type AdCampaignKind = 'brand_ad' | 'user_promote';
export type AdTargetType = 'external' | 'post' | 'live';
export type AdTargetAudience = '18+' | '21+';

export interface AdRevenueLedgerEntry {
  id: string;
  transactionId: string;
  txRef: string;
  type: 'direct_ad_revenue' | 'ad_refund';
  provider: string;
  campaignId: string;
  payerUid: string;
  payerHandle: string;
  amount: number;
  currency: string;
  status: string;
  refundStatus?: AdRefundStatus;
  flutterwaveRefundId?: string | null;
  reason?: string | null;
  createdAt: string | null;
}

export const AD_REJECTION_REASONS = [
  'Misleading Claim',
  'Inappropriate Media',
  'Invalid Link',
  'Policy Violation',
] as const;

export interface AdCampaign {
  id: string;
  kind: AdCampaignKind;
  status: AdCampaignStatus;
  targetAudience: AdTargetAudience;
  publisherUid: string;
  publisherName: string;
  publisherHandle: string;
  publisherAvatar: string;
  publisherVerifiedAge?: number | null;
  publisherIsAdult?: boolean;
  publisherAccountStanding?: string;
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
  blockedInvalidViews?: number;
  paymentMethod?: 'coins' | 'flutterwave' | 'brand_free';
  paymentStatus?: 'paid' | 'pending' | 'refund_needed' | 'refunded';
  refundStatus?: AdRefundStatus;
  flutterwaveTxRef?: string | null;
  flutterwaveTransactionId?: string | null;
  flutterwaveRefundId?: string | null;
  refundErrorMessage?: string | null;
  refundedAt?: string | null;
  amountPaid?: number;
  currencyPaid?: string | null;
  reportCount?: number;
  rejectionReason?: string | null;
  refundId?: string | null;
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

const BLOCKED_AD_EXT_RE = /\.(exe|apk|bat|cmd|scr|msi|sh|dmg|ps1|vbs|jar|dll|com|pif)(\?|#|$)/i;

export function isSafeAdDestinationUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length > 2048 || /[\s<>'"`]/.test(trimmed)) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return false;
    if (BLOCKED_AD_EXT_RE.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function formatCtrPercent(impressions: number, uniqueClicks: number): string {
  if (!impressions || impressions <= 0) return '0.00%';
  const pct = (Math.max(0, uniqueClicks) / impressions) * 100;
  return `${pct.toFixed(2)}%`;
}
