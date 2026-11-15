/**
 * @fileOverview Lonkind Smart Explore Recommendation & Ranking Engine
 *
 * Implements a normalized, multi-signal recommendation scoring and diversity re-ranking
 * pipeline inspired by modern social discovery feeds (Instagram Explore, TikTok For You, Facebook Discovery).
 *
 * Baseline Configurable Weights:
 * - Interest & Topic Relevance: 30% (0.30)
 * - Previous User Interactions: 25% (0.25)
 * - Content Engagement Quality: 20% (0.20)
 * - Content Freshness:          10% (0.10)
 * - Creator Affinity:           10% (0.10)
 * - Exploration & Diversity:     5% (0.05)
 */

export interface RankingWeights {
  interestRelevance: number;
  previousInteractions: number;
  engagementQuality: number;
  freshness: number;
  creatorAffinity: number;
  explorationDiversity: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  interestRelevance: 0.30,
  previousInteractions: 0.25,
  engagementQuality: 0.20,
  freshness: 0.10,
  creatorAffinity: 0.10,
  explorationDiversity: 0.05,
};

export type ExploreTopicId =
  | 'all'
  | 'technology'
  | 'music'
  | 'entertainment'
  | 'business'
  | 'art_design'
  | 'lifestyle'
  | 'sports'
  | 'gaming'
  | 'education'
  | 'news'
  | 'community';

export interface ExploreTopicMeta {
  id: ExploreTopicId;
  label: string;
  keywords: string[];
}

export const EXPLORE_TOPICS: ExploreTopicMeta[] = [
  { id: 'all', label: 'For You', keywords: [] },
  {
    id: 'technology',
    label: 'Tech & AI',
    keywords: ['tech', 'ai', 'coding', 'software', 'startup', 'developer', 'crypto', 'web3', 'innovation', 'app', 'data', 'cyber', 'robot', 'digital', 'gadget', 'programming'],
  },
  {
    id: 'music',
    label: 'Music & Audio',
    keywords: ['music', 'song', 'beat', 'afrobeats', 'hiphop', 'artist', 'concert', 'producer', 'album', 'singing', 'rap', 'studio', 'playlist', 'audio', 'sound', 'piano', 'guitar'],
  },
  {
    id: 'entertainment',
    label: 'Comedy & Entertainment',
    keywords: ['comedy', 'funny', 'meme', 'laugh', 'skit', 'movie', 'film', 'entertainment', 'drama', 'viral', 'show', 'series', 'dance', 'trend', 'actor', 'celebrity'],
  },
  {
    id: 'business',
    label: 'Business & Finance',
    keywords: ['business', 'finance', 'money', 'invest', 'entrepreneur', 'market', 'trading', 'wealth', 'career', 'sales', 'founder', 'economy', 'fintech', 'growth', ' hustle'],
  },
  {
    id: 'art_design',
    label: 'Art & Creativity',
    keywords: ['art', 'design', 'photography', 'photo', 'creative', 'drawing', 'illustration', 'fashion', 'style', 'architecture', 'ui', 'ux', 'visual', 'painting', 'craft'],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle & Wellness',
    keywords: ['lifestyle', 'fitness', 'health', 'food', 'travel', 'wellness', 'beauty', 'fashion', 'motivation', 'mindset', 'cooking', 'workout', 'family', 'life', 'vlog'],
  },
  {
    id: 'sports',
    label: 'Sports & Fitness',
    keywords: ['sports', 'football', 'soccer', 'basketball', 'nba', 'premierleague', 'fifa', 'gym', 'athlete', 'match', 'goal', 'champion', 'running', 'boxing', 'tennis'],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    keywords: ['gaming', 'gamer', 'esports', 'stream', 'playstation', 'xbox', 'pcgaming', 'twitch', 'game', 'cod', 'fortnite', 'valorant', 'minecraft', 'rpg'],
  },
  {
    id: 'education',
    label: 'Learning & Ideas',
    keywords: ['education', 'learn', 'science', 'history', 'book', 'study', 'tips', 'tutorial', 'knowledge', 'howto', 'research', 'university', 'facts', 'philosophy'],
  },
  {
    id: 'news',
    label: 'News & World',
    keywords: ['news', 'breaking', 'update', 'world', 'nigeria', 'africa', 'global', 'politics', 'report', 'headline', 'journalism', 'currentevents', 'press'],
  },
  {
    id: 'community',
    label: 'Causes & Community',
    keywords: ['community', 'lonkind', 'cause', 'charity', 'support', 'donate', 'help', 'together', 'impact', 'peace', 'love', 'kindness', 'culture', 'events'],
  },
];

export interface UserInterestProfile {
  uid: string;
  personalizationEnabled: boolean;
  explicitTopics: string[];
  topicScores: Record<string, number>;
  hashtagScores: Record<string, number>;
  keywordScores: Record<string, number>;
  creatorAffinities: Record<string, number>;
  mediaPreferences: {
    video: number;
    image: number;
    text: number;
    music: number;
  };
  recentSearches: string[];
  seenPostIds: string[];
  likedPostIds: string[];
  commentedPostIds: string[];
  savedPostIds: string[];
  skippedVideoIds: string[];
  dismissedPostIds: string[];
  dismissedCreatorUids: string[];
  dismissedTopics: string[];
  followingUids: string[];
  blockedUids: string[];
  mutedUids: string[];
  updatedAt?: number;
}

export interface ScoreBreakdown {
  total: number;
  interestRelevance: number;
  previousInteractions: number;
  engagementQuality: number;
  freshness: number;
  creatorAffinity: number;
  explorationDiversity: number;
  spamPenalty: number;
  seenPenalty: number;
}

export interface RankedExplorePost {
  id: string;
  author: {
    name: string;
    avatarUrl: string;
    handle: string;
    uid: string;
    isProfessional?: boolean;
    badges?: string[];
    followersCount?: number;
  };
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  reactions: Record<string, number>;
  comments: number;
  timestamp: any;
  createdAtMs: number;
  groupId?: string | null;
  music?: { title: string; url: string } | null;
  isVipOnly?: boolean;
  unlockCoins?: number;
  unlockedBy?: string[];
  isCause?: boolean;
  causeTitle?: string;
  targetCoins?: number;
  raisedCoins?: number;
  isHidden?: boolean;
  moderationStatus?: string;
  hashtags?: string[];
  searchKeywords?: string[];
  attribution?: any;
  videoScript?: any;
  // Computed recommendation metadata
  detectedTopics: ExploreTopicId[];
  recommendationScore: number;
  scoreBreakdown: ScoreBreakdown;
  recommendationReason: string;
  recommendationBadgeType: 'interest' | 'creator' | 'rising' | 'trending' | 'discovery' | 'similar';
}

export function createDefaultInterestProfile(uid: string): UserInterestProfile {
  return {
    uid,
    personalizationEnabled: true,
    explicitTopics: [],
    topicScores: {},
    hashtagScores: {},
    keywordScores: {},
    creatorAffinities: {},
    mediaPreferences: {
      video: 1.0,
      image: 1.0,
      text: 1.0,
      music: 1.0,
    },
    recentSearches: [],
    seenPostIds: [],
    likedPostIds: [],
    commentedPostIds: [],
    savedPostIds: [],
    skippedVideoIds: [],
    dismissedPostIds: [],
    dismissedCreatorUids: [],
    dismissedTopics: [],
    followingUids: [],
    blockedUids: [],
    mutedUids: [],
    updatedAt: Date.now(),
  };
}

/**
 * Extracts normalized hashtags, keywords, and canonical topic categories from a post.
 */
export function extractPostSignals(post: any): {
  hashtags: string[];
  keywords: string[];
  topics: ExploreTopicId[];
  mediaType: 'video' | 'image' | 'music' | 'text';
} {
  const rawContent = String(post?.content || '').toLowerCase();
  const rawHashtags: string[] = Array.isArray(post?.hashtags) ? post.hashtags : [];
  const inlineMatches = rawContent.match(/#\w+/g) || [];

  const hashtags = Array.from(
    new Set(
      [...rawHashtags, ...inlineMatches]
        .map((h) => String(h).replace(/^#/, '').toLowerCase().trim())
        .filter((h) => h.length > 1)
    )
  );

  const rawKeywords: string[] = Array.isArray(post?.searchKeywords) ? post.searchKeywords : [];
  const contentWords = rawContent
    .replace(/https?:\/\/\S+/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3);

  const keywords = Array.from(
    new Set([...rawKeywords.map((k) => String(k).replace(/^#/, '').toLowerCase()), ...contentWords, ...hashtags])
  ).slice(0, 50);

  const keywordSet = new Set(keywords);
  const topics: ExploreTopicId[] = [];

  for (const topicMeta of EXPLORE_TOPICS) {
    if (topicMeta.id === 'all') continue;
    const hasMatch = topicMeta.keywords.some(
      (kw) => keywordSet.has(kw) || hashtags.some((h) => h.includes(kw))
    );
    if (hasMatch) {
      topics.push(topicMeta.id);
    }
  }

  if (post?.isCause && !topics.includes('community')) {
    topics.push('community');
  }
  if (post?.attribution && !topics.includes('news')) {
    topics.push('news');
  }
  if (post?.music && !topics.includes('music')) {
    topics.push('music');
  }
  if (topics.length === 0) {
    topics.push('community');
  }

  const mediaType: 'video' | 'image' | 'music' | 'text' = post?.videoUrl
    ? 'video'
    : post?.imageUrl
    ? 'image'
    : post?.music
    ? 'music'
    : 'text';

  return { hashtags, keywords, topics, mediaType };
}

/**
 * Converts Firestore Timestamp, ISO string, or number into epoch milliseconds.
 */
export function getPostTimestampMs(timestamp: any): number {
  if (!timestamp) return Date.now() - 12 * 3600 * 1000;
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  if (typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (typeof timestamp._seconds === 'number') {
    return timestamp._seconds * 1000;
  }
  if (typeof timestamp.seconds === 'number') {
    return timestamp.seconds * 1000;
  }
  return Date.now();
}

/**
 * 1. Interest & Topic Relevance Score [0..1] (Weight: 30%)
 * Evaluates alignment with explicit user topics, implicit topic weights, hashtag affinity,
 * and recent search queries.
 */
function computeInterestRelevanceScore(
  signals: ReturnType<typeof extractPostSignals>,
  profile: UserInterestProfile
): { score: number; matchedTagOrTopic: string | null } {
  if (!profile.personalizationEnabled) {
    return { score: 0.5, matchedTagOrTopic: null };
  }

  // Check if topic is explicitly dismissed
  if (signals.topics.some((t) => profile.dismissedTopics.includes(t))) {
    return { score: 0.05, matchedTagOrTopic: null };
  }

  let rawScore = 0;
  let matchedTagOrTopic: string | null = null;
  let bestSignalStrength = 0;

  // A. Explicit topic match (strong user preference)
  for (const t of signals.topics) {
    if (profile.explicitTopics.includes(t)) {
      rawScore += 0.45;
      const meta = EXPLORE_TOPICS.find((m) => m.id === t);
      if (0.45 > bestSignalStrength) {
        bestSignalStrength = 0.45;
        matchedTagOrTopic = meta?.label || t;
      }
    }
  }

  // B. Implicit topic score from behavior
  for (const t of signals.topics) {
    const topicWeight = profile.topicScores[t] || 0;
    if (topicWeight > 0) {
      const normalizedTopic = Math.min(0.4, Math.tanh(topicWeight / 10) * 0.4);
      rawScore += normalizedTopic;
      if (normalizedTopic > bestSignalStrength) {
        bestSignalStrength = normalizedTopic;
        const meta = EXPLORE_TOPICS.find((m) => m.id === t);
        matchedTagOrTopic = meta?.label || t;
      }
    }
  }

  // C. Hashtag affinity match
  for (const tag of signals.hashtags) {
    const tagWeight = profile.hashtagScores[tag] || 0;
    if (tagWeight > 0) {
      const normalizedTag = Math.min(0.45, Math.tanh(tagWeight / 6) * 0.45);
      rawScore += normalizedTag;
      if (normalizedTag > bestSignalStrength) {
        bestSignalStrength = normalizedTag;
        matchedTagOrTopic = `#${tag}`;
      }
    }
  }

  // D. Recent search query match (searched keywords & hashtags)
  if (profile.recentSearches.length > 0) {
    for (const search of profile.recentSearches.slice(0, 12)) {
      const cleanSearch = search.toLowerCase().replace(/^#/, '').trim();
      if (!cleanSearch) continue;
      if (
        signals.hashtags.includes(cleanSearch) ||
        signals.keywords.includes(cleanSearch)
      ) {
        rawScore += 0.35;
        if (!matchedTagOrTopic) {
          matchedTagOrTopic = search.startsWith('#') ? search : `"${search}"`;
        }
        break;
      }
    }
  }

  // E. Keyword overlap
  let keywordHits = 0;
  for (const kw of signals.keywords) {
    const kwScore = profile.keywordScores[kw] || 0;
    if (kwScore > 0) {
      keywordHits += Math.min(0.1, kwScore * 0.02);
    }
  }
  rawScore += Math.min(0.25, keywordHits);

  // Cold-start baseline if user has no recorded preferences yet
  const hasAnyInterestData =
    profile.explicitTopics.length > 0 ||
    Object.keys(profile.topicScores).length > 0 ||
    Object.keys(profile.hashtagScores).length > 0 ||
    profile.recentSearches.length > 0;

  if (!hasAnyInterestData) {
    return { score: 0.45, matchedTagOrTopic: null };
  }

  return {
    score: Math.max(0, Math.min(1, rawScore)),
    matchedTagOrTopic,
  };
}

/**
 * 2. Previous User Interactions Score [0..1] (Weight: 25%)
 * Considers past reactions, comments, saves, video watch vs skip behavior, and media preference.
 */
function computePreviousInteractionsScore(
  post: any,
  signals: ReturnType<typeof extractPostSignals>,
  profile: UserInterestProfile
): { score: number; reason: string | null } {
  if (!profile.personalizationEnabled) {
    return { score: 0.45, reason: null };
  }

  const postId = String(post.id || '');
  const authorUid = String(post?.author?.uid || '');

  // If user skipped this video previously, penalize heavily
  if (profile.skippedVideoIds.includes(postId)) {
    return { score: 0.05, reason: null };
  }

  let score = 0.25; // baseline
  let reason: string | null = null;

  // A. Media format preference (learned from video watch time, image views, text dwell)
  const mediaPrefs = profile.mediaPreferences || { video: 1, image: 1, text: 1, music: 1 };
  const totalPref =
    (mediaPrefs.video || 1) +
    (mediaPrefs.image || 1) +
    (mediaPrefs.text || 1) +
    (mediaPrefs.music || 1);
  const currentMediaPref = mediaPrefs[signals.mediaType] || 1;
  const mediaMultiplier = Math.min(1.5, Math.max(0.6, (currentMediaPref / (totalPref / 4))));
  score *= mediaMultiplier;

  // B. Previous interactions with this creator (likes, comments, saves, watch time)
  const creatorInteractionScore = profile.creatorAffinities[authorUid] || 0;
  if (creatorInteractionScore > 0) {
    const boost = Math.min(0.5, Math.tanh(creatorInteractionScore / 8) * 0.5);
    score += boost;
    if (boost >= 0.2) {
      reason = `Because you interacted with @${post?.author?.handle || 'creator'}`;
    }
  }

  // C. Similarity to previously saved or liked content topics/tags
  let matchingHighIntentTags = 0;
  for (const tag of signals.hashtags) {
    if ((profile.hashtagScores[tag] || 0) >= 3) {
      matchingHighIntentTags++;
    }
  }
  if (matchingHighIntentTags > 0) {
    score += Math.min(0.3, matchingHighIntentTags * 0.15);
    if (!reason) {
      reason = 'Similar to posts you liked & saved';
    }
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    reason,
  };
}

/**
 * 3. Content Engagement Quality Score [0..1] (Weight: 20%)
 * Normalized using logarithmic scaling so mega-accounts don't automatically dominate,
 * while rewarding meaningful interactions (comments, diverse reactions) and penalizing spam.
 */
function computeEngagementQualityScore(
  post: any,
  ageHours: number
): { score: number; spamPenalty: number } {
  const reactions = post?.reactions || {};
  const likes = Number(reactions.like || 0);
  const loves = Number(reactions.love || 0);
  const laughs = Number(reactions.laugh || 0);
  const sads = Number(reactions.sad || 0);
  const totalReactions = likes + loves + laughs + sads;
  const comments = Number(post?.comments || 0);

  // Weighted raw engagement: comments and expressive reactions carry stronger quality weight
  const weightedEngagement =
    likes * 1.0 +
    (loves + laughs + sads) * 1.8 +
    comments * 3.2;

  // Engagement velocity adjusted for post age (gives newer posts with early traction a fair chance)
  const effectiveHours = Math.max(2, Math.min(72, ageHours));
  const velocityBonus = weightedEngagement / Math.pow(effectiveHours, 0.45);

  // Log-dampened normalization prevents accounts with 10,000 likes from drowning out all other posts
  // log10(1 + weightedEngagement) maps 0 -> 0, 9 -> 0.5, 99 -> 1.0
  const volumeNormalized = Math.min(1, Math.log10(1 + weightedEngagement) / 2.0);
  const velocityNormalized = Math.min(1, Math.log10(1 + velocityBonus * 2) / 1.8);

  // Discussion depth bonus (healthy comment-to-reaction ratio, capped to prevent comment-bait manipulation)
  const discussionRatio = totalReactions > 0 ? Math.min(1, comments / totalReactions) : comments > 0 ? 0.5 : 0;
  const qualityMix = volumeNormalized * 0.55 + velocityNormalized * 0.30 + discussionRatio * 0.15;

  // Content substance & anti-spam heuristics
  const content = String(post?.content || '').trim();
  const hashtagsCount = (content.match(/#\w+/g) || []).length;
  const linksCount = (content.match(/https?:\/\/\S+/g) || []).length;
  const upperCaseRatio =
    content.length > 20
      ? content.replace(/[^A-Z]/g, '').length / Math.max(1, content.replace(/[^a-zA-Z]/g, '').length)
      : 0;

  let spamPenalty = 0;
  // Excessive hashtag stuffing (>12 hashtags)
  if (hashtagsCount > 12) {
    spamPenalty += Math.min(0.45, (hashtagsCount - 12) * 0.05);
  }
  // Excessive links
  if (linksCount > 2) {
    spamPenalty += 0.3;
  }
  // All-caps engagement bait
  if (upperCaseRatio > 0.75 && content.length > 35) {
    spamPenalty += 0.2;
  }
  // Very short empty post with no media
  if (content.length < 5 && !post?.imageUrl && !post?.videoUrl && !post?.music) {
    spamPenalty += 0.35;
  }

  // Substance boost for rich media or thoughtful text
  const substanceBoost =
    (post?.videoUrl || post?.imageUrl ? 0.12 : 0) +
    (content.length >= 40 && content.length <= 1200 ? 0.08 : 0);

  const finalQuality = Math.max(0.05, Math.min(1, qualityMix + substanceBoost - spamPenalty));
  return { score: finalQuality, spamPenalty };
}

/**
 * 4. Content Freshness Score [0..1] (Weight: 10%)
 * Note: Brand-new posts (<15 mins) with zero signals get a moderate eligibility score (0.78)
 * rather than 1.0, so Explore doesn't act like a raw chronological timeline where every new upload
 * jumps to #1 for all users.
 */
function computeFreshnessScore(ageHours: number): number {
  if (ageHours < 0.25) {
    // 0-15 minutes old: eligible for discovery, but not artificially pinned above higher-relevance posts
    return 0.78;
  }
  if (ageHours <= 6) {
    // Sweet spot for fresh discovery (15 mins to 6 hours)
    return 0.92;
  }
  // Smooth exponential half-life decay (~48 hours half-life)
  const decayLambda = Math.LN2 / 48;
  const decayed = Math.exp(-decayLambda * (ageHours - 6));
  return Math.max(0.08, Math.min(0.92, decayed * 0.92));
}

/**
 * 5. Creator Affinity Score [0..1] (Weight: 10%)
 * Balances followed creators and trusted creators with discovery of new voices.
 */
function computeCreatorAffinityScore(
  post: any,
  profile: UserInterestProfile
): { score: number; isFollowed: boolean } {
  const authorUid = String(post?.author?.uid || '');
  if (!authorUid) return { score: 0.2, isFollowed: false };

  const isFollowed = profile.followingUids.includes(authorUid);
  const directAffinity = profile.creatorAffinities[authorUid] || 0;

  let score = 0.25;
  if (isFollowed) {
    score += 0.45;
  }
  if (directAffinity > 0) {
    score += Math.min(0.30, Math.tanh(directAffinity / 10) * 0.30);
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    isFollowed,
  };
}

/**
 * 6. Exploration & Emerging Creator Discovery Score [0..1] (Weight: 5%)
 * Ensures new creators (even without many followers) and novel topics have opportunities
 * to be discovered in the Explore feed.
 */
function computeExplorationDiversityScore(
  post: any,
  signals: ReturnType<typeof extractPostSignals>,
  profile: UserInterestProfile,
  ageHours: number
): { score: number; isRisingCreator: boolean } {
  const authorUid = String(post?.author?.uid || '');
  const isFollowed = profile.followingUids.includes(authorUid);
  const knownAffinity = profile.creatorAffinities[authorUid] || 0;
  const followersCount = Number(post?.author?.followersCount ?? 0);
  const contentLen = String(post?.content || '').trim().length;
  const hasMedia = Boolean(post?.imageUrl || post?.videoUrl || post?.music);

  let score = 0.3;
  let isRisingCreator = false;

  // Unfollowed creator with low follower count who created substantive content
  if (!isFollowed && knownAffinity === 0 && authorUid !== profile.uid) {
    score += 0.35;
    if (followersCount < 50 && (hasMedia || contentLen >= 30) && ageHours <= 168) {
      score += 0.30;
      isRisingCreator = true;
    }
  }

  // Deterministic pseudo-serendipity per (user, post, day) so feed stays stable during a session
  const dayBucket = Math.floor(Date.now() / (1000 * 60 * 60 * 6));
  const seedStr = `${profile.uid}:${post.id}:${dayBucket}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
  }
  const serendipity = ((Math.abs(hash) % 100) / 100) * 0.15;
  score += serendipity;

  return {
    score: Math.max(0, Math.min(1, score)),
    isRisingCreator,
  };
}

/**
 * Scores a single post candidate against the user's interest profile.
 */
export function scorePostForUser(
  post: any,
  profile: UserInterestProfile,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): RankedExplorePost {
  const createdAtMs = getPostTimestampMs(post.timestamp || post.createdAt);
  const ageHours = Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60));
  const signals = extractPostSignals(post);

  const interestResult = computeInterestRelevanceScore(signals, profile);
  const interactionResult = computePreviousInteractionsScore(post, signals, profile);
  const qualityResult = computeEngagementQualityScore(post, ageHours);
  const freshnessScore = computeFreshnessScore(ageHours);
  const affinityResult = computeCreatorAffinityScore(post, profile);
  const explorationResult = computeExplorationDiversityScore(post, signals, profile, ageHours);

  // Weighted linear combination using the configurable weights (sum = 1.0)
  let rawTotal =
    interestResult.score * weights.interestRelevance +
    interactionResult.score * weights.previousInteractions +
    qualityResult.score * weights.engagementQuality +
    freshnessScore * weights.freshness +
    affinityResult.score * weights.creatorAffinity +
    explorationResult.score * weights.explorationDiversity;

  // Penalize already-seen posts so unseen posts always rank higher
  const isSeen = profile.seenPostIds.includes(String(post.id));
  const seenPenalty = isSeen ? 0.32 : 0;

  // Slight demotion for the user's own posts on Explore (Explore is primarily for discovering others)
  const ownPostAdjustment = post?.author?.uid === profile.uid ? -0.18 : 0;

  const finalScore = Math.max(0.01, rawTotal - seenPenalty + ownPostAdjustment);

  // Determine human-readable recommendation reason & badge
  let recommendationReason = 'Recommended for you';
  let recommendationBadgeType: RankedExplorePost['recommendationBadgeType'] = 'discovery';

  if (interestResult.matchedTagOrTopic && interestResult.score >= 0.4) {
    recommendationReason = `Matches your interest in ${interestResult.matchedTagOrTopic}`;
    recommendationBadgeType = 'interest';
  } else if (interactionResult.reason && interactionResult.score >= 0.45) {
    recommendationReason = interactionResult.reason;
    recommendationBadgeType = 'similar';
  } else if (explorationResult.isRisingCreator && qualityResult.score >= 0.25) {
    recommendationReason = 'Rising Creator to Discover';
    recommendationBadgeType = 'rising';
  } else if (qualityResult.score >= 0.65) {
    recommendationReason = 'Trending in Lonkind Community';
    recommendationBadgeType = 'trending';
  } else if (affinityResult.isFollowed) {
    recommendationReason = `From @${post?.author?.handle || 'creator'} you follow`;
    recommendationBadgeType = 'creator';
  } else {
    const primaryTopic = signals.topics[0];
    const topicMeta = EXPLORE_TOPICS.find((t) => t.id === primaryTopic);
    recommendationReason =
      topicMeta && topicMeta.id !== 'community'
        ? `Popular in ${topicMeta.label}`
        : 'Fresh Discovery on Lonkind';
    recommendationBadgeType = 'discovery';
  }

  return {
    ...post,
    id: String(post.id),
    createdAtMs,
    hashtags: signals.hashtags.map((h) => `#${h}`),
    detectedTopics: signals.topics,
    recommendationScore: Number(finalScore.toFixed(4)),
    scoreBreakdown: {
      total: Number(finalScore.toFixed(4)),
      interestRelevance: Number(interestResult.score.toFixed(3)),
      previousInteractions: Number(interactionResult.score.toFixed(3)),
      engagementQuality: Number(qualityResult.score.toFixed(3)),
      freshness: Number(freshnessScore.toFixed(3)),
      creatorAffinity: Number(affinityResult.score.toFixed(3)),
      explorationDiversity: Number(explorationResult.score.toFixed(3)),
      spamPenalty: Number(qualityResult.spamPenalty.toFixed(3)),
      seenPenalty: Number(seenPenalty.toFixed(3)),
    },
    recommendationReason,
    recommendationBadgeType,
  };
}

/**
 * Filters, scores, and applies diversity constraints (creator diversity, topic diversity,
 * familiar vs new creator balance) across candidate posts.
 */
export function rankAndDiversifyPosts(
  candidates: any[],
  profile: UserInterestProfile,
  options: {
    limit?: number;
    category?: ExploreTopicId;
    mode?: 'for_you' | 'rising_creators' | 'trending';
    excludeIds?: Set<string>;
    weights?: RankingWeights;
  } = {}
): RankedExplorePost[] {
  const {
    limit = 8,
    category = 'all',
    mode = 'for_you',
    excludeIds = new Set<string>(),
    weights = DEFAULT_RANKING_WEIGHTS,
  } = options;

  const blockedSet = new Set(profile.blockedUids || []);
  const mutedSet = new Set(profile.mutedUids || []);
  const dismissedPostsSet = new Set(profile.dismissedPostIds || []);
  const dismissedCreatorsSet = new Set(profile.dismissedCreatorUids || []);

  // 1. Privacy, Safety & Eligibility Filtering
  const seenCandidateIds = new Set<string>();
  const eligibleCandidates = candidates.filter((post) => {
    if (!post || !post.id) return false;
    const postId = String(post.id);
    if (seenCandidateIds.has(postId) || excludeIds.has(postId)) return false;
    seenCandidateIds.add(postId);

    // Exclude hidden/moderated posts
    if (post.isHidden || post.moderationStatus === 'removed' || post.moderationStatus === 'rejected') {
      return false;
    }

    // Exclude private group posts from public Explore
    if (post.groupId !== null && post.groupId !== undefined && post.groupId !== '') {
      return false;
    }

    // Exclude blocked, muted, or dismissed creators and posts
    const authorUid = String(post?.author?.uid || '');
    if (blockedSet.has(authorUid) || mutedSet.has(authorUid) || dismissedCreatorsSet.has(authorUid)) {
      return false;
    }
    if (dismissedPostsSet.has(postId)) {
      return false;
    }

    return true;
  });

  // 2. Score all eligible candidates
  let scored = eligibleCandidates.map((post) => scorePostForUser(post, profile, weights));

  // 3. Apply Topic Category Filter if selected
  if (category && category !== 'all') {
    scored = scored.filter((p) => p.detectedTopics.includes(category));
  }

  // 4. Adjust sorting for special Explore modes
  if (mode === 'rising_creators') {
    scored = scored
      .filter((p) => !profile.followingUids.includes(p.author?.uid) && p.author?.uid !== profile.uid)
      .sort(
        (a, b) =>
          b.scoreBreakdown.explorationDiversity * 0.5 +
          b.scoreBreakdown.engagementQuality * 0.3 +
          b.scoreBreakdown.freshness * 0.2 -
          (a.scoreBreakdown.explorationDiversity * 0.5 +
            a.scoreBreakdown.engagementQuality * 0.3 +
            a.scoreBreakdown.freshness * 0.2)
      );
  } else if (mode === 'trending') {
    scored = scored.sort(
      (a, b) =>
        b.scoreBreakdown.engagementQuality * 0.7 +
        b.scoreBreakdown.freshness * 0.3 -
        (a.scoreBreakdown.engagementQuality * 0.7 + a.scoreBreakdown.freshness * 0.3)
    );
  } else {
    scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  // 5. Greedy Diversity Re-ranking Pass
  // Prevents showing the same creator or identical topic repeatedly in consecutive positions
  const selected: RankedExplorePost[] = [];
  const remaining = [...scored];
  const creatorCountInBatch = new Map<string, number>();

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjustedScore = -Infinity;

    const prev1 = selected[selected.length - 1];
    const prev2 = selected[selected.length - 2];

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const authorUid = candidate.author?.uid || 'unknown';
      const primaryTopic = candidate.detectedTopics[0] || 'community';

      let adjustedScore = candidate.recommendationScore;

      // Penalty if this creator already appeared in this batch (cap dominance)
      const countForCreator = creatorCountInBatch.get(authorUid) || 0;
      if (countForCreator >= 2) {
        adjustedScore -= 0.50;
      } else if (countForCreator === 1) {
        adjustedScore -= 0.18;
      }

      // Strong penalty for back-to-back posts from the exact same creator
      if (prev1 && prev1.author?.uid === authorUid) {
        adjustedScore -= 0.45;
      }
      if (prev2 && prev2.author?.uid === authorUid) {
        adjustedScore -= 0.20;
      }

      // Penalty for 3 consecutive posts on the exact same topic (when browsing 'all')
      if (
        category === 'all' &&
        prev1 &&
        prev2 &&
        prev1.detectedTopics[0] === primaryTopic &&
        prev2.detectedTopics[0] === primaryTopic
      ) {
        adjustedScore -= 0.15;
      }

      // Discovery injection: every 4th slot, give a slight boost to unfollowed rising creators
      if (
        selected.length % 4 === 3 &&
        candidate.recommendationBadgeType === 'rising' &&
        countForCreator === 0
      ) {
        adjustedScore += 0.12;
      }

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    const authorUid = chosen.author?.uid || 'unknown';
    creatorCountInBatch.set(authorUid, (creatorCountInBatch.get(authorUid) || 0) + 1);
    selected.push(chosen);
  }

  return selected;
}
