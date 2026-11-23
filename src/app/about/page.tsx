import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Radio,
  ShieldCheck,
  Coins,
  Mail,
  Lock,
  Globe,
  ArrowLeft,
  FileText,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'About Lonkind — Independent Nigerian Creator & Live-Streaming Platform',
  description:
    'Learn about Lonkind (lonkind.com), an independent Nigerian creator and live-streaming platform for real-time broadcasts, community connection, and transparent creator monetization.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About Lonkind — Independent Nigerian Creator & Live-Streaming Platform',
    description:
      'Lonkind is an independent Nigerian creator and live-streaming platform built for real-time broadcasts, authentic communities, and fair creator payouts.',
    url: 'https://lonkind.com/about',
    siteName: 'Lonkind',
    images: [{ url: 'https://lonkind.com/og-banner.png', width: 1200, height: 630, alt: 'About Lonkind' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Lonkind — Independent Nigerian Creator & Live-Streaming Platform',
    description:
      'Learn about Lonkind (lonkind.com), an independent Nigerian creator and live-streaming platform.',
    images: ['https://lonkind.com/og-banner.png'],
  },
};

export default function AboutPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight">
            <Image
              src="/logo.png"
              alt="Lonkind"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span>Lonkind</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lonkind
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-10">
        {/* Hero */}
        <section className="space-y-4">
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-1"
          >
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            Independent Nigerian Creator &amp; Live-Streaming Platform
          </Badge>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            About Lonkind
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-3xl">
            <strong className="text-foreground">Lonkind</strong> (
            <span className="font-semibold text-foreground">lonkind.com</span>) is an independent
            Nigerian creator and live-streaming social platform built to help creators, entertainers,
            educators, and everyday communities connect in real time. From interactive live video and
            audio broadcasts to multi-guest co-hosting, encrypted messaging, and transparent creator
            monetization, Lonkind puts authentic human connection and creator ownership first.
          </p>
        </section>

        {/* Core Platform Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center mb-2">
                <Radio className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold">Live Streaming &amp; Co-Hosting</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              Broadcast live to followers, invite co-hosts on stage, schedule upcoming streams, and
              capture instant 30-second live highlight clips.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-2">
                <Coins className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold">Fair Creator Monetization</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              Viewers support creators through interactive virtual gifts and tips, with secure
              server-verified wallets and multi-currency payouts via regulated payment partners.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold">Trust, Safety &amp; Privacy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              Built with real-name signup verification, creator-appointed live chat moderators,
              custom blocked word filters, private follower controls, and layered app permissions.
            </CardContent>
          </Card>
        </section>

        {/* Official Contact & Transparency Card */}
        <section>
          <Card className="rounded-2xl border-border/70 bg-muted/20">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                Official Contact &amp; Platform Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                Lonkind is independently founded and developed by{' '}
                <strong className="text-foreground">
                  Prosper Amoma (Founder &amp; Lead Developer of Lonkind)
                </strong>{' '}
                out of Nigeria for creators and viewers worldwide. For user assistance, creator
                payout inquiries, trust &amp; safety reports, or privacy and data-protection
                requests, please reach our official team directly:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href="mailto:support@lonkind.com"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border/70 bg-background hover:border-primary/50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">Official Support</p>
                    <p className="font-bold text-foreground truncate">support@lonkind.com</p>
                  </div>
                </a>

                <a
                  href="mailto:privacy@lonkind.com"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border/70 bg-background hover:border-emerald-500/50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Privacy &amp; Data Protection
                    </p>
                    <p className="font-bold text-foreground truncate">privacy@lonkind.com</p>
                  </div>
                </a>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50 text-xs font-semibold">
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Terms of Service
                </Link>
                <Link
                  href="/rules"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Community Guidelines
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t bg-background">
        <div className="container flex flex-wrap justify-center items-center text-muted-foreground gap-x-6 gap-y-2 text-sm font-medium">
          <p>&copy; {currentYear} Lonkind. All rights reserved.</p>
          <span className="hidden sm:inline">•</span>
          <Link href="/about" className="text-foreground font-semibold">
            About
          </Link>
          <span className="hidden sm:inline">•</span>
          <Link href="/privacy" className="hover:text-primary hover:underline">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">•</span>
          <Link href="/terms" className="hover:text-primary hover:underline">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
