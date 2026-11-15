'use client';

/**
 * @fileOverview Lonkind Batched User Behavior & Interest Signal Tracker
 *
 * Tracks relevant recommendation signals efficiently:
 * - Post impressions (deduplicated per session, >=50% viewport for >=1.5s)
 * - Dwell time / time spent viewing posts
 * - Post clicks / comment opens
 * - Likes and reactions
 * - Comments
 * - Saves / bookmarks
 * - Video watch duration & video skips (<2s before scrolling away)
 * - Searched topics, keywords, and hashtags
 * - Explicit user interests & "Not Interested" dismissals
 * - Personalization privacy controls (enable/disable tracking, reset history)
 *
 * Cost & Performance Guarantees:
 * - Never generates Firestore writes on every scroll movement.
 * - Buffers signals in memory + localStorage and flushes aggregated profile updates
 *   at most once every 25 seconds (or when buffer hits 15 high-intent events / page hide).
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  type UserInterestProfile,
  type ExploreTopicId,
  createDefaultInterestProfile,
  extractPostSignals,
} from './recommendation-engine';

const STORAGE_KEY_PREFIX = 'lonkind_rec_profile_v1_';
const FLUSH_INTERVAL_MS = 25000; // 25 seconds minimum between Firestore writes
const MAX_ARRAY_CAP = 120;
const MAX_SCORE_MAP_KEYS = 80;

export type InteractionEventType =
  | 'impression'
  | 'dwell'
  | 'click'
  | 'reaction'
  | 'comment'
  | 'save'
  | 'unsave'
  | 'video_watch'
  | 'video_skip'
  | 'search'
  | 'hashtag_click'
  | 'follow'
  | 'not_interested';

export interface InteractionSignalPayload {
  type: InteractionEventType;
  post?: any;
  postId?: string;
  authorUid?: string;
  reactionType?: string;
  dwellSeconds?: number;
  watchSeconds?: number;
  videoDurationSeconds?: number;
  searchQuery?: string;
  hashtag?: string;
  topic?: ExploreTopicId;
}

class RecommendationTrackerManager {
  private profiles = new Map<string, UserInterestProfile>();
  private dirtyUids = new Set<string>();
  private pendingEventCount = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionImpressions = new Set<string>();
  private sessionDwellRecorded = new Set<string>();
  private loadedFromFirestore = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushAll();
        }
      });
    }
  }

  private getStorageKey(uid: string): string {
    return `${STORAGE_KEY_PREFIX}${uid}`;
  }

  /**
   * Loads the user's interest profile from memory, localStorage, or Firestore (once per session).
   */
  public async getProfile(uid: string): Promise<UserInterestProfile> {
    if (!uid) return createDefaultInterestProfile('anonymous');

    const existing = this.profiles.get(uid);
    if (existing && this.loadedFromFirestore.has(uid)) {
      return existing;
    }

    // 1. Hydrate immediately from localStorage if available
    let localProfile: UserInterestProfile | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(this.getStorageKey(uid));
        if (raw) {
          localProfile = {
            ...createDefaultInterestProfile(uid),
            ...JSON.parse(raw),
            uid,
          };
          this.profiles.set(uid, localProfile!);
        }
      } catch {
        // Ignore storage parse issues
      }
    }

    // 2. Fetch remote profile once per session
    if (!this.loadedFromFirestore.has(uid)) {
      this.loadedFromFirestore.add(uid);
      try {
        const ref = doc(db, 'users', uid, 'recommendationProfile', 'main');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<UserInterestProfile>;
          const merged = this.mergeProfiles(
            localProfile || createDefaultInterestProfile(uid),
            remoteData
          );
          this.profiles.set(uid, merged);
          this.saveToLocalStorage(uid, merged);
          return merged;
        }
      } catch {
        // Offline or rules fallback: use local profile
      }
    }

    const fallback = localProfile || createDefaultInterestProfile(uid);
    this.profiles.set(uid, fallback);
    return fallback;
  }

  /**
   * Synchronous getter for cached profile (returns default if not yet hydrated).
   */
  public getCachedProfile(uid: string): UserInterestProfile {
    if (!uid) return createDefaultInterestProfile('anonymous');
    const mem = this.profiles.get(uid);
    if (mem) return mem;

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(this.getStorageKey(uid));
        if (raw) {
          const parsed: UserInterestProfile = {
            ...createDefaultInterestProfile(uid),
            ...JSON.parse(raw),
            uid,
          };
          this.profiles.set(uid, parsed);
          return parsed;
        }
      } catch {
        // Ignore
      }
    }

    const fresh = createDefaultInterestProfile(uid);
    this.profiles.set(uid, fresh);
    return fresh;
  }

  /**
   * Records a user interaction signal into the in-memory & localStorage profile
   * and schedules a batched, debounced Firestore write.
   */
  public track(uid: string, payload: InteractionSignalPayload): void {
    if (!uid) return;
    const profile = this.getCachedProfile(uid);

    // Always allow explicit "not_interested" dismissal even if behavioral tracking is paused
    if (!profile.personalizationEnabled && payload.type !== 'not_interested') {
      if (payload.type === 'impression' && payload.postId) {
        if (!this.sessionImpressions.has(payload.postId)) {
          this.sessionImpressions.add(payload.postId);
          profile.seenPostIds = this.prependUnique(profile.seenPostIds, payload.postId, MAX_ARRAY_CAP);
          this.saveToLocalStorage(uid, profile);
        }
      }
      return;
    }

    const postId = payload.postId || payload.post?.id;
    const authorUid = payload.authorUid || payload.post?.author?.uid;
    const signals = payload.post ? extractPostSignals(payload.post) : null;

    let isHighIntent = false;

    switch (payload.type) {
      case 'impression': {
        if (!postId || this.sessionImpressions.has(postId)) return;
        this.sessionImpressions.add(postId);
        profile.seenPostIds = this.prependUnique(profile.seenPostIds, postId, MAX_ARRAY_CAP);
        break;
      }

      case 'dwell': {
        if (!postId || !signals) return;
        const dwellSec = payload.dwellSeconds || 0;
        if (dwellSec < 3) return;
        const dwellKey = `${postId}_${dwellSec >= 8 ? 'deep' : 'light'}`;
        if (this.sessionDwellRecorded.has(dwellKey)) return;
        this.sessionDwellRecorded.add(dwellKey);

        const weight = dwellSec >= 8 ? 1.2 : 0.5;
        this.applySignalBoost(profile, signals, authorUid, weight);
        break;
      }

      case 'click': {
        if (signals) {
          this.applySignalBoost(profile, signals, authorUid, 1.5);
        }
        isHighIntent = true;
        break;
      }

      case 'reaction': {
        isHighIntent = true;
        if (postId) {
          profile.likedPostIds = this.prependUnique(profile.likedPostIds, postId, MAX_ARRAY_CAP);
        }
        const reactionMultiplier =
          payload.reactionType === 'love'
            ? 3.0
            : payload.reactionType === 'laugh'
            ? 2.5
            : 2.2;
        if (signals) {
          this.applySignalBoost(profile, signals, authorUid, reactionMultiplier);
        } else if (authorUid && authorUid !== uid) {
          profile.creatorAffinities[authorUid] =
            (profile.creatorAffinities[authorUid] || 0) + reactionMultiplier;
        }
        break;
      }

      case 'comment': {
        isHighIntent = true;
        if (postId) {
          profile.commentedPostIds = this.prependUnique(
            profile.commentedPostIds,
            postId,
            MAX_ARRAY_CAP
          );
        }
        if (signals) {
          this.applySignalBoost(profile, signals, authorUid, 3.5);
        } else if (authorUid && authorUid !== uid) {
          profile.creatorAffinities[authorUid] =
            (profile.creatorAffinities[authorUid] || 0) + 3.5;
        }
        break;
      }

      case 'save': {
        isHighIntent = true;
        if (postId) {
          profile.savedPostIds = this.prependUnique(profile.savedPostIds, postId, MAX_ARRAY_CAP);
        }
        if (signals) {
          this.applySignalBoost(profile, signals, authorUid, 4.0);
        } else if (authorUid && authorUid !== uid) {
          profile.creatorAffinities[authorUid] =
            (profile.creatorAffinities[authorUid] || 0) + 3.5;
        }
        break;
      }

      case 'unsave': {
        if (postId) {
          profile.savedPostIds = profile.savedPostIds.filter((id) => id !== postId);
        }
        break;
      }

      case 'video_watch': {
        const watchSec = payload.watchSeconds || 0;
        if (watchSec < 3) return;
        const duration = payload.videoDurationSeconds || 15;
        const completionRatio = duration > 0 ? Math.min(1, watchSec / duration) : 0.5;
        const boost = watchSec >= 10 || completionRatio >= 0.65 ? 2.8 : 1.4;
        profile.mediaPreferences.video = Math.min(
          5.0,
          (profile.mediaPreferences.video || 1.0) + 0.15
        );
        if (signals) {
          this.applySignalBoost(profile, signals, authorUid, boost);
        }
        isHighIntent = watchSec >= 10;
        break;
      }

      case 'video_skip': {
        if (!postId) return;
        profile.skippedVideoIds = this.prependUnique(
          profile.skippedVideoIds,
          postId,
          MAX_ARRAY_CAP
        );
        profile.mediaPreferences.video = Math.max(
          0.4,
          (profile.mediaPreferences.video || 1.0) - 0.05
        );
        if (signals) {
          for (const t of signals.topics) {
            if (profile.topicScores[t]) {
              profile.topicScores[t] = Math.max(0, profile.topicScores[t] - 0.4);
            }
          }
        }
        break;
      }

      case 'search': {
        const q = (payload.searchQuery || '').trim().toLowerCase();
        if (q.length < 2) return;
        isHighIntent = true;
        profile.recentSearches = this.prependUnique(profile.recentSearches, q, 25);

        const tokens = q
          .split(/\s+/)
          .map((t) => t.replace(/^#/, '').replace(/[^a-z0-9]/g, ''))
          .filter((t) => t.length >= 2);

        for (const token of tokens) {
          profile.keywordScores[token] = (profile.keywordScores[token] || 0) + 2.5;
          if (q.startsWith('#')) {
            profile.hashtagScores[token] = (profile.hashtagScores[token] || 0) + 3.0;
          }
        }

        const matchedSignals = extractPostSignals({ content: q, hashtags: q.startsWith('#') ? [q] : [] });
        for (const topic of matchedSignals.topics) {
          if (topic !== 'community' || q.includes('community') || q.includes('cause')) {
            profile.topicScores[topic] = (profile.topicScores[topic] || 0) + 2.2;
          }
        }
        break;
      }

      case 'hashtag_click': {
        const cleanTag = (payload.hashtag || '').replace(/^#/, '').toLowerCase().trim();
        if (!cleanTag) return;
        isHighIntent = true;
        profile.hashtagScores[cleanTag] = (profile.hashtagScores[cleanTag] || 0) + 3.0;
        profile.recentSearches = this.prependUnique(
          profile.recentSearches,
          `#${cleanTag}`,
          25
        );
        break;
      }

      case 'follow': {
        if (authorUid && authorUid !== uid) {
          isHighIntent = true;
          profile.followingUids = this.prependUnique(
            profile.followingUids,
            authorUid,
            MAX_ARRAY_CAP
          );
          profile.creatorAffinities[authorUid] =
            (profile.creatorAffinities[authorUid] || 0) + 5.0;
        }
        break;
      }

      case 'not_interested': {
        isHighIntent = true;
        if (postId) {
          profile.dismissedPostIds = this.prependUnique(
            profile.dismissedPostIds,
            postId,
            MAX_ARRAY_CAP
          );
        }
        if (authorUid) {
          profile.creatorAffinities[authorUid] = Math.max(
            0,
            (profile.creatorAffinities[authorUid] || 0) - 3.0
          );
        }
        if (signals) {
          for (const tag of signals.hashtags) {
            if (profile.hashtagScores[tag]) {
              profile.hashtagScores[tag] = Math.max(0, profile.hashtagScores[tag] - 2.0);
            }
          }
          for (const topic of signals.topics) {
            if (profile.topicScores[topic]) {
              profile.topicScores[topic] = Math.max(0, profile.topicScores[topic] - 1.5);
            }
          }
        }
        break;
      }
    }

    this.pruneProfileMaps(profile);
    profile.updatedAt = Date.now();
    this.profiles.set(uid, profile);
    this.saveToLocalStorage(uid, profile);

    this.dirtyUids.add(uid);
    this.pendingEventCount += isHighIntent ? 3 : 1;

    this.scheduleFlush(isHighIntent && this.pendingEventCount >= 15);
  }

  /**
   * Updates user's explicit topic selections and personalization privacy preference.
   */
  public async updatePreferences(
    uid: string,
    updates: {
      explicitTopics?: string[];
      personalizationEnabled?: boolean;
    }
  ): Promise<UserInterestProfile> {
    const profile = await this.getProfile(uid);
    if (updates.explicitTopics !== undefined) {
      profile.explicitTopics = updates.explicitTopics;
    }
    if (updates.personalizationEnabled !== undefined) {
      profile.personalizationEnabled = updates.personalizationEnabled;
    }
    profile.updatedAt = Date.now();
    this.profiles.set(uid, profile);
    this.saveToLocalStorage(uid, profile);
    this.dirtyUids.add(uid);
    await this.flushProfile(uid);
    return profile;
  }

  /**
   * Resets all behavioral recommendation history for the user while keeping privacy toggle state.
   */
  public async resetRecommendationHistory(uid: string): Promise<UserInterestProfile> {
    const current = this.getCachedProfile(uid);
    const reset = createDefaultInterestProfile(uid);
    reset.personalizationEnabled = current.personalizationEnabled;
    this.profiles.set(uid, reset);
    this.sessionImpressions.clear();
    this.sessionDwellRecorded.clear();
    this.saveToLocalStorage(uid, reset);
    this.dirtyUids.add(uid);
    await this.flushProfile(uid);
    return reset;
  }

  private applySignalBoost(
    profile: UserInterestProfile,
    signals: ReturnType<typeof extractPostSignals>,
    authorUid: string | undefined,
    weight: number
  ): void {
    for (const topic of signals.topics) {
      profile.topicScores[topic] = Number(
        ((profile.topicScores[topic] || 0) + weight).toFixed(2)
      );
    }
    for (const tag of signals.hashtags.slice(0, 8)) {
      profile.hashtagScores[tag] = Number(
        ((profile.hashtagScores[tag] || 0) + weight * 1.1).toFixed(2)
      );
    }
    for (const kw of signals.keywords.slice(0, 10)) {
      profile.keywordScores[kw] = Number(
        ((profile.keywordScores[kw] || 0) + weight * 0.4).toFixed(2)
      );
    }
    if (authorUid && authorUid !== profile.uid) {
      profile.creatorAffinities[authorUid] = Number(
        ((profile.creatorAffinities[authorUid] || 0) + weight * 0.9).toFixed(2)
      );
    }
    const mediaKey = signals.mediaType;
    profile.mediaPreferences[mediaKey] = Number(
      Math.min(5.0, (profile.mediaPreferences[mediaKey] || 1.0) + weight * 0.05).toFixed(2)
    );
  }

  private prependUnique(list: string[], item: string, maxLen: number): string[] {
    const filtered = (list || []).filter((x) => x !== item);
    return [item, ...filtered].slice(0, maxLen);
  }

  private pruneProfileMaps(profile: UserInterestProfile): void {
    const pruneMap = (map: Record<string, number>, maxKeys: number) => {
      const entries = Object.entries(map);
      if (entries.length <= maxKeys) return map;
      entries.sort((a, b) => b[1] - a[1]);
      return Object.fromEntries(entries.slice(0, maxKeys));
    };

    profile.hashtagScores = pruneMap(profile.hashtagScores, MAX_SCORE_MAP_KEYS);
    profile.keywordScores = pruneMap(profile.keywordScores, MAX_SCORE_MAP_KEYS);
    profile.creatorAffinities = pruneMap(profile.creatorAffinities, MAX_SCORE_MAP_KEYS);
  }

  private mergeProfiles(
    local: UserInterestProfile,
    remote: Partial<UserInterestProfile>
  ): UserInterestProfile {
    const mergeScoreMap = (
      a: Record<string, number> = {},
      b: Record<string, number> = {}
    ): Record<string, number> => {
      const out: Record<string, number> = { ...b };
      for (const [k, v] of Object.entries(a)) {
        out[k] = Math.max(out[k] || 0, v);
      }
      return out;
    };

    const mergeList = (a: string[] = [], b: string[] = [], cap = MAX_ARRAY_CAP) =>
      Array.from(new Set([...a, ...b])).slice(0, cap);

    return {
      ...local,
      personalizationEnabled:
        remote.personalizationEnabled ?? local.personalizationEnabled ?? true,
      explicitTopics:
        local.explicitTopics.length > 0
          ? local.explicitTopics
          : remote.explicitTopics || [],
      topicScores: mergeScoreMap(local.topicScores, remote.topicScores),
      hashtagScores: mergeScoreMap(local.hashtagScores, remote.hashtagScores),
      keywordScores: mergeScoreMap(local.keywordScores, remote.keywordScores),
      creatorAffinities: mergeScoreMap(local.creatorAffinities, remote.creatorAffinities),
      mediaPreferences: {
        video: Math.max(local.mediaPreferences?.video || 1, remote.mediaPreferences?.video || 1),
        image: Math.max(local.mediaPreferences?.image || 1, remote.mediaPreferences?.image || 1),
        text: Math.max(local.mediaPreferences?.text || 1, remote.mediaPreferences?.text || 1),
        music: Math.max(local.mediaPreferences?.music || 1, remote.mediaPreferences?.music || 1),
      },
      recentSearches: mergeList(local.recentSearches, remote.recentSearches, 25),
      seenPostIds: mergeList(local.seenPostIds, remote.seenPostIds),
      likedPostIds: mergeList(local.likedPostIds, remote.likedPostIds),
      commentedPostIds: mergeList(local.commentedPostIds, remote.commentedPostIds),
      savedPostIds: mergeList(local.savedPostIds, remote.savedPostIds),
      skippedVideoIds: mergeList(local.skippedVideoIds, remote.skippedVideoIds),
      dismissedPostIds: mergeList(local.dismissedPostIds, remote.dismissedPostIds),
      dismissedCreatorUids: mergeList(local.dismissedCreatorUids, remote.dismissedCreatorUids),
      dismissedTopics: mergeList(local.dismissedTopics, remote.dismissedTopics),
    };
  }

  private saveToLocalStorage(uid: string, profile: UserInterestProfile): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.getStorageKey(uid), JSON.stringify(profile));
    } catch {
      // Ignore quota errors
    }
  }

  private scheduleFlush(immediate = false): void {
    if (immediate) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      this.flushAll();
      return;
    }

    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushAll();
    }, FLUSH_INTERVAL_MS);
  }

  public async flushProfile(uid: string): Promise<void> {
    if (!uid || !this.dirtyUids.has(uid)) return;
    const profile = this.profiles.get(uid);
    if (!profile) return;

    this.dirtyUids.delete(uid);
    try {
      const ref = doc(db, 'users', uid, 'recommendationProfile', 'main');
      await setDoc(
        ref,
        {
          personalizationEnabled: profile.personalizationEnabled,
          explicitTopics: profile.explicitTopics,
          topicScores: profile.topicScores,
          hashtagScores: profile.hashtagScores,
          keywordScores: profile.keywordScores,
          creatorAffinities: profile.creatorAffinities,
          mediaPreferences: profile.mediaPreferences,
          recentSearches: profile.recentSearches.slice(0, 25),
          seenPostIds: profile.seenPostIds.slice(0, 100),
          likedPostIds: profile.likedPostIds.slice(0, 60),
          commentedPostIds: profile.commentedPostIds.slice(0, 60),
          savedPostIds: profile.savedPostIds.slice(0, 60),
          skippedVideoIds: profile.skippedVideoIds.slice(0, 40),
          dismissedPostIds: profile.dismissedPostIds.slice(0, 60),
          dismissedCreatorUids: profile.dismissedCreatorUids.slice(0, 40),
          dismissedTopics: profile.dismissedTopics.slice(0, 20),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // Keep local state intact if offline
    }
  }

  public flushAll(): void {
    this.pendingEventCount = 0;
    const uids = Array.from(this.dirtyUids);
    uids.forEach((uid) => {
      this.flushProfile(uid).catch(() => {});
    });
  }
}

export const recommendationTracker = new RecommendationTrackerManager();
