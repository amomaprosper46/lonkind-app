import type { Metadata } from 'next';
import SocialHomePage from '@/components/social/social-home-page';
import { adminDb } from '@/lib/firebase-admin';

type HomePageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';
  const liveParam = typeof searchParams?.live === 'string' ? searchParams.live : (typeof searchParams?.host === 'string' ? searchParams.host : undefined);
  const postParam = typeof searchParams?.post === 'string' ? searchParams.post : undefined;

  try {
    if (liveParam && adminDb) {
      const cleanHostUid = liveParam.replace(/^live_/, '');
      const roomId = `live_${cleanHostUid}`;

      const [streamSnap, userSnap] = await Promise.all([
        adminDb.collection('live_streams').doc(roomId).get(),
        adminDb.collection('users').doc(cleanHostUid).get(),
      ]);

      const streamData = streamSnap.exists ? streamSnap.data() : null;
      const userData = userSnap.exists ? userSnap.data() : null;

      const hostName = streamData?.hostName || userData?.name || 'Lonkind Creator';
      const hostHandle = userData?.handle ? `@${userData.handle}` : '';
      const streamTitle = streamData?.streamTitle || `${hostName}'s Live Broadcast`;
      const previewImage = streamData?.hostAvatar || userData?.avatarUrl || `${siteUrl}/logo.png`;

      const title = `🔴 ${hostName} ${hostHandle ? `(${hostHandle}) ` : ''}is LIVE on Lonkind!`;
      const description = `"${streamTitle}" — Tap to watch live and join the chat on Lonkind!`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `${siteUrl}/?live=${cleanHostUid}`,
          siteName: 'Lonkind Live',
          images: [{ url: previewImage, width: 800, height: 800, alt: title }],
          type: 'video.other',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [previewImage],
        },
      };
    }

    if (postParam && adminDb) {
      const postSnap = await adminDb.collection('posts').doc(postParam).get();
      if (postSnap.exists) {
        const postData = postSnap.data();
        const authorName = postData?.author?.name || 'Lonkind Creator';
        const authorHandle = postData?.author?.handle ? `@${postData.author.handle}` : '';
        const contentSnippet = (postData?.content || 'Check out this post on Lonkind!').slice(0, 160);
        const previewImage = postData?.imageUrl || postData?.author?.avatarUrl || `${siteUrl}/logo.png`;

        const title = `${authorName} ${authorHandle} on Lonkind`;
        return {
          title,
          description: contentSnippet,
          openGraph: {
            title,
            description: contentSnippet,
            url: `${siteUrl}/?post=${postParam}`,
            siteName: 'Lonkind',
            images: [{ url: previewImage, width: 1200, height: 630, alt: title }],
            type: 'article',
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description: contentSnippet,
            images: [previewImage],
          },
        };
      }
    }
  } catch (err) {
    console.warn('generateMetadata fallback notice:', err);
  }

  return {
    title: 'Lonkind — Live Streams & Global Creator Community',
    description: 'Watch live broadcasts, join PK battles, support creators, and connect with friends worldwide on Lonkind.',
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: 'Lonkind — Live Streams & Global Creator Community',
      description: 'Watch live broadcasts, join PK battles, support creators, and connect with friends worldwide on Lonkind.',
      url: siteUrl,
      siteName: 'Lonkind',
      images: [{ url: `${siteUrl}/og-banner.png`, width: 1200, height: 630, alt: 'Lonkind — Live Streams & Creator Platform' }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lonkind — Live Streams & Global Creator Community',
      description: 'Watch live broadcasts, join PK battles, support creators, and connect with friends worldwide on Lonkind.',
      images: [`${siteUrl}/og-banner.png`],
    },
  };
}

export default function HomePage() {
  return <SocialHomePage />;
}
