import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import ProfilePageClient from './profile-page-client';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

interface ResolvedCreatorMetadata {
  found: boolean;
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  isPrivate: boolean;
}

async function resolveCreatorProfileMetadata(rawHandle: string): Promise<ResolvedCreatorMetadata> {
  const decoded = decodeURIComponent(rawHandle || '').trim();
  const cleanHandle = decoded.replace(/^@/, '');

  let found = false;
  let name = cleanHandle || 'Lonkind Creator';
  let handle = cleanHandle;
  let bio = '';
  let avatarUrl = '';
  let coverUrl = '';
  let isPrivate = false;

  try {
    if (cleanHandle) {
      let snap = await adminDb
        .collection('users')
        .where('handle', '==', cleanHandle)
        .limit(1)
        .get();

      if (snap.empty && cleanHandle !== cleanHandle.toLowerCase()) {
        snap = await adminDb
          .collection('users')
          .where('handle', '==', cleanHandle.toLowerCase())
          .limit(1)
          .get();
      }

      if (!snap.empty) {
        const u = snap.docs[0]!.data() || {};
        found = true;
        name = String(u.name || cleanHandle).trim();
        handle = String(u.handle || cleanHandle).trim();
        bio = String(u.bio || '').trim();
        avatarUrl = String(u.avatarUrl || '').trim();
        coverUrl = String(u.coverUrl || '').trim();
        isPrivate = u.followerPrivacy === 'private';
      }
    }
  } catch (err) {
    console.warn('[Profile generateMetadata] Firestore lookup fallback:', err);
  }

  return {
    found,
    name,
    handle,
    bio,
    avatarUrl,
    coverUrl,
    isPrivate,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const profile = await resolveCreatorProfileMetadata(params.handle);
  const canonicalUrl = `${SITE_URL}/profile/${encodeURIComponent(profile.handle)}`;
  const pageTitle = profile.found
    ? `${profile.name} (@${profile.handle})`
    : `@${profile.handle} on Lonkind`;
  const description = profile.bio
    ? `${profile.bio.slice(0, 155)}${profile.bio.length > 155 ? '…' : ''}`
    : `Follow ${profile.name} (@${profile.handle}) on Lonkind to watch live streams, clips, and community updates.`;

  const previewImage = profile.coverUrl || profile.avatarUrl || `${SITE_URL}/og-banner.png`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: profile.isPrivate
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: `${profile.name} (@${profile.handle}) | Lonkind`,
      description,
      url: canonicalUrl,
      siteName: 'Lonkind',
      type: 'profile',
      username: profile.handle,
      images: [
        {
          url: previewImage,
          width: 1200,
          height: 630,
          alt: `${profile.name} (@${profile.handle}) on Lonkind`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@lonkind',
      title: `${profile.name} (@${profile.handle}) | Lonkind`,
      description,
      images: [previewImage],
    },
  };
}

export default async function CreatorProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const profile = await resolveCreatorProfileMetadata(params.handle);
  const canonicalUrl = `${SITE_URL}/profile/${encodeURIComponent(profile.handle)}`;

  const jsonLd = profile.found
    ? {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: profile.name,
          alternateName: `@${profile.handle}`,
          description: profile.bio || undefined,
          image: profile.avatarUrl || profile.coverUrl || undefined,
          url: canonicalUrl,
        },
      }
    : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      <ProfilePageClient />
    </>
  );
}
