import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PublicFooter } from '@/components/social/public-footer';
import { PublicContactClient } from '@/components/social/public-contact-client';

export const metadata: Metadata = {
  title: 'Help & Support Center — Lonkind',
  description:
    'Contact Lonkind global support (support@lonkind.com), browse FAQs on Gmail verification, Virtual Coins, Creator Payouts, and Sponsored Ads, or submit a ticket.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Help & Support Center — Lonkind',
    description:
      'Global Help & Support Center for Lonkind creators and viewers worldwide.',
    url: 'https://lonkind.com/contact',
    siteName: 'Lonkind',
    images: [{ url: 'https://lonkind.com/og-banner.png', width: 1200, height: 630, alt: 'Lonkind Help & Support' }],
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight">
            <Image src="/logo.png" alt="Lonkind" width={32} height={32} className="rounded-lg" />
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

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <section className="space-y-3">
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/10 text-primary font-semibold px-3 py-1"
          >
            <LifeBuoy className="h-3.5 w-3.5 mr-1.5" />
            Global Help &amp; Support Center
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            How can we help you?
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Whether you’re a viewer, creator, or advertiser anywhere in the world, our team is here
            to help with account verification, Virtual Coins, creator payouts, and sponsored ads.
          </p>
        </section>

        <PublicContactClient />
      </main>

      <PublicFooter />
    </div>
  );
}
