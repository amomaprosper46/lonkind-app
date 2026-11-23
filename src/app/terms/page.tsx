import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Scale,
  Calendar,
  Radio,
  Wallet,
  ShieldAlert,
  UserCheck,
  Mail,
  Gavel,
  ArrowLeft,
  Clock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service — Lonkind',
  description:
    'Read the Lonkind Terms of Service governing accounts, live streaming, Virtual Coins, Creator Diamonds, anti-gift-cycling rules, and 24-hour payout processing on lonkind.com.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service — Lonkind',
    description:
      'Read the official Lonkind Terms of Service covering Virtual Coins, Creator Diamonds, anti-gift-cycling rules, and 24-hour payout processing on lonkind.com.',
    url: 'https://lonkind.com/terms',
    siteName: 'Lonkind',
    images: [
      {
        url: 'https://lonkind.com/og-banner.png',
        width: 1200,
        height: 630,
        alt: 'Lonkind Terms of Service',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — Lonkind',
    description:
      'Official Terms of Service for creators and viewers on Lonkind (lonkind.com).',
    images: ['https://lonkind.com/og-banner.png'],
  },
};

const LAST_UPDATED = 'November 22, 2026';

export default function TermsPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-md">
        <div className="container max-w-4xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Lonkind Logo" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-extrabold tracking-tight">Lonkind</span>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back to Lonkind
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Legal Article */}
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-10 space-y-6">
        {/* Header Banner */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 p-6 sm:p-8 shadow-md space-y-3 text-white">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/40 text-[11px] font-bold gap-1">
              <Gavel className="h-3.5 w-3.5" /> Official Platform Agreement
            </Badge>
            <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold gap-1">
              <Calendar className="h-3 w-3" /> Last Updated: {LAST_UPDATED}
            </Badge>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-white">
            <Scale className="h-6 w-6 text-amber-400 shrink-0" />
            Lonkind Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Welcome to <strong className="text-white">Lonkind</strong> (
            <strong className="text-white">lonkind.com</strong>). By creating an account, watching or
            hosting a live stream, messaging other members, or purchasing Virtual Coins, you agree to
            these Terms of Service and our{' '}
            <Link href="/privacy" className="text-emerald-300 hover:underline font-semibold">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Structured Terms Content */}
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-8 text-sm text-muted-foreground leading-relaxed">
            {/* 1. Eligibility & Account */}
            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-500" />
                1. Eligibility &amp; Account Responsibility
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  You must be at least 13 years old (or the minimum legal age in your region) to use
                  Lonkind, and at least <strong className="text-foreground">18 years old</strong> to
                  host monetized live streams, purchase Virtual Coins, or withdraw Creator Diamonds.
                </li>
                <li>
                  New accounts must register using a valid real full name and a verified primary
                  Google Gmail (<code>@gmail.com</code>) address or verified phone number. Email
                  verification is required before unlocking coin purchases, live streaming, or creator
                  payouts.
                </li>
                <li>
                  You are responsible for safeguarding your login credentials and keeping your
                  Two-Factor Authentication (2FA) and email up to date. Impersonating another person,
                  brand, or official Lonkind staff member is strictly prohibited.
                </li>
              </ul>
            </section>

            {/* 2. Live Stream Content Guidelines */}
            <section className="space-y-3 pt-6 border-t border-border/60">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Radio className="h-4 w-4 text-rose-500" />
                2. Live Stream Content Guidelines &amp; Community Safety
              </h2>
              <p>
                Lonkind is an independent Nigerian creator and live-streaming platform built to
                celebrate creativity, kindness, and authentic global connection. While broadcasting
                live, posting content, or chatting, you agree{' '}
                <strong className="text-foreground">NOT</strong> to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Stream or share sexually explicit material, nudity, graphic violence, self-harm
                  promotion, or illegal activity.
                </li>
                <li>
                  Engage in hate speech, bullying, doxxing, harassment, or targeted abuse against any
                  individual or group.
                </li>
                <li>
                  Broadcast copyrighted movies, television, music, or sports events without holding
                  proper rights or licenses.
                </li>
                <li>
                  Run deceptive giveaways, financial scams, phishing links, or automated spam bots.
                </li>
              </ul>
              <p>
                Our moderation team and creator-appointed live moderators reserve the right to remove
                offending messages, terminate live broadcasts immediately, and suspend or permanently
                ban accounts that violate these guidelines.
              </p>
            </section>

            {/* 3. Wallet, Virtual Coins, Creator Diamonds, Anti-Gift-Cycling & 24h Payouts */}
            <section className="space-y-3 pt-6 border-t border-border/60">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-500" />
                3. Creator Wallet, Virtual Coins, Creator Diamonds &amp; Payout Terms
              </h2>
              <ul className="list-disc pl-5 space-y-2.5">
                <li>
                  <strong className="text-foreground">Virtual Coins:</strong> Lonkind Virtual Coins
                  are digital virtual items used exclusively inside Lonkind to send animated 3D
                  virtual gifts and support creators. Virtual Coins have no cash value outside
                  Lonkind, are non-transferable between users outside official gifting features, and
                  are non-refundable except where required by applicable law. Promotional bonuses
                  (such as the 20% First-Time Coin Purchase Bonus) apply strictly once per unique
                  verified user and are tracked separately in our ledger.
                </li>
                <li>
                  <strong className="text-foreground">Creator Diamonds:</strong> Eligible creators
                  earn Creator Diamonds when viewers send virtual gifts during live streams or on
                  profiles. Creator Diamonds may be redeemed for local-currency payouts subject to
                  minimum withdrawal thresholds, tiered daily limits, identity/compliance review,
                  anti-fraud double-entry ledger verification, and applicable platform &amp; payment
                  processor fees.
                </li>
                <li>
                  <strong className="text-foreground">
                    24-Hour Payout Processing Terms:
                  </strong>{' '}
                  Verified creator payout requests are processed within{' '}
                  <strong className="text-foreground">24 hours</strong> of submission (subject to
                  bank/mobile-money settlement windows and automated anti-fraud screening). Payouts
                  exceeding high-value manual review thresholds or flagged for unusual velocity may
                  be temporarily held for compliance verification to protect creators and the
                  platform.
                </li>
                <li>
                  <strong className="text-foreground">
                    Strict Anti-Gift-Cycling &amp; Fraud Rules:
                  </strong>{' '}
                  Creating duplicate accounts (including Gmail dot/alias variants) to farm first-time
                  bonuses, coordinating artificial <strong className="text-foreground">gift-cycling</strong>{' '}
                  (sending gifts back and forth between affiliated accounts to inflate earnings,
                  launder funds, or trigger promotional rewards), or filing unauthorized chargebacks
                  is strictly prohibited and will result in immediate forfeiture of disputed balances
                  and permanent account termination.
                </li>
              </ul>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-foreground flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Payout Transparency:</strong> All Virtual Coin purchases and Creator
                  Diamond withdrawals are recorded on an immutable server-side double-entry ledger
                  and processed through regulated payment partners (Paystack &amp; Flutterwave).
                </span>
              </div>
            </section>

            {/* 4. User Content & Intellectual Property */}
            <section className="space-y-3 pt-6 border-t border-border/60">
              <h2 className="text-lg font-extrabold text-foreground">
                4. User Content &amp; Intellectual Property
              </h2>
              <p>
                You retain ownership of the original posts, videos, clips, and live streams you
                publish on Lonkind. By posting content on Lonkind, you grant us a worldwide,
                non-exclusive, royalty-free license to host, store, transcode, display, and distribute
                that content solely to operate and improve the Lonkind platform. The Lonkind name,
                logo, custom 3D virtual gift animations, and software code remain the exclusive
                property of Lonkind.
              </p>
            </section>

            {/* 5. Account Termination & Disclaimers */}
            <section className="space-y-3 pt-6 border-t border-border/60">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                5. Account Termination, Disclaimers &amp; Liability
              </h2>
              <p>
                You may delete your account at any time from{' '}
                <Link href="/settings" className="text-primary hover:underline font-semibold">
                  Settings → Account &amp; Profile
                </Link>
                . Lonkind is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis.
                To the fullest extent permitted by law, Lonkind is not liable for indirect,
                incidental, or consequential damages arising from user-generated content, third-party
                outages, or unauthorized account access caused by compromised passwords.
              </p>
            </section>

            {/* 6. Contact Information */}
            <section className="space-y-3 pt-6 border-t border-border/60">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-500" />
                6. Legal &amp; Support Contact
              </h2>
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5 text-xs sm:text-sm">
                <p>
                  <strong className="text-foreground">Platform:</strong> Lonkind (https://lonkind.com)
                </p>
                <p>
                  <strong className="text-foreground">Founder &amp; Lead Developer:</strong> Prosper Amoma
                </p>
                <p>
                  <strong className="text-foreground">Legal Notices:</strong>{' '}
                  <a href="mailto:legal@lonkind.com" className="text-primary hover:underline font-semibold">
                    legal@lonkind.com
                  </a>
                </p>
                <p>
                  <strong className="text-foreground">Official Support:</strong>{' '}
                  <a href="mailto:support@lonkind.com" className="text-primary hover:underline font-semibold">
                    support@lonkind.com
                  </a>
                </p>
                <p>
                  <strong className="text-foreground">Privacy Inquiries:</strong>{' '}
                  <a href="mailto:privacy@lonkind.com" className="text-primary hover:underline font-semibold">
                    privacy@lonkind.com
                  </a>
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t bg-background">
        <div className="container flex flex-wrap justify-center items-center text-muted-foreground gap-x-6 gap-y-2 text-sm font-medium">
          <p>&copy; {currentYear} Lonkind. All rights reserved.</p>
          <span className="hidden sm:inline">•</span>
          <Link href="/about" className="hover:text-primary hover:underline">
            About
          </Link>
          <span className="hidden sm:inline">•</span>
          <Link href="/privacy" className="hover:text-primary hover:underline">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">•</span>
          <Link href="/terms" className="text-foreground font-semibold">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
