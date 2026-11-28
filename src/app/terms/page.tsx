import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Scale,
  ArrowLeft,
  RefreshCw,
  UserCheck,
  Coins,
  Megaphone,
  ShieldCheck,
  Gavel,
  Sparkles,
  Mail,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicFooter } from '@/components/social/public-footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Lonkind Technologies',
  description:
    'Official Terms of Service for Lonkind (lonkind.com), owned and operated globally by Lonkind Technologies (CAC, Nigeria): 18+ eligibility, Real-Name & @gmail.com rules, Virtual Coins & 20% bonus, Sponsored Ads, Flutterwave payment security, and Google Firebase infrastructure.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service — Lonkind Technologies',
    description:
      'Official Terms of Service for Lonkind (lonkind.com), owned and operated globally by Lonkind Technologies.',
    url: 'https://lonkind.com/terms',
    siteName: 'Lonkind',
    images: [{ url: 'https://lonkind.com/og-banner.png', width: 1200, height: 630, alt: 'Lonkind Terms of Service' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — Lonkind Technologies',
    description: 'Official global Terms of Service for Lonkind (lonkind.com).',
    images: ['https://lonkind.com/og-banner.png'],
  },
};

const POLICY_VERSION = 'v3.1';
const LAST_UPDATED = 'November 28, 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-md">
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
        {/* Hero */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary font-semibold px-3 py-1"
            >
              <Scale className="h-3.5 w-3.5 mr-1.5" />
              Policy {POLICY_VERSION}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-1 rounded-full border border-border/60">
              <RefreshCw className="h-3.5 w-3.5" />
              Last Updated: {LAST_UPDATED}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Terms of Service</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            <strong className="text-foreground">Lonkind</strong> (
            <strong className="text-foreground">lonkind.com</strong>) is a global live-streaming
            and creator community platform owned and operated worldwide by{' '}
            <strong className="text-foreground">Lonkind Technologies</strong>, a company duly
            registered under the{' '}
            <strong className="text-foreground">Corporate Affairs Commission (CAC) of Nigeria</strong>.
            By creating an account, watching live broadcasts, purchasing Virtual Coins, running
            Sponsored Ads, or requesting creator payouts, you agree to these Terms of Service.
          </p>
        </section>

        {/* Policy Version & Recent Updates */}
        <Card className="rounded-2xl border-primary/25 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              Policy Version &amp; Recent Updates ({POLICY_VERSION} — {LAST_UPDATED})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Updated official operator identity to{' '}
                <strong className="text-foreground">Lonkind Technologies</strong> (registered with
                the Corporate Affairs Commission — CAC, Nigeria) operating globally at lonkind.com.
              </li>
              <li>
                Enforced <strong className="text-foreground">Strict 18+ Age Verification</strong>{' '}
                (verified DOB required) across signup, coin purchases, gifting, ads, and payouts.
              </li>
              <li>
                Codified <strong className="text-foreground">Real-Name &amp; Verified @gmail.com</strong>{' '}
                rules prohibiting disposable emails, <code className="text-xs">+</code> alias
                farming, and fake identities.
              </li>
              <li>
                Documented <strong className="text-foreground">Sponsored Ads &amp; Moderation</strong>{' '}
                (official <code className="text-xs">@lonkind</code> brand ads, creator self-serve
                promotions, 18+/21+ targeting, Anti-Ad Fraud viewability, and mandatory pre-publication review).
              </li>
              <li>
                Clarified <strong className="text-foreground">Payment Processing &amp; Security</strong>{' '}
                via Flutterwave (PCI-DSS Level 1, confidential settlement banking) and Google Firebase
                cloud security.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 1: 18+ Eligibility & Real-Name / @gmail.com Rules */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-500" />
              1. Strict 18+ Age Requirement, Real-Name &amp; Verified @gmail.com Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              <strong className="text-foreground">Strict 18+ Age Requirement:</strong> You must be
              at least 18 years old with a verified Date of Birth to create an account, purchase
              Virtual Coins, send or receive virtual gifts, run Sponsored Ads, or withdraw creator
              earnings on Lonkind. Underage accounts are blocked or terminated immediately.
            </p>
            <p>
              <strong className="text-foreground">Real-Name &amp; Verified @gmail.com Accounts:</strong>{' '}
              Registration requires a valid Google Gmail (
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">@gmail.com</code>) address
              and realistic first and last names. Temporary/disposable email domains,{' '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">+</code> alias farming
              (e.g., creating multiple accounts with <code className="text-xs">name+1@gmail.com</code>),
              and fake identities or impersonation are strictly prohibited.
            </p>
          </CardContent>
        </Card>

        {/* Section 2: Virtual Coins & 20% Bonus */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              2. Virtual Coins, 20% First-Time Purchase Bonus &amp; Creator Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              <strong className="text-foreground">Digital Entertainment Items:</strong> Virtual
              Coins are digital entertainment items used inside Lonkind for sending virtual gifts
              to creators and paying for content promotions. Coins carry no cash value outside
              Lonkind and cannot be cashed out by buyers.
            </p>
            <p>
              <strong className="text-foreground">20% First-Time Purchase Bonus:</strong> Eligible
              first-time buyers receive a one-time +20% promotional Coin bonus. Promotional bonus
              Coins are strictly <strong className="text-foreground">non-cashable</strong>. Bonus
              abuse via duplicate accounts, <code className="text-xs">+</code> alias farming, or
              gift-cycling results in immediate forfeiture and account suspension.
            </p>
            <p>
              See our{' '}
              <Link href="/refund-policy" className="text-primary underline font-semibold">
                Virtual Coins, Gifts, Ads &amp; Refund Policy
              </Link>{' '}
              for full creator payout and refund rules.
            </p>
          </CardContent>
        </Card>

        {/* Section 3: Sponsored Ads & Moderation */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-sky-500" />
              3. Sponsored Ads, Anti-Ad Fraud &amp; Mandatory Moderation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Lonkind features official brand campaigns published by{' '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">@lonkind</code> alongside
              creator self-serve promotions paid via Coins or direct Flutterwave checkout.
            </p>
            <p>
              Every user-submitted promotion undergoes mandatory pre-publication moderation by{' '}
              <strong className="text-foreground">Lonkind Technologies</strong>. Ads must comply
              with our <strong className="text-foreground">18+ / 21+</strong> age-targeting rules,
              use safe <code className="text-xs">https://</code> destination links, and never
              promote scams, adult content, misleading financial promises, or unverified medical
              claims.
            </p>
            <p>
              All ad delivery is protected by our <strong className="text-foreground">Anti-Ad Fraud Viewability Guard</strong>{' '}
              (requiring ≥50% viewport visibility for 1.5 continuous seconds in a foreground tab,
              1-hour per-viewer deduplication, and automated bot/self-view exclusion).
            </p>
          </CardContent>
        </Card>

        {/* Section 4: Payment Processing & Security (No Commercial Bank Names Exposed) */}
        <Card className="rounded-2xl border-emerald-500/35 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              4. Payment Processing &amp; Security
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              <strong className="text-foreground">Authorized Payment Processor:</strong>{' '}
              <strong className="text-foreground">Flutterwave</strong> serves as our licensed
              third-party payment gateway handling global card payments (Visa, Mastercard, Verve),
              bank transfers, USSD, and mobile money, as well as creator payout disbursements on
              behalf of <strong className="text-foreground">Lonkind Technologies</strong>.
            </p>
            <p>
              <strong className="text-foreground">Zero Bank &amp; Card Detail Exposure:</strong>{' '}
              Lonkind Technologies never collects, views, or stores raw credit/debit card numbers,
              CVVs, or bank login credentials. All payment processing is encrypted under{' '}
              <strong className="text-foreground">PCI-DSS Level 1</strong> standards via
              Flutterwave, and corporate settlement banking details remain strictly confidential
              for security.
            </p>
            <p>
              <strong className="text-foreground">Supported Currencies &amp; Settlement Rules:</strong>{' '}
              We support <strong className="text-foreground">USD, NGN, GBP, EUR, GHS, KES, and ZAR</strong>.
              Creator payouts require 18+ verification, verified Gmail, and a minimum balance of
              1,000 Diamonds ($15 USD equivalent), settled within 24–26 hours. Standard refunds
              processed via Flutterwave settle within{' '}
              <strong className="text-foreground">5–10 business days</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Section 5: Data Security & Infrastructure */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-violet-500" />
              5. Data Security, Infrastructure &amp; Intellectual Property
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Lonkind Technologies uses <strong className="text-foreground">Google Firebase</strong>{' '}
              (Authentication, Cloud Firestore, Cloud Storage, App Check, and encrypted daily
              backups) alongside rate limiting, double-entry transaction ledgers, and immutable
              security audit logs to safeguard user accounts and balances globally.
            </p>
            <p>
              You retain ownership of original content you publish on Lonkind and grant Lonkind
              Technologies a non-exclusive, worldwide, royalty-free license to host, stream, and
              display your content to operate the service. Copyright infringement, harassment,
              illegal content, or API exploitation will result in account termination.
            </p>
          </CardContent>
        </Card>

        {/* Section 6: Dispute Resolution & Contact */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              6. Dispute Resolution &amp; Corporate Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Before initiating any formal claim, you agree to contact Lonkind Technologies so we
              can work to resolve your concern within 30 days. Mandatory consumer protection laws
              in your jurisdiction remain unaffected.
            </p>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-1 text-xs sm:text-sm">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-primary" />
                Lonkind Technologies (Registered with CAC, Nigeria)
              </p>
              <p>Founder &amp; Lead Developer: <strong className="text-foreground">Prosper Amoma</strong></p>
              <p>
                Legal:{' '}
                <a href="mailto:legal@lonkind.com" className="text-primary underline font-semibold">
                  legal@lonkind.com
                </a>{' '}
                • Support:{' '}
                <a href="mailto:support@lonkind.com" className="text-primary underline font-semibold">
                  support@lonkind.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
