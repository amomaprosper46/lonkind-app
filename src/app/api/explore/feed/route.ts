import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  type UserInterestProfile,
  type ExploreTopicId,
  createDefaultInterestProfile,
  rankAndDiversifyPosts,
  EXPLORE_TOPICS,
} from '@/lib/recommendation-engine';

/**
 * POST /api/explore/feed
 *
 * Scalable personalized recommendation endpoint for Lonkind Explore.
 * - Uses cursor-based Firestore pagination over candidate windows (never downloads the entire collection).
 * - Merges stored user recommendation profile + social graph (following, blocked, muted) with client-buffered signals.
 * - Applies multi-signal personalized scoring (Interest 30%, Interactions 25%, Quality 20%, Freshness 10%, Affinity 10%, Exploration 5%).
 * - Enforces creator diversity, topic diversity, and emerging creator discovery.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    let uid: string = body.uid || '';
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        // Fallback to body.uid if token verification fails in local dev
      }
    }

    const batchSize = Math.min(Math.max(Number(body.limit) || 8, 5), 12);
    const cursorDocId: string | null = body.cursor || null;
    const category: ExploreTopicId = (body.category as ExploreTopicId) || 'all';
    const mode: 'for_you' | 'rising_creators' | 'trending' = body.mode || 'for_you';
    const excludeIdsList: string[] = Array.isArray(body.excludeIds) ? body.excludeIds : [];
    const excludeSet = new Set<string>(excludeIdsList);
    const includeRisingCreators = Boolean(body.includeRisingCreators);

    // 1. Build User Interest Profile (merging stored Firestore profile + client cached profile)
    const baseProfile = createDefaultInterestProfile(uid || 'anonymous');
    const clientProfile: Partial<UserInterestProfile> = body.clientProfile || {};

    let followingUids: string[] = Array.isArray(clientProfile.followingUids)
      ? clientProfile.followingUids
      : [];
    let blockedUids: string[] = Array.isArray(clientProfile.blockedUids)
      ? clientProfile.blockedUids
      : [];
    let mutedUids: string[] = Array.isArray(clientProfile.mutedUids)
      ? clientProfile.mutedUids
      : [];
    let storedProfile: Partial<UserInterestProfile> = {};

    if (uid) {
      const [recSnap, followingSnap, blockedSnap, mutedSnap] = await Promise.all([
        adminDb
          .collection('users')
          .doc(uid)
          .collection('recommendationProfile')
          .doc('main')
          .get()
          .catch(() => null),
        followingUids.length === 0
          ? adminDb
              .collection('users')
              .doc(uid)
              .collection('following')
              .limit(100)
              .get()
              .catch(() => null)
          : Promise.resolve(null),
        blockedUids.length === 0
          ? adminDb
              .collection('users')
              .doc(uid)
              .collection('blockedUsers')
              .limit(100)
              .get()
              .catch(() => null)
          : Promise.resolve(null),
        mutedUids.length === 0
          ? adminDb
              .collection('users')
              .doc(uid)
              .collection('mutedUsers')
              .limit(100)
              .get()
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      if (recSnap && recSnap.exists) {
        storedProfile = recSnap.data() as Partial<UserInterestProfile>;
      }
      if (followingSnap) {
        followingUids = followingSnap.docs.map((d) => d.id);
      }
      if (blockedSnap) {
        blockedUids = blockedSnap.docs.map((d) => d.id);
      }
      if (mutedSnap) {
        mutedUids = mutedSnap.docs.map((d) => d.id);
      }
    }

    const profile: UserInterestProfile = {
      ...baseProfile,
      ...storedProfile,
      ...clientProfile,
      uid: uid || 'anonymous',
      topicScores: { ...(storedProfile.topicScores || {}), ...(clientProfile.topicScores || {}) },
      hashtagScores: {
        ...(storedProfile.hashtagScores || {}),
        ...(clientProfile.hashtagScores || {}),
      },
      keywordScores: {
        ...(storedProfile.keywordScores || {}),
        ...(clientProfile.keywordScores || {}),
      },
      creatorAffinities: {
        ...(storedProfile.creatorAffinities || {}),
        ...(clientProfile.creatorAffinities || {}),
      },
      followingUids,
      blockedUids,
      mutedUids,
    };

    // 2. Candidate Retrieval using Firestore Cursor Pagination
    // We retrieve a bounded candidate window (e.g., 28 posts) starting after the cursor,
    // plus an interest-targeted candidate query on the first page so older highly-relevant posts
    // can also surface alongside fresh discoveries.
    const candidateWindowSize = Math.min(batchSize * 3 + 6, 32);
    const postsRef = adminDb.collection('posts');

    let mainQuery = postsRef
      .where('groupId', '==', null)
      .orderBy('timestamp', 'desc')
      .limit(candidateWindowSize);

    if (cursorDocId) {
      const cursorSnap = await postsRef.doc(cursorDocId).get().catch(() => null);
      if (cursorSnap && cursorSnap.exists) {
        mainQuery = postsRef
          .where('groupId', '==', null)
          .orderBy('timestamp', 'desc')
          .startAfter(cursorSnap)
          .limit(candidateWindowSize);
      }
    }

    // Optional targeted interest query (only when on initial load or category filter)
    let interestQueryPromise: Promise<FirebaseFirestore.QuerySnapshot | null> =
      Promise.resolve(null);

    if (!cursorDocId) {
      let targetKeywords: string[] = [];
      if (category && category !== 'all') {
        const meta = EXPLORE_TOPICS.find((t) => t.id === category);
        if (meta) {
          targetKeywords = meta.keywords.slice(0, 10);
        }
      } else if (profile.personalizationEnabled) {
        const topTags = Object.entries(profile.hashtagScores || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t]) => t.replace(/^#/, '').toLowerCase());
        const topKeywords = Object.entries(profile.keywordScores || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k]) => k.toLowerCase());
        targetKeywords = Array.from(new Set([...topTags, ...topKeywords])).slice(0, 10);
      }

      if (targetKeywords.length > 0) {
        interestQueryPromise = postsRef
          .where('searchKeywords', 'array-contains-any', targetKeywords)
          .orderBy('timestamp', 'desc')
          .limit(15)
          .get()
          .catch(() => null);
      }
    }

    const [mainSnap, interestSnap] = await Promise.all([
      mainQuery.get(),
      interestQueryPromise,
    ]);

    const rawCandidatesMap = new Map<string, any>();

    mainSnap.docs.forEach((docSnap) => {
      if (!excludeSet.has(docSnap.id)) {
        rawCandidatesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      }
    });

    if (interestSnap) {
      interestSnap.docs.forEach((docSnap) => {
        if (!excludeSet.has(docSnap.id) && !rawCandidatesMap.has(docSnap.id)) {
          const data = docSnap.data();
          if (data.groupId === null || data.groupId === undefined) {
            rawCandidatesMap.set(docSnap.id, { id: docSnap.id, ...data });
          }
        }
      });
    }

    const candidates = Array.from(rawCandidatesMap.values());

    // 3. Rank and Diversify Candidates
    const rankedBatch = rankAndDiversifyPosts(candidates, profile, {
      limit: batchSize,
      category,
      mode,
      excludeIds: excludeSet,
    });

    // Determine next cursor from the last document of the main cursor-paginated query
    const lastMainDoc = mainSnap.docs[mainSnap.docs.length - 1];
    const nextCursor = lastMainDoc ? lastMainDoc.id : null;
    const hasMore = mainSnap.docs.length >= Math.min(batchSize, 5) && nextCursor !== null;

    // Serialize Firestore Timestamps cleanly for JSON transport while preserving millisecond accuracy
    const serializedPosts = rankedBatch.map((post) => ({
      ...post,
      timestamp: post.createdAtMs,
    }));

    // 4. Optional Rising Creators Spotlight (helps new creators without many followers get discovered)
    let risingCreators: any[] = [];
    if (includeRisingCreators) {
      const blockedSet = new Set(blockedUids);
      const mutedSet = new Set(mutedUids);
      const followingSet = new Set(followingUids);
      const creatorMap = new Map<string, any>();

      for (const c of candidates) {
        const author = c.author;
        if (
          author &&
          author.uid &&
          author.uid !== uid &&
          !blockedSet.has(author.uid) &&
          !mutedSet.has(author.uid) &&
          !followingSet.has(author.uid) &&
          !creatorMap.has(author.uid)
        ) {
          creatorMap.set(author.uid, {
            uid: author.uid,
            name: author.name || 'Creator',
            handle: author.handle || 'creator',
            avatarUrl: author.avatarUrl || '',
            isProfessional: Boolean(author.isProfessional),
            badges: author.badges || [],
            samplePostSnippet: String(c.content || '').slice(0, 70),
          });
        }
        if (creatorMap.size >= 8) break;
      }
      risingCreators = Array.from(creatorMap.values());
    }

    return NextResponse.json({
      posts: serializedPosts,
      nextCursor,
      hasMore,
      risingCreators,
    });
  } catch (error: any) {
    console.error('[Explore Feed API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate personalized explore feed', posts: [], nextCursor: null, hasMore: false },
      { status: 500 }
    );
  }
}
