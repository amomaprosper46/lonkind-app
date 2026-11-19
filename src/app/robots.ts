import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/explore',
          '/profile/',
          '/live/',
          '/settings/privacy-policy',
          '/settings/terms',
          '/settings/support',
          '/privacy',
          '/privacy-policy',
          '/terms',
          '/rules',
        ],
        disallow: [
          '/settings/wallet',
          '/settings/saved',
          '/settings/privacy',
          '/settings/privacy/followers',
          '/messages',
          '/friend-requests',
          '/dev/',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
