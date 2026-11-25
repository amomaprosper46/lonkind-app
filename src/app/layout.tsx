
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import ConnectivityProvider from '@/components/connectivity-provider';
import { NotificationPermission } from '@/components/NotificationPermission';
import PwaInstaller from '@/components/pwa-installer';
import '@/ai/genkit';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Lonkind — Live Streams & Global Creator Community',
    template: '%s | Lonkind',
  },
  description:
    'Lonkind is the global live-streaming and creator community platform. Watch interactive live broadcasts, co-host with creators, send 3D virtual gifts, and share live clips.',
  keywords: [
    'Lonkind',
    'live streaming',
    'creator community',
    'watch live',
    'co-host live',
    'virtual gifts',
    'live clips',
    'social video platform',
  ],
  authors: [{ name: 'Prosper Amoma', url: SITE_URL }],
  creator: 'Prosper Amoma',
  publisher: 'Lonkind',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/icon-192x192.png',
  },
  openGraph: {
    title: 'Lonkind — Live Streams & Global Creator Community',
    description:
      'Watch interactive live streams, join multi-guest broadcasts, send 3D virtual gifts, and connect with creators worldwide on Lonkind.',
    url: SITE_URL,
    siteName: 'Lonkind',
    images: [
      {
        url: '/og-banner.png',
        width: 1200,
        height: 630,
        alt: 'Lonkind — Global Live Streaming & Creator Community',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@lonkind',
    creator: '@lonkind',
    title: 'Lonkind — Live Streams & Global Creator Community',
    description:
      'Watch interactive live streams, join multi-guest broadcasts, send 3D virtual gifts, and connect with creators worldwide on Lonkind.',
    images: ['/og-banner.png'],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Lonkind" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lonkind" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>

      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <FirebaseErrorListener />

          <ConnectivityProvider>
            <div className="min-h-screen flex flex-col bg-background text-foreground">
              <NotificationPermission />
              <PwaInstaller />
              {children}
            </div>
          </ConnectivityProvider>

          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}