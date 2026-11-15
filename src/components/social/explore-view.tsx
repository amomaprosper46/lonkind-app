'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Loader2,
  Compass,
  Search,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  TrendingUp,
  Flame,
  Users,
  Hash,
  FileText,
  X,
  UserPlus,
  Check,
  ShieldCheck,
  RotateCcw,
  BadgeCheck,
  Video,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { db, auth } from '@/lib/firebase';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import SkeletonCard from './skeleton-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CurrentUser } from './social-dashboard';
import {
  EXPLORE_TOPICS,
  DEFAULT_RANKING_WEIGHTS,
  type ExploreTopicId,
  type RankedExplorePost,
  type UserInterestProfile,
  rankAndDiversifyPosts,
} from '@/lib/recommendation-engine';
import { recommendationTracker } from '@/lib/recommendation-tracker';

const INITIAL_BATCH_SIZE = 8; // 5-10 posts per batch requirement

interface RisingCreatorItem {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
  isProfessional?: boolean;
  badges?: string[];
  samplePostSnippet?: string;
}

interface CachedExploreSession {
  posts: RankedExplorePost[];
  nextCursor: string | null;
  hasMore: boolean;
  risingCreators: RisingCreatorItem[];
  scrollY: number;
  timestamp: number;
}

// In-memory session cache so navigating away and returning preserves exact feed order & scroll position
const exploreSessionCache = new Map<string, CachedExploreSession>();

export interface ExploreViewProps {
  currentUser: CurrentUser;
  onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
  onComment: (post: Post) => void;
  onSavePost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  userReactions: Map<string, ReactionType>;
  savedPostIds: Set<string>;
  onReportPost?: (post: any) => void;
  onMuteUser?: (user: any) => void;
  mutedUids?: Set<string>;
  blockedUids?: Set<string>;
  activeLiveUids?: Set<string>;
  onWatchLive?: (hostUid: string) => void;
  onOpenVideos?: () => void;
  initialSearchQuery?: string;
}

export default function ExploreView({
  currentUser,
  onReact,
  onComment,
  onSavePost,
  onDeletePost,
  userReactions,
  savedPostIds,
  onReportPost,
  onMuteUser,
  mutedUids,
  blockedUids,
  activeLiveUids,
  onWatchLive,
  onOpenVideos,
  initialSearchQuery = '',
}: ExploreViewProps) {
  // Primary separation: 'discover' (Algorithmic Explore Feed) vs 'search' (Deliberate Search)
  const [activeSurface, setActiveSurface] = useState<'discover' | 'search'>(
    initialSearchQuery ? 'search' : 'discover'
  );

  // Explore Feed Mode & Topic Category
  const [feedMode, setFeedMode] = useState<'for_you' | 'rising_creators' | 'trending'>('for_you');
  const [selectedTopic, setSelectedTopic] = useState<ExploreTopicId>('all');

  // Feed State
  const [posts, setPosts] = useState<RankedExplorePost[]>([]);
  const [risingCreators, setRisingCreators] = useState<RisingCreatorItem[]>([]);
  const [followedCreatorUids, setFollowedCreatorUids] = useState<Set<string>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Refs for pagination stability & preventing duplicate/overlapping requests
  const nextCursorRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const displayedPostIdsRef = useRef<Set<string>>(new Set());
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Personalization & Privacy Preferences Dialog State
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserInterestProfile>(() =>
    recommendationTracker.getCachedProfile(currentUser.uid)
  );
  const [draftExplicitTopics, setDraftExplicitTopics] = useState<string[]>([]);
  const [draftPersonalizationEnabled, setDraftPersonalizationEnabled] = useState<boolean>(true);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Deliberate Search State (Separate from Explore Feed)
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [searchScope, setSearchScope] = useState<'all' | 'people' | 'posts' | 'hashtags' | 'topics'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [searchPostsList, setSearchPostsList] = useState<Post[]>([]);
  const [searchHashtags, setSearchHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [searchTopics, setSearchTopics] = useState<any[]>([]);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);

  const sessionCacheKey = `${currentUser.uid}:${feedMode}:${selectedTopic}`;

  useEffect(() => {
    if (initialSearchQuery && initialSearchQuery.trim()) {
      setSearchInput(initialSearchQuery.trim());
      setActiveSurface('search');
    }
  }, [initialSearchQuery]);

  // Hydrate user recommendation profile & following list once on mount
  useEffect(() => {
    let mounted = true;
    recommendationTracker.getProfile(currentUser.uid).then((prof) => {
      if (!mounted) return;
      setUserProfile(prof);
      setDraftExplicitTopics(prof.explicitTopics || []);
      setDraftPersonalizationEnabled(prof.personalizationEnabled ?? true);
      if (prof.followingUids?.length) {
        setFollowedCreatorUids(new Set(prof.followingUids));
      }
    });

    // Also load trending hashtags for Search discovery
    getDocs(query(collection(db, 'trending_hashtags'), orderBy('count', 'desc'), firestoreLimit(10)))
      .then((snap) => {
        if (!mounted) return;
        setTrendingTags(
          snap.docs.map((d) => ({
            tag: `#${(d.data().tag || d.id).replace(/^#/, '')}`,
            count: Number(d.data().count || 1),
          }))
        );
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [currentUser.uid]);

  /**
   * Client-side cursor-paginated fallback if the API route fails or in offline/emulated environments.
   */
  const fetchClientFallbackBatch = useCallback(
    async (
      cursorId: string | null,
      batchLimit: number,
      excludeIds: Set<string>,
      profile: UserInterestProfile
    ): Promise<{
      posts: RankedExplorePost[];
      nextCursor: string | null;
      hasMore: boolean;
      risingCreators: RisingCreatorItem[];
    }> => {
      const postsRef = collection(db, 'posts');
      const candidateLimit = Math.min(batchLimit * 3 + 6, 30);
      let q = query(
        postsRef,
        where('groupId', '==', null),
        orderBy('timestamp', 'desc'),
        firestoreLimit(candidateLimit)
      );

      if (cursorId) {
        const cursorSnap = await getDoc(doc(db, 'posts', cursorId)).catch(() => null);
        if (cursorSnap && cursorSnap.exists()) {
          q = query(
            postsRef,
            where('groupId', '==', null),
            orderBy('timestamp', 'desc'),
            startAfter(cursorSnap),
            firestoreLimit(candidateLimit)
          );
        }
      }

      const snap = await getDocs(q);
      const rawCandidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const mergedProfile: UserInterestProfile = {
        ...profile,
        blockedUids: Array.from(new Set([...(profile.blockedUids || []), ...(blockedUids || [])])),
        mutedUids: Array.from(new Set([...(profile.mutedUids || []), ...(mutedUids || [])])),
      };

      const ranked = rankAndDiversifyPosts(rawCandidates, mergedProfile, {
        limit: batchLimit,
        category: selectedTopic,
        mode: feedMode,
        excludeIds,
      });

      const lastDoc = snap.docs[snap.docs.length - 1];
      const nextCursor = lastDoc ? lastDoc.id : null;
      const more = snap.docs.length >= Math.min(batchLimit, 5) && nextCursor !== null;

      const creatorsMap = new Map<string, RisingCreatorItem>();
      const followingSet = new Set(mergedProfile.followingUids || []);
      const blockedSet = new Set(mergedProfile.blockedUids || []);
      const mutedSet = new Set(mergedProfile.mutedUids || []);

      for (const c of rawCandidates as any[]) {
        const author = c.author;
        if (
          author?.uid &&
          author.uid !== currentUser.uid &&
          !followingSet.has(author.uid) &&
          !blockedSet.has(author.uid) &&
          !mutedSet.has(author.uid) &&
          !creatorsMap.has(author.uid)
        ) {
          creatorsMap.set(author.uid, {
            uid: author.uid,
            name: author.name || 'Creator',
            handle: author.handle || 'creator',
            avatarUrl: author.avatarUrl || '',
            isProfessional: Boolean(author.isProfessional),
            badges: author.badges || [],
            samplePostSnippet: String(c.content || '').slice(0, 70),
          });
        }
        if (creatorsMap.size >= 8) break;
      }

      return {
        posts: ranked,
        nextCursor,
        hasMore: more,
        risingCreators: Array.from(creatorsMap.values()),
      };
    },
    [blockedUids, currentUser.uid, feedMode, mutedUids, selectedTopic]
  );

  /**
   * Fetches a batch of recommended posts (initial or next page) with strict deduplication
   * and request locking.
   */
  const fetchExploreBatch = useCallback(
    async (options: { reset?: boolean; manualRefresh?: boolean } = {}) => {
      const { reset = false, manualRefresh = false } = options;

      if (isFetchingRef.current) return;
      if (!reset && !hasMore) return;

      isFetchingRef.current = true;
      setFeedError(null);

      if (manualRefresh) {
        setIsRefreshing(true);
      } else if (reset) {
        setIsInitialLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const cursorToUse = reset ? null : nextCursorRef.current;
      const currentDisplayedSet = reset
        ? new Set<string>()
        : new Set<string>(displayedPostIdsRef.current);

      try {
        const activeProfile = await recommendationTracker.getProfile(currentUser.uid);
        activeProfile.blockedUids = Array.from(
          new Set([...(activeProfile.blockedUids || []), ...(blockedUids || [])])
        );
        activeProfile.mutedUids = Array.from(
          new Set([...(activeProfile.mutedUids || []), ...(mutedUids || [])])
        );
        setUserProfile(activeProfile);

        let batchResult: {
          posts: RankedExplorePost[];
          nextCursor: string | null;
          hasMore: boolean;
          risingCreators?: RisingCreatorItem[];
        } | null = null;

        try {
          const idToken = await auth.currentUser?.getIdToken().catch(() => null);
          const response = await fetch('/api/explore/feed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            body: JSON.stringify({
              uid: currentUser.uid,
              limit: INITIAL_BATCH_SIZE,
              cursor: cursorToUse,
              category: selectedTopic,
              mode: feedMode,
              excludeIds: Array.from(currentDisplayedSet),
              includeRisingCreators: reset,
              clientProfile: activeProfile,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.posts)) {
              batchResult = data;
            }
          }
        } catch {
          // Fallback to client-side cursor pagination & ranking below
        }

        if (!batchResult) {
          batchResult = await fetchClientFallbackBatch(
            cursorToUse,
            INITIAL_BATCH_SIZE,
            currentDisplayedSet,
            activeProfile
          );
        }

        // Deduplicate incoming batch against already rendered post IDs
        const uniqueNewPosts: RankedExplorePost[] = [];
        for (const p of batchResult.posts) {
          if (p && p.id && !currentDisplayedSet.has(p.id)) {
            currentDisplayedSet.add(p.id);
            uniqueNewPosts.push(p);
          }
        }

        displayedPostIdsRef.current = currentDisplayedSet;
        nextCursorRef.current = batchResult.nextCursor;
        setHasMore(Boolean(batchResult.hasMore && batchResult.nextCursor));

        setPosts((prev) => {
          const updated = reset ? uniqueNewPosts : [...prev, ...uniqueNewPosts];
          exploreSessionCache.set(sessionCacheKey, {
            posts: updated,
            nextCursor: batchResult!.nextCursor,
            hasMore: Boolean(batchResult!.hasMore && batchResult!.nextCursor),
            risingCreators:
              reset && batchResult!.risingCreators?.length
                ? batchResult!.risingCreators
                : risingCreators,
            scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
            timestamp: Date.now(),
          });
          return updated;
        });

        if (reset && batchResult.risingCreators && batchResult.risingCreators.length > 0) {
          setRisingCreators(batchResult.risingCreators);
        }
      } catch (err: any) {
        console.error('Error loading Explore recommendations:', err);
        setFeedError('Could not load recommendations right now. Please try refreshing.');
      } finally {
        isFetchingRef.current = false;
        setIsInitialLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [
      blockedUids,
      currentUser.uid,
      feedMode,
      fetchClientFallbackBatch,
      hasMore,
      mutedUids,
      risingCreators,
      selectedTopic,
      sessionCacheKey,
    ]
  );

  // Restore from session cache or fetch initial batch when (mode, topic) changes
  useEffect(() => {
    if (activeSurface !== 'discover') return;

    const cached = exploreSessionCache.get(sessionCacheKey);
    const isCacheFresh = cached && Date.now() - cached.timestamp < 10 * 60 * 1000;

    if (isCacheFresh && cached.posts.length > 0) {
      setPosts(cached.posts);
      setRisingCreators(cached.risingCreators || []);
      nextCursorRef.current = cached.nextCursor;
      setHasMore(cached.hasMore);
      displayedPostIdsRef.current = new Set(cached.posts.map((p) => p.id));
      setIsInitialLoading(false);

      // Restore scroll position smoothly without jumping
      if (typeof window !== 'undefined' && cached.scrollY > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: cached.scrollY, behavior: 'instant' as ScrollBehavior });
        });
      }
      return;
    }

    nextCursorRef.current = null;
    displayedPostIdsRef.current.clear();
    setHasMore(true);
    fetchExploreBatch({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCacheKey, activeSurface]);

  // Save scroll position into session cache so returning to Explore restores exact spot
  useEffect(() => {
    if (activeSurface !== 'discover') return;
    const handleScroll = () => {
      const existing = exploreSessionCache.get(sessionCacheKey);
      if (existing) {
        existing.scrollY = window.scrollY;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSurface, sessionCacheKey]);

  // Progressive Infinite Scroll via IntersectionObserver
  useEffect(() => {
    if (activeSurface !== 'discover') return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          !isFetchingRef.current &&
          !isInitialLoading &&
          hasMore &&
          posts.length > 0
        ) {
          fetchExploreBatch({ reset: false });
        }
      },
      { root: null, rootMargin: '450px 0px', threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeSurface, fetchExploreBatch, hasMore, isInitialLoading, posts.length]);

  // Filter out newly blocked or muted users immediately from displayed state without reordering
  useEffect(() => {
    if ((!blockedUids || blockedUids.size === 0) && (!mutedUids || mutedUids.size === 0)) return;
    setPosts((prev) =>
      prev.filter(
        (p) =>
          !blockedUids?.has(p.author?.uid) &&
          !mutedUids?.has(p.author?.uid)
      )
    );
  }, [blockedUids, mutedUids]);

  // Track reactions, comments, saves, and "Not Interested" dismissals
  const handleExploreReact = useCallback(
    (post: RankedExplorePost, reaction: ReactionType) => {
      recommendationTracker.track(currentUser.uid, {
        type: 'reaction',
        post,
        postId: post.id,
        authorUid: post.author?.uid,
        reactionType: reaction,
      });
      onReact(post.id, reaction, post.author?.uid || '');
    },
    [currentUser.uid, onReact]
  );

  const handleExploreComment = useCallback(
    (post: Post) => {
      recommendationTracker.track(currentUser.uid, {
        type: 'click',
        post,
        postId: post.id,
        authorUid: post.author?.uid,
      });
      onComment(post);
    },
    [currentUser.uid, onComment]
  );

  const handleExploreSave = useCallback(
    (post: Post) => {
      const alreadySaved = savedPostIds.has(post.id);
      recommendationTracker.track(currentUser.uid, {
        type: alreadySaved ? 'unsave' : 'save',
        post,
        postId: post.id,
        authorUid: post.author?.uid,
      });
      onSavePost(post.id);
    },
    [currentUser.uid, onSavePost, savedPostIds]
  );

  const handleNotInterested = useCallback(
    (post: Post) => {
      recommendationTracker.track(currentUser.uid, {
        type: 'not_interested',
        post,
        postId: post.id,
        authorUid: post.author?.uid,
      });
      setPosts((prev) => {
        const filtered = prev.filter((p) => p.id !== post.id);
        const existing = exploreSessionCache.get(sessionCacheKey);
        if (existing) existing.posts = filtered;
        return filtered;
      });
      toast({
        title: 'Post hidden',
        description: "We'll tune your Explore recommendations to show fewer posts like this.",
      });
    },
    [currentUser.uid, sessionCacheKey]
  );

  const handleFollowRisingCreator = async (creator: RisingCreatorItem) => {
    if (!currentUser?.uid || creator.uid === currentUser.uid) return;
    const isFollowing = followedCreatorUids.has(creator.uid);

    try {
      const followingRef = doc(db, 'users', currentUser.uid, 'following', creator.uid);
      const followerRef = doc(db, 'users', creator.uid, 'followers', currentUser.uid);
      const targetUserRef = doc(db, 'users', creator.uid);

      if (isFollowing) {
        await Promise.all([
          deleteDoc(followingRef),
          deleteDoc(followerRef).catch(() => {}),
          updateDoc(targetUserRef, { followersCount: increment(-1) }).catch(() => {}),
        ]);
        setFollowedCreatorUids((prev) => {
          const next = new Set(prev);
          next.delete(creator.uid);
          return next;
        });
        toast({ title: `Unfollowed @${creator.handle}` });
      } else {
        await Promise.all([
          setDoc(followingRef, {
            uid: creator.uid,
            name: creator.name,
            handle: creator.handle,
            avatarUrl: creator.avatarUrl,
            timestamp: serverTimestamp(),
          }),
          setDoc(followerRef, {
            uid: currentUser.uid,
            name: currentUser.name,
            handle: currentUser.handle,
            avatarUrl: currentUser.avatarUrl,
            timestamp: serverTimestamp(),
          }).catch(() => {}),
          updateDoc(targetUserRef, { followersCount: increment(1) }).catch(() => {}),
        ]);
        setFollowedCreatorUids((prev) => new Set(prev).add(creator.uid));
        recommendationTracker.track(currentUser.uid, {
          type: 'follow',
          authorUid: creator.uid,
        });
        toast({
          title: `Following @${creator.handle}!`,
          description: 'Their future posts will help shape your recommendations.',
        });
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update follow status.' });
    }
  };

  // Dedicated Search Execution (Separated from Explore Recommendations)
  const executeDeliberateSearch = useCallback(
    async (queryText: string, scope: typeof searchScope, cursor: string | null = null) => {
      const trimmed = queryText.trim();
      if (!trimmed) {
        setSearchUsers([]);
        setSearchPostsList([]);
        setSearchHashtags([]);
        setSearchTopics([]);
        setSearchNextCursor(null);
        setSearchHasMore(false);
        return;
      }

      if (cursor) {
        setIsLoadingMoreSearch(true);
      } else {
        setIsSearching(true);
        // Log search signal to recommendation tracker
        recommendationTracker.track(currentUser.uid, {
          type: 'search',
          searchQuery: trimmed,
        });
      }

      try {
        const res = await fetch('/api/explore/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            scope,
            cursor,
            limit: 12,
            blockedUids: Array.from(blockedUids || []),
            mutedUids: Array.from(mutedUids || []),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (cursor) {
            setSearchPostsList((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              const incoming = (data.posts || []).filter((p: any) => !seen.has(p.id));
              return [...prev, ...incoming];
            });
          } else {
            setSearchUsers(data.users || []);
            setSearchPostsList(data.posts || []);
            setSearchHashtags(data.hashtags || []);
            setSearchTopics(data.topics || []);
          }
          setSearchNextCursor(data.nextCursor || null);
          setSearchHasMore(Boolean(data.hasMore && data.nextCursor));
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
        setIsLoadingMoreSearch(false);
      }
    },
    [blockedUids, currentUser.uid, mutedUids]
  );

  // Debounced search trigger when in Search surface
  useEffect(() => {
    if (activeSurface !== 'search') return;
    if (!searchInput.trim()) {
      setSearchUsers([]);
      setSearchPostsList([]);
      setSearchHashtags([]);
      setSearchTopics([]);
      setSearchNextCursor(null);
      setSearchHasMore(false);
      return;
    }

    const timer = setTimeout(() => {
      executeDeliberateSearch(searchInput, searchScope, null);
    }, 320);

    return () => clearTimeout(timer);
  }, [activeSurface, executeDeliberateSearch, searchInput, searchScope]);

  // Save user personalization & privacy preferences
  const handleSavePreferences = async () => {
    setIsSavingPreferences(true);
    try {
      const updated = await recommendationTracker.updatePreferences(currentUser.uid, {
        explicitTopics: draftExplicitTopics,
        personalizationEnabled: draftPersonalizationEnabled,
      });
      setUserProfile(updated);
      setIsPreferencesOpen(false);
      exploreSessionCache.clear();
      fetchExploreBatch({ reset: true, manualRefresh: true });
      toast({
        title: 'Explore Preferences Saved',
        description: draftPersonalizationEnabled
          ? 'Your Explore recommendations have been tuned to your selected topics.'
          : 'Behavioral personalization is now paused. Showing general community recommendations.',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleResetHistory = async () => {
    setIsSavingPreferences(true);
    try {
      const resetProf = await recommendationTracker.resetRecommendationHistory(currentUser.uid);
      setUserProfile(resetProf);
      setDraftExplicitTopics([]);
      exploreSessionCache.clear();
      fetchExploreBatch({ reset: true, manualRefresh: true });
      toast({
        title: 'Recommendation History Cleared',
        description: 'Your past interaction signals and search history have been reset.',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const toggleDraftTopic = (topicId: string) => {
    setDraftExplicitTopics((prev) =>
      prev.includes(topicId) ? prev.filter((t) => t !== topicId) : [...prev, topicId]
    );
  };

  const topLearnedTags = Object.entries(userProfile.hashtagScores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => `#${tag.replace(/^#/, '')}`);

  return (
    <div className="w-full space-y-6">
      {/* Top Explore & Search Header Banner */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900/95 via-indigo-950/40 to-slate-900/95 p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                  Explore & Discovery
                </h1>
                <Badge
                  variant="secondary"
                  className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold"
                >
                  <Sparkles className="h-3 w-3 mr-1 text-indigo-400" />
                  {userProfile.personalizationEnabled ? 'Smart Personalized' : 'Standard Feed'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeSurface === 'discover'
                  ? 'Personalized posts, rising creators, and topics tailored to your interests.'
                  : 'Search people, posts, hashtags, and topics across all of Lonkind.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {activeSurface === 'discover' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exploreSessionCache.delete(sessionCacheKey);
                  fetchExploreBatch({ reset: true, manualRefresh: true });
                }}
                disabled={isRefreshing || isInitialLoading}
                className="rounded-xl h-8 px-3 text-xs gap-1.5 border-border/60 hover:bg-secondary/60"
                title="Load fresh recommendations"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                <span>Refresh</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftExplicitTopics(userProfile.explicitTopics || []);
                setDraftPersonalizationEnabled(userProfile.personalizationEnabled ?? true);
                setIsPreferencesOpen(true);
              }}
              className="rounded-xl h-8 px-3 text-xs gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/15"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Tune Feed</span>
            </Button>
          </div>
        </div>

        {/* Surface Switcher + Dedicated Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950/70 border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSurface('discover')}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeSurface === 'discover'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Explore Feed</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSurface('search')}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeSurface === 'search'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search Lonkind</span>
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (activeSurface !== 'search' && e.target.value.trim().length > 0) {
                  setActiveSurface('search');
                }
              }}
              onFocus={() => {
                if (searchInput.trim().length > 0) {
                  setActiveSurface('search');
                }
              }}
              placeholder="Search people (@handle), posts, #hashtags, or topics..."
              className="w-full pl-9 pr-9 h-9 rounded-xl bg-slate-950/60 border-border/60 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchUsers([]);
                  setSearchPostsList([]);
                  setSearchHashtags([]);
                  setSearchTopics([]);
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SURFACE 1: DEDICATED SEARCH EXPERIENCE (SEPARATE FROM EXPLORE FEED)   */}
      {/* ===================================================================== */}
      {activeSurface === 'search' ? (
        <div className="space-y-5">
          {/* Search Scope Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'Top Results', icon: Layers },
              { id: 'people', label: 'People & Handles', icon: Users },
              { id: 'posts', label: 'Posts & Keywords', icon: FileText },
              { id: 'hashtags', label: 'Hashtags', icon: Hash },
              { id: 'topics', label: 'Topics', icon: Compass },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = searchScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSearchScope(tab.id as any)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border',
                    active
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-secondary/30 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/60'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Empty Query State: Recent Searches, Trending Hashtags & Topics */}
          {!searchInput.trim() ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-indigo-400" />
                      Recent Searches
                    </h3>
                  </div>
                  {userProfile.recentSearches && userProfile.recentSearches.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {userProfile.recentSearches.slice(0, 12).map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSearchInput(q)}
                          className="px-3 py-1.5 rounded-xl bg-secondary/40 hover:bg-indigo-500/20 border border-border/50 hover:border-indigo-500/40 text-xs font-medium transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">
                      Search for creators, keywords, or hashtags. Your searches help personalize your Explore recommendations.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    Trending Hashtags
                  </h3>
                  {trendingTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {trendingTags.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            recommendationTracker.track(currentUser.uid, {
                              type: 'hashtag_click',
                              hashtag: item.tag,
                            });
                            setSearchInput(item.tag);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-semibold text-indigo-300 transition-colors flex items-center gap-1.5"
                        >
                          <span>{item.tag}</span>
                          <span className="text-[10px] text-muted-foreground">({item.count})</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">
                      Try searching hashtags like #lonkind, #tech, #music, or #business.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : isSearching ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Matching Topics */}
              {(searchScope === 'all' || searchScope === 'topics') && searchTopics.length > 0 && (
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-indigo-400" />
                      Matching Topics ({searchTopics.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {searchTopics.map((topic: any) => (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => {
                            setSelectedTopic(topic.id);
                            setActiveSurface('discover');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-xs font-bold text-indigo-300 transition-all flex items-center gap-2"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Explore {topic.label}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Matching Hashtags */}
              {(searchScope === 'all' || searchScope === 'hashtags') && searchHashtags.length > 0 && (
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-indigo-400" />
                      Hashtags ({searchHashtags.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {searchHashtags.map((h, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            recommendationTracker.track(currentUser.uid, {
                              type: 'hashtag_click',
                              hashtag: h.tag,
                            });
                            setSearchInput(h.tag);
                            setSearchScope('posts');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-secondary/50 hover:bg-indigo-500/20 border border-border/60 text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors"
                        >
                          <span className="text-indigo-400">{h.tag}</span>
                          {h.count > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {h.count} {h.count === 1 ? 'post' : 'posts'}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Matching People & Usernames */}
              {(searchScope === 'all' || searchScope === 'people') && searchUsers.length > 0 && (
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-indigo-400" />
                      People & Creators ({searchUsers.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchUsers.map((person) => {
                        const isFollowing = followedCreatorUids.has(person.uid);
                        return (
                          <div
                            key={person.uid}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-indigo-500/40 transition-colors"
                          >
                            <Link
                              href={`/profile/${person.handle}`}
                              className="flex items-center gap-3 min-w-0 flex-1"
                            >
                              <Avatar className="h-10 w-10 border border-border/60 shrink-0">
                                <AvatarImage src={person.avatarUrl} alt={person.name} />
                                <AvatarFallback>
                                  {person.name ? person.name.charAt(0) : 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-sm truncate hover:underline">
                                    {person.name}
                                  </span>
                                  {person.isProfessional && (
                                    <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  @{person.handle}
                                </p>
                              </div>
                            </Link>
                            {person.uid !== currentUser.uid && (
                              <Button
                                size="sm"
                                variant={isFollowing ? 'secondary' : 'outline'}
                                onClick={() => handleFollowRisingCreator(person)}
                                className="h-8 px-3 rounded-xl text-xs font-bold shrink-0"
                              >
                                {isFollowing ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 mr-1" /> Following
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Follow
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Matching Posts */}
              {(searchScope === 'all' ||
                searchScope === 'posts' ||
                searchScope === 'hashtags' ||
                searchScope === 'topics') &&
                searchPostsList.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-indigo-400" />
                      Matching Posts ({searchPostsList.length})
                    </h3>
                    {searchPostsList.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUser={currentUser}
                        onReact={(postId, reaction) =>
                          onReact(postId, reaction, post.author?.uid || '')
                        }
                        onCommentClick={handleExploreComment}
                        onSavePost={() => handleExploreSave(post)}
                        onDeletePost={onDeletePost}
                        userReaction={userReactions.get(post.id)}
                        isSaved={savedPostIds.has(post.id)}
                        onReportPost={onReportPost}
                        onMuteUser={onMuteUser}
                        isAuthorLive={Boolean(
                          post.author?.uid && activeLiveUids?.has(post.author.uid)
                        )}
                        onWatchLive={onWatchLive}
                      />
                    ))}

                    {searchHasMore && (
                      <div className="flex justify-center pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoadingMoreSearch}
                          onClick={() =>
                            executeDeliberateSearch(searchInput, searchScope, searchNextCursor)
                          }
                          className="rounded-xl px-6"
                        >
                          {isLoadingMoreSearch ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Loading more results...
                            </>
                          ) : (
                            'Load More Search Results'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

              {/* No results state */}
              {searchUsers.length === 0 &&
                searchPostsList.length === 0 &&
                searchHashtags.length === 0 &&
                searchTopics.length === 0 && (
                  <Card className="rounded-2xl border-border/60">
                    <CardContent className="p-8 text-center text-muted-foreground space-y-2">
                      <Search className="h-10 w-10 mx-auto text-slate-500 mb-2" />
                      <h3 className="text-base font-bold text-foreground">
                        No matches found for &ldquo;{searchInput}&rdquo;
                      </h3>
                      <p className="text-xs max-w-md mx-auto">
                        Try searching with a different keyword, @username, or #hashtag, or switch back to the Explore Feed for personalized discoveries.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSurface('discover')}
                        className="mt-3 rounded-xl"
                      >
                        Back to Explore Feed
                      </Button>
                    </CardContent>
                  </Card>
                )}
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* SURFACE 2: INTELLIGENT PERSONALIZED EXPLORE FEED                      */
        /* ===================================================================== */
        <div className="space-y-5">
          {/* Feed Mode Selector + Short Videos Quick Entry */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'for_you', label: 'For You', icon: Sparkles },
                { id: 'rising_creators', label: 'Rising Creators', icon: TrendingUp },
                { id: 'trending', label: 'Trending', icon: Flame },
              ].map((m) => {
                const Icon = m.icon;
                const active = feedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFeedMode(m.id as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border',
                      active
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/15'
                        : 'bg-secondary/30 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {onOpenVideos && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenVideos}
                className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/15"
              >
                <Video className="h-3.5 w-3.5 text-purple-400" />
                <span>Short Videos</span>
              </Button>
            )}
          </div>

          {/* Interactive Interest Topic Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {EXPLORE_TOPICS.map((topic) => {
              const isSelected = selectedTopic === topic.id;
              const isExplicitlyPreferred = userProfile.explicitTopics?.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopic(topic.id)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0',
                    isSelected
                      ? 'bg-foreground text-background border-foreground font-bold shadow-sm'
                      : isExplicitlyPreferred
                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25'
                      : 'bg-secondary/30 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/60'
                  )}
                >
                  <span>{topic.label}</span>
                  {isExplicitlyPreferred && !isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" title="In your saved interests" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rising Creators Spotlight Strip (New & Emerging Creator Discovery) */}
          {risingCreators.length > 0 && selectedTopic === 'all' && (
            <div className="rounded-2xl border border-border/60 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Creators to Discover
                  </h2>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Fresh voices across Lonkind
                </span>
              </div>

              <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-1">
                {risingCreators.map((creator) => {
                  const isFollowing = followedCreatorUids.has(creator.uid);
                  return (
                    <div
                      key={creator.uid}
                      className="w-44 shrink-0 rounded-xl border border-border/50 bg-secondary/20 p-3 flex flex-col justify-between gap-2.5 hover:border-indigo-500/40 transition-all"
                    >
                      <Link
                        href={`/profile/${creator.handle}`}
                        className="flex flex-col items-center text-center group"
                      >
                        <Avatar className="h-12 w-12 border-2 border-indigo-500/40 mb-2 group-hover:scale-105 transition-transform">
                          <AvatarImage src={creator.avatarUrl} alt={creator.name} />
                          <AvatarFallback className="bg-indigo-600 text-white font-bold">
                            {creator.name ? creator.name.charAt(0) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1 max-w-full">
                          <span className="text-xs font-bold text-foreground truncate group-hover:underline">
                            {creator.name}
                          </span>
                          {creator.isProfessional && (
                            <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate max-w-full">
                          @{creator.handle}
                        </span>
                      </Link>

                      <Button
                        size="sm"
                        variant={isFollowing ? 'secondary' : 'default'}
                        onClick={() => handleFollowRisingCreator(creator)}
                        className={cn(
                          'w-full h-7 text-[11px] font-bold rounded-lg',
                          !isFollowing && 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        )}
                      >
                        {isFollowing ? (
                          <>
                            <Check className="h-3 w-3 mr-1" /> Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3 mr-1" /> Follow
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Notice */}
          {feedError && (
            <Card className="border-destructive/40 bg-destructive/10 rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <p className="text-xs text-destructive font-medium">{feedError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchExploreBatch({ reset: true, manualRefresh: true })}
                  className="rounded-xl h-8 text-xs"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Progressive Feed Post List */}
          {isInitialLoading ? (
            <div className="space-y-5">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post as unknown as Post}
                  currentUser={currentUser}
                  onReact={(_, reaction) => handleExploreReact(post, reaction)}
                  onCommentClick={handleExploreComment}
                  onSavePost={() => handleExploreSave(post as unknown as Post)}
                  onDeletePost={onDeletePost}
                  userReaction={userReactions.get(post.id)}
                  isSaved={savedPostIds.has(post.id)}
                  onReportPost={onReportPost}
                  onMuteUser={onMuteUser}
                  isAuthorLive={Boolean(
                    post.author?.uid && activeLiveUids?.has(post.author.uid)
                  )}
                  onWatchLive={onWatchLive}
                  recommendationReason={post.recommendationReason}
                  recommendationBadgeType={post.recommendationBadgeType}
                  onNotInterested={handleNotInterested}
                />
              ))}

              {/* IntersectionObserver Sentinel for Progressive Infinite Scrolling */}
              <div ref={loadMoreSentinelRef} className="w-full py-2">
                {isLoadingMore ? (
                  <div className="space-y-4">
                    <SkeletonCard />
                  </div>
                ) : !hasMore ? (
                  <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-center space-y-2">
                    <Sparkles className="h-6 w-6 text-indigo-400 mx-auto" />
                    <p className="text-sm font-bold text-foreground">
                      You&apos;re all caught up on this discovery batch
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Interact with posts, explore another topic, or refresh to generate new personalized recommendations.
                    </p>
                    <div className="pt-2 flex justify-center gap-2">
                      {selectedTopic !== 'all' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTopic('all')}
                          className="rounded-xl text-xs"
                        >
                          View All Topics
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          exploreSessionCache.delete(sessionCacheKey);
                          fetchExploreBatch({ reset: true, manualRefresh: true });
                        }}
                        className="rounded-xl text-xs gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh Recommendations
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-8 text-center text-muted-foreground space-y-3">
                <Compass className="h-12 w-12 mx-auto text-indigo-400/80" />
                <h3 className="text-lg font-bold text-foreground">
                  {selectedTopic !== 'all'
                    ? 'No posts in this topic yet'
                    : 'Nothing to explore right now'}
                </h3>
                <p className="text-xs max-w-sm mx-auto">
                  {selectedTopic !== 'all'
                    ? 'Try switching back to For You or another topic category.'
                    : 'Be the first to share a post with the Lonkind community!'}
                </p>
                {selectedTopic !== 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTopic('all')}
                    className="rounded-xl"
                  >
                    Back to For You
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* PERSONALIZATION & PRIVACY CONTROLS DIALOG ("TUNE FEED")               */}
      {/* ===================================================================== */}
      <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-border/60 bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
              <SlidersHorizontal className="h-5 w-5 text-indigo-400" />
              Personalize Your Explore Feed
            </DialogTitle>
            <DialogDescription className="text-xs">
              Control how Lonkind recommends posts, creators, and topics on your Explore page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Personalization Privacy Toggle */}
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-secondary/30 border border-border/60">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Smart Behavioral Personalization</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use your likes, saves, comments, watch time, and searches to rank relevant posts.
                </p>
              </div>
              <Switch
                checked={draftPersonalizationEnabled}
                onCheckedChange={setDraftPersonalizationEnabled}
              />
            </div>

            {/* Explicit Interest Topic Picker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your Favorite Topics ({draftExplicitTopics.length} selected)
                </label>
                {draftExplicitTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftExplicitTopics([])}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {EXPLORE_TOPICS.filter((t) => t.id !== 'all').map((topic) => {
                  const active = draftExplicitTopics.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleDraftTopic(topic.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                        active
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground'
                      )}
                    >
                      {active ? `✓ ${topic.label}` : `+ ${topic.label}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Learned Hashtag Signals */}
            {topLearnedTags.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Learned Hashtag & Search Signals
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {topLearnedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Transparent Ranking Signal Weights */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-border/50 space-y-2">
              <p className="text-xs font-bold text-slate-200">
                How Lonkind Ranks Your Explore Feed
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>• Interest & Topic Match: {Math.round(DEFAULT_RANKING_WEIGHTS.interestRelevance * 100)}%</div>
                <div>• Past Interactions: {Math.round(DEFAULT_RANKING_WEIGHTS.previousInteractions * 100)}%</div>
                <div>• Engagement Quality: {Math.round(DEFAULT_RANKING_WEIGHTS.engagementQuality * 100)}%</div>
                <div>• Content Freshness: {Math.round(DEFAULT_RANKING_WEIGHTS.freshness * 100)}%</div>
                <div>• Creator Affinity: {Math.round(DEFAULT_RANKING_WEIGHTS.creatorAffinity * 100)}%</div>
                <div>• New Creator Discovery: {Math.round(DEFAULT_RANKING_WEIGHTS.explorationDiversity * 100)}%</div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetHistory}
              disabled={isSavingPreferences}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl gap-1.5 self-start sm:self-center"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset History
            </Button>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreferencesOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSavePreferences}
                disabled={isSavingPreferences}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                {isSavingPreferences && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save & Refresh Feed
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
