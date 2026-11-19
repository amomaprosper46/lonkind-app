import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import LiveStreamPageClient from './live-stream-page-client';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

const CATEGORY_LABELS: Record<string, string> = {
  chat: 'Just Chatting',
  music: 'Music',
  gaming: 'Gaming',
  creative: 'Q&A',
  lifestyle: 'IRL',
};

interface ResolvedStreamMetadata {
  hostUid: string;
  hostName: string;
  hostHandle: string;
  title: string;
  categoryLabel: string;
  ogImage: string;
  isLive: boolean;
}

async function resolveStreamMetadata(rawStreamId: string): Promise<ResolvedStreamMetadata> {
  const decodedId = decodeURIComponent(rawStreamId || '').trim();
  const cleanHostId = decodedId.replace(/^live_/, '');
  const canonicalRoomId = `live_${cleanHostId}`;

  let title = '';
  let category = 'chat';
  let hostUid = cleanHostId;
  let hostName = '';
  let hostHandle = '';
  let hostAvatar = '';
  let coverUrl = '';
  let isLive = true;

  try {
    // 1. Check active `streams/{roomId}` and `live_streams/{roomId}` in parallel
    const [streamSnap, liveSnap] = await Promise.all([
      adminDb.collection('streams').doc(canonicalRoomId).get(),
      adminDb.collection('live_streams').doc(canonicalRoomId).get(),
    ]);

    let data: Record<string, any> | null = null;
    if (streamSnap.exists) {
      data = streamSnap.data() || null;
    } else if (liveSnap.exists) {
      data = liveSnap.data() || null;
    } else {
      // Fallback: check exact document ID in `streams`, `live_streams`, or `scheduled_streams`
      const [altStream, altSched] = await Promise.all([
        adminDb.collection('streams').doc(decodedId).get(),
        adminDb.collection('scheduled_streams').doc(decodedId).get(),
      ]);
      if (altStream.exists) {
        data = altStream.data() || null;
      } else if (altSched.exists) {
        data = altSched.data() || null;
        isLive = data?.status === 'LIVE';
      }
    }

    if (data) {
      title = String(data.title || '').trim();
      category = String(data.category || 'chat').trim().toLowerCase();
      hostUid = String(data.hostUid || data.hostId || cleanHostId).replace(/^live_/, '');
      hostName = String(data.hostName || '').trim();
      hostHandle = String(data.hostHandle || '').trim();
      hostAvatar = String(data.hostAvatar || '').trim();
      coverUrl = String(data.coverUrl || data.thumbnailUrl || '').trim();
      if (typeof data.status === 'string') {
        const st = data.status.toLowerCase();
        isLive = st === 'active' || st === 'live';
      }
    }

    // 2. Enrich missing host handle / name / avatar from `users/{hostUid}`
    if (hostUid && (!hostHandle || !hostName || !hostAvatar)) {
      const userSnap = await adminDb.collection('users').doc(hostUid).get();
      if (userSnap.exists) {
        const u = userSnap.data() || {};
        if (!hostName && u.name) hostName = String(u.name).trim();
        if (!hostHandle && u.handle) hostHandle = String(u.handle).trim();
        if (!hostAvatar && u.avatarUrl) hostAvatar = String(u.avatarUrl).trim();
        if (!coverUrl && u.coverUrl) coverUrl = String(u.coverUrl).trim();
      }
    }
  } catch (err) {
    console.warn('[LiveStream generateMetadata] Firestore lookup fallback:', err);
  }

  const finalHostName = hostName || 'Creator';
  const finalHostHandle =
    hostHandle || finalHostName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';
  const finalTitle = title || `${finalHostName}'s Live Broadcast`;
  const categoryLabel =
    CATEGORY_LABELS[category] ||
    (category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Live');
  const ogImage = coverUrl || hostAvatar || `${SITE_URL}/og-banner.png`;

  return {
    hostUid: hostUid || cleanHostId,
    hostName: finalHostName,
    hostHandle: finalHostHandle,
    title: finalTitle,
    categoryLabel,
    ogImage,
    isLive,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { streamId: string };
}): Promise<Metadata> {
  const meta = await resolveStreamMetadata(params.streamId);
  const pageTitle = meta.isLive
    ? `🔴 LIVE: ${meta.title} — @${meta.hostHandle} on Lonkind`
    : `${meta.title} — @${meta.hostHandle} on Lonkind`;
  const description = `${meta.categoryLabel} • Watch live and join the chat on Lonkind.`;
  const canonicalUrl = `${SITE_URL}/live/${encodeURIComponent(meta.hostUid)}`;

  return {
    title: {
      absolute: pageTitle,
    },
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      siteName: 'Lonkind',
      type: 'video.other',
      images: [
        {
          url: meta.ogImage,
          width: 1200,
          height: 630,
          alt: `${meta.title} — @${meta.hostHandle} Live on Lonkind`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@lonkind',
      title: pageTitle,
      description,
      images: [meta.ogImage],
    },
  };
}

export default async function LiveStreamSharePage({
  params,
}: {
  params: { streamId: string };
}) {
  const meta = await resolveStreamMetadata(params.streamId);
  const canonicalUrl = `${SITE_URL}/live/${encodeURIComponent(meta.hostUid)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: meta.title,
    description: `${meta.categoryLabel} • Watch live and join the chat on Lonkind.`,
    thumbnailUrl: [meta.ogImage],
    uploadDate: new Date().toISOString(),
    contentUrl: canonicalUrl,
    embedUrl: canonicalUrl,
    author: {
      '@type': 'Person',
      name: meta.hostName,
      url: `${SITE_URL}/profile/${encodeURIComponent(meta.hostHandle)}`,
    },
    publication: {
      '@type': 'BroadcastEvent',
      isLiveBroadcast: meta.isLive,
      name: meta.title,
    },
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <LiveStreamPageClient hostUid={meta.hostUid} />
    </>
  );
}
