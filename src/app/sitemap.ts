import type { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

function toSafeDate(ts: any, fallback: Date): Date {
  if (!ts) return fallback;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000);
  }
  return fallback;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Static public pages
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/settings/support`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/settings/privacy-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/settings/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/rules`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const dynamicStreamEntries: MetadataRoute.Sitemap = [];
  const dynamicProfileEntries: MetadataRoute.Sitemap = [];

  try {
    // 2. Active Live Streams (`streams` & `live_streams`)
    const [streamsSnap, liveStreamsSnap] = await Promise.all([
      adminDb.collection('streams').where('status', '==', 'active').limit(100).get(),
      adminDb.collection('live_streams').where('status', '==', 'active').limit(100).get(),
    ]);

    const seenStreamIds = new Set<string>();
    const combinedStreams = [...streamsSnap.docs, ...liveStreamsSnap.docs];

    for (const docSnap of combinedStreams) {
      const data = docSnap.data() || {};
      const rawId = String(data.hostUid || docSnap.id || '').trim();
      const cleanHostId = rawId.replace(/^live_/, '');
      if (!cleanHostId || seenStreamIds.has(cleanHostId)) continue;

      // Exclude private/followers-only streams from public search index
      if (data.visibility === 'followers') continue;

      seenStreamIds.add(cleanHostId);
      dynamicStreamEntries.push({
        url: `${SITE_URL}/live/${encodeURIComponent(cleanHostId)}`,
        lastModified: toSafeDate(data.updatedAt || data.startedAt, now),
        changeFrequency: 'always',
        priority: 0.9,
      });
    }

    // 3. Public Creator Profiles (`users`)
    const usersSnap = await adminDb.collection('users').limit(500).get();
    const seenHandles = new Set<string>();

    for (const userDoc of usersSnap.docs) {
      const u = userDoc.data() || {};
      const handle = String(u.handle || '').trim();
      if (!handle) continue;
      if (u.followerPrivacy === 'private') continue;
      if (u.isGroup || u.type === 'group' || u.accountType === 'group') continue;

      const lowerHandle = handle.toLowerCase();
      if (seenHandles.has(lowerHandle)) continue;
      seenHandles.add(lowerHandle);

      dynamicProfileEntries.push({
        url: `${SITE_URL}/profile/${encodeURIComponent(handle)}`,
        lastModified: toSafeDate(u.updatedAt || u.createdAt, now),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (err) {
    // Gracefully fall back to static entries if Firestore is unreachable during offline build
    console.warn('[sitemap] Dynamic Firestore query fallback:', err);
  }

  return [...staticEntries, ...dynamicStreamEntries, ...dynamicProfileEntries];
}
