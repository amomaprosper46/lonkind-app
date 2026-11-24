'use client';

import type { AdCampaign } from './ads-schema';

const HIDDEN_ADS_KEY = 'lonkind-hidden-ads';
const AD_FREQ_KEY = 'lonkind-ad-freq';
export const MAX_AD_VIEWS_PER_24H = 2;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function getHiddenAdIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_ADS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markAdHiddenLocally(campaignId: string): void {
  if (typeof window === 'undefined' || !campaignId) return;
  try {
    const hidden = getHiddenAdIds();
    hidden.add(campaignId);
    window.localStorage.setItem(HIDDEN_ADS_KEY, JSON.stringify(Array.from(hidden)));
  } catch {
    // Ignore storage errors
  }
}

function readFrequencyMap(): Record<string, number[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(AD_FREQ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFrequencyMap(map: Record<string, number[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AD_FREQ_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns how many times the user has seen `campaignId` within the last 24 hours.
 */
export function getRecentAdViewCount(campaignId: string): number {
  const now = Date.now();
  const map = readFrequencyMap();
  const list = Array.isArray(map[campaignId]) ? map[campaignId] : [];
  return list.filter((ts) => typeof ts === 'number' && now - ts < TWENTY_FOUR_HOURS_MS).length;
}

/**
 * Records an impression timestamp for frequency capping (max 2 views per 24h).
 */
export function recordLocalAdImpression(campaignId: string): void {
  if (typeof window === 'undefined' || !campaignId) return;
  const now = Date.now();
  const map = readFrequencyMap();
  const existing = Array.isArray(map[campaignId]) ? map[campaignId] : [];
  const pruned = existing.filter((ts) => typeof ts === 'number' && now - ts < TWENTY_FOUR_HOURS_MS);
  pruned.push(now);
  map[campaignId] = pruned;
  writeFrequencyMap(map);
}

/**
 * Filters active campaigns for a specific viewer:
 * - Excludes hidden ads
 * - Enforces 2 views / 24h frequency cap
 * - Enforces 21+ target audience restriction when viewer age is known and < 21
 */
export function filterEligibleAdsForViewer(
  campaigns: AdCampaign[],
  viewerAge?: number | null
): AdCampaign[] {
  const hidden = getHiddenAdIds();
  return campaigns.filter((camp) => {
    if (!camp?.id || camp.status !== 'active') return false;
    if (hidden.has(camp.id)) return false;
    if (getRecentAdViewCount(camp.id) >= MAX_AD_VIEWS_PER_24H) return false;
    if (camp.targetAudience === '21+' && typeof viewerAge === 'number' && viewerAge < 21) {
      return false;
    }
    return true;
  });
}
