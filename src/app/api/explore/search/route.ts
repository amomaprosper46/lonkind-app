import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { EXPLORE_TOPICS, getPostTimestampMs } from '@/lib/recommendation-engine';

/**
 * POST /api/explore/search
 *
 * Dedicated Search Backend for Lonkind (separate from Explore recommendation feed).
 * Supports searching across:
 * - People & usernames
 * - Posts & keywords
 * - Hashtags
 * - Topics
 *
 * Uses Firestore indexed queries and cursor-based pagination (never downloads the entire collection).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawQuery = String(body.query || '').trim();
    const scope: 'all' | 'people' | 'posts' | 'hashtags' | 'topics' = body.scope || 'all';
    const cursorDocId: string | null = body.cursor || null;
    const limitCount = Math.min(Math.max(Number(body.limit) || 12, 5), 25);
    const blockedUids = new Set<string>(Array.isArray(body.blockedUids) ? body.blockedUids : []);
    const mutedUids = new Set<string>(Array.isArray(body.mutedUids) ? body.mutedUids : []);

    if (!rawQuery) {
      return NextResponse.json({
        users: [],
        posts: [],
        hashtags: [],
        topics: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    const lowerQuery = rawQuery.toLowerCase();
    const cleanQuery = lowerQuery.replace(/^#/, '').replace(/^@/, '').trim();
    const searchTokens = cleanQuery
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9#]/g, ''))
      .filter((t) => t.length >= 2)
      .slice(0, 10);

    // 1. Search People & Usernames
    const searchUsersPromise = async () => {
      if (scope !== 'all' && scope !== 'people') return [];
      const usersRef = adminDb.collection('users');
      const titleCaseQuery =
        cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);

      const [handleSnap, nameLowerSnap, nameTitleSnap] = await Promise.all([
        usersRef
          .where('handle', '>=', cleanQuery)
          .where('handle', '<=', cleanQuery + '\uf8ff')
          .limit(12)
          .get()
          .catch(() => null),
        usersRef
          .where('name', '>=', rawQuery)
          .where('name', '<=', rawQuery + '\uf8ff')
          .limit(12)
          .get()
          .catch(() => null),
        titleCaseQuery !== rawQuery
          ? usersRef
              .where('name', '>=', titleCaseQuery)
              .where('name', '<=', titleCaseQuery + '\uf8ff')
              .limit(12)
              .get()
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      const usersMap = new Map<string, any>();
      const collectUser = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (blockedUids.has(docSnap.id) || usersMap.has(docSnap.id)) return;
        const d = docSnap.data();
        if (d.isGroup || d.type === 'group' || d.accountType === 'group') return;
        usersMap.set(docSnap.id, {
          uid: docSnap.id,
          name: d.name || 'User',
          handle: d.handle || 'user',
          avatarUrl: d.avatarUrl || '',
          bio: d.bio || '',
          isProfessional: Boolean(d.isProfessional),
          followersCount: Number(d.followersCount || 0),
        });
      };

      handleSnap?.docs.forEach(collectUser);
      nameLowerSnap?.docs.forEach(collectUser);
      nameTitleSnap?.docs.forEach(collectUser);

      return Array.from(usersMap.values());
    };

    // 2. Search Hashtags
    const searchHashtagsPromise = async () => {
      if (scope !== 'all' && scope !== 'hashtags') return [];
      if (!cleanQuery) return [];

      const trendingRef = adminDb.collection('trending_hashtags');
      const snap = await trendingRef
        .where('tag', '>=', cleanQuery)
        .where('tag', '<=', cleanQuery + '\uf8ff')
        .limit(15)
        .get()
        .catch(() => null);

      const results: { tag: string; count: number }[] = [];
      snap?.docs.forEach((docSnap) => {
        const d = docSnap.data();
        results.push({
          tag: `#${(d.tag || docSnap.id).replace(/^#/, '')}`,
          count: Number(d.count || 1),
        });
      });

      // Ensure exact searched hashtag is always selectable even if not yet in trending_hashtags
      const exactTag = `#${cleanQuery.split(/\s+/)[0]}`;
      if (
        exactTag.length > 2 &&
        !results.some((r) => r.tag.toLowerCase() === exactTag.toLowerCase())
      ) {
        results.unshift({ tag: exactTag, count: 0 });
      }

      return results;
    };

    // 3. Search Topics
    const searchTopicsPromise = async () => {
      if (scope !== 'all' && scope !== 'topics') return [];
      return EXPLORE_TOPICS.filter((topic) => {
        if (topic.id === 'all') return false;
        const labelMatch = topic.label.toLowerCase().includes(cleanQuery);
        const idMatch = topic.id.toLowerCase().includes(cleanQuery);
        const keywordMatch = topic.keywords.some(
          (kw) => kw.includes(cleanQuery) || cleanQuery.includes(kw)
        );
        return labelMatch || idMatch || keywordMatch;
      });
    };

    // 4. Search Posts & Keywords (with Cursor Pagination)
    const searchPostsPromise = async () => {
      if (scope !== 'all' && scope !== 'posts' && scope !== 'hashtags' && scope !== 'topics') {
        return { posts: [], nextCursor: null, hasMore: false };
      }

      const postsRef = adminDb.collection('posts');
      let effectiveTokens = [...searchTokens];

      // Add #-prefixed tokens so searchKeywords or hashtags arrays match both forms
      const withHashTokens = effectiveTokens.map((t) => `#${t.replace(/^#/, '')}`);
      const matchedTopic = EXPLORE_TOPICS.find(
        (t) =>
          t.id !== 'all' &&
          (t.id === cleanQuery || t.label.toLowerCase().includes(cleanQuery))
      );

      if (matchedTopic) {
        effectiveTokens = Array.from(
          new Set([...effectiveTokens, ...matchedTopic.keywords.slice(0, 6)])
        );
      } else {
        effectiveTokens = Array.from(new Set([...effectiveTokens, ...withHashTokens]));
      }

      effectiveTokens = effectiveTokens.slice(0, 10); // Firestore array-contains-any max 10 items

      if (effectiveTokens.length === 0) {
        return { posts: [], nextCursor: null, hasMore: false };
      }

      let postQuery = postsRef
        .where('searchKeywords', 'array-contains-any', effectiveTokens)
        .orderBy('timestamp', 'desc')
        .limit(limitCount + 5);

      if (cursorDocId) {
        const cursorSnap = await postsRef.doc(cursorDocId).get().catch(() => null);
        if (cursorSnap && cursorSnap.exists) {
          postQuery = postsRef
            .where('searchKeywords', 'array-contains-any', effectiveTokens)
            .orderBy('timestamp', 'desc')
            .startAfter(cursorSnap)
            .limit(limitCount + 5);
        }
      }

      // Also run hashtag array-contains query on first page if searching a hashtag
      const singleTag = `#${cleanQuery.split(/\s+/)[0]}`;
      const hashtagQueryPromise =
        !cursorDocId && (rawQuery.startsWith('#') || scope === 'hashtags')
          ? postsRef
              .where('hashtags', 'array-contains', singleTag)
              .orderBy('timestamp', 'desc')
              .limit(limitCount)
              .get()
              .catch(() => null)
          : Promise.resolve(null);

      const [keywordSnap, hashtagSnap] = await Promise.all([
        postQuery.get().catch(() => null),
        hashtagQueryPromise,
      ]);

      const postsMap = new Map<string, any>();
      const collectPost = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (postsMap.has(docSnap.id)) return;
        const d = docSnap.data();
        if (d.isHidden || d.moderationStatus === 'removed') return;
        if (d.groupId !== null && d.groupId !== undefined && d.groupId !== '') return;
        const authorUid = d.author?.uid || '';
        if (blockedUids.has(authorUid) || mutedUids.has(authorUid)) return;

        postsMap.set(docSnap.id, {
          id: docSnap.id,
          ...d,
          timestamp: getPostTimestampMs(d.timestamp),
        });
      };

      keywordSnap?.docs.forEach(collectPost);
      hashtagSnap?.docs.forEach(collectPost);

      const posts = Array.from(postsMap.values()).slice(0, limitCount);
      const lastDoc = keywordSnap?.docs[keywordSnap.docs.length - 1];
      const nextCursor = lastDoc ? lastDoc.id : null;
      const hasMore = Boolean(keywordSnap && keywordSnap.docs.length >= limitCount && nextCursor);

      return { posts, nextCursor, hasMore };
    };

    const [users, hashtags, topics, postResults] = await Promise.all([
      searchUsersPromise(),
      searchHashtagsPromise(),
      searchTopicsPromise(),
      searchPostsPromise(),
    ]);

    return NextResponse.json({
      users,
      posts: postResults.posts,
      hashtags,
      topics,
      nextCursor: postResults.nextCursor,
      hasMore: postResults.hasMore,
    });
  } catch (error: any) {
    console.error('[Explore Search API] Error:', error);
    return NextResponse.json(
      {
        error: 'Search request failed',
        users: [],
        posts: [],
        hashtags: [],
        topics: [],
        nextCursor: null,
        hasMore: false,
      },
      { status: 500 }
    );
  }
}
