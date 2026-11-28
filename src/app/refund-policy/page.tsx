import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Coins,
  Gift,
  Wallet,
  Megaphone,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicFooter } from '@/components/social/public-footer';

export const metadata: Metadata = {
  title: 'Virtual Coins, Gifts, Ads & Refund Policy — Lonkind Technologies',
  description:
    'Official Virtual Coins, 20% First-Time Purchase Bonus, Creator Payouts, Flutterwave Payment Security, and Ad Refund Policy for Lonkind (lonkind.com), owned and operated globally by Lonkind Technologies (CAC, Nigeria).',
  alternates: { canonical: '/refund-policy' },
  openGraph: {
    title: 'Virtual Coins, Gifts, Ads & Refund Policy — Lonkind Technologies',
    description:
      'Transparent global policy for Virtual Coins, 20% first-time bonus, creator payouts, Flutterwave PCI-DSS Level 1 security, and ad refunds on lonkind.com.',
    url: 'https://lonkind.com/refund-policy',
    siteName: 'Lonkind',
    images: [{ url: 'https://lonkind.com/og-banner.png', width: 1200, height: 630, alt: 'Lonkind Refund Policy' }],
    type: 'website',
  },
};

const POLICY_VERSION = 'v3.1';
const LAST_UPDATED = 'November 28, 2026';

export default function RefundPolicyPage() {
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
        {/* Hero */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-3 py-1"
            >
              Policy {POLICY_VERSION}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-1 rounded-full border border-border/60">
              <RefreshCw className="h-3.5 w-3.5" />
              Last Updated: {LAST_UPDATED}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Virtual Coins, Gifts, Ads &amp; Refund Policy
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            This policy governs Virtual Coin purchases, the 20% first-time purchase bonus, virtual
            gifts, creator payout withdrawals, and direct Sponsored Ad payments on{' '}
            <strong className="text-foreground">lonkind.com</strong>, owned and operated globally
            by <strong className="text-foreground">Lonkind Technologies</strong> (registered under
            the Corporate Affairs Commission — CAC, Nigeria). All financial features strictly
            require an <strong className="text-foreground">18+</strong> verified account.
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
                Aligned corporate operator disclosures under{' '}
                <strong className="text-foreground">Lonkind Technologies</strong> (CAC, Nigeria).
              </li>
              <li>
                Documented <strong className="text-foreground">Flutterwave PCI-DSS Level 1</strong>{' '}
                payment security and strict confidentiality of corporate settlement banking details.
              </li>
              <li>
                Standardized <strong className="text-foreground">5–10 business day</strong> refund
                timelines via Flutterwave and <strong className="text-foreground">18+ / verified @gmail.com</strong>{' '}
                payout eligibility rules.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Payment Processing & Security (No Commercial Bank Names Exposed) */}
        <Card className="rounded-2xl border-emerald-500/35 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              Payment Processing &amp; Security
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              <strong className="text-foreground">Authorized Payment Processor:</strong>{' '}
              <strong className="text-foreground">Flutterwave</strong> is our licensed third-party
              payment gateway handling global card payments (Visa, Mastercard, Verve), bank
              transfers, USSD, and mobile money, as well as creator payout disbursements on behalf
              of <strong className="text-foreground">Lonkind Technologies</strong>.
            </p>
            <p>
              <strong className="text-foreground">Zero Bank &amp; Card Detail Exposure:</strong>{' '}
              Lonkind Technologies never collects, views, or stores raw card numbers, CVVs, or bank
              login credentials—all payment processing is encrypted under{' '}
              <strong className="text-foreground">PCI-DSS Level 1</strong> standards via
              Flutterwave, and settlement banking details remain confidential for security.
            </p>
            <p>
              <strong className="text-foreground">Supported Currencies &amp; Settlement Rules:</strong>{' '}
              Supported currencies include{' '}
              <strong className="text-foreground">USD, NGN, GBP, EUR, GHS, KES, and ZAR</strong>.
              Creator payouts require 18+ verification, a verified{' '}
              <code className="text-xs">@gmail.com</code> account, and at least 1,000 Diamonds
              ($15 USD equivalent), settled within 24–26 hours. Approved refunds processed via
              Flutterwave settle within <strong className="text-foreground">5–10 business days</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Core Policy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                1. Virtual Coin Purchases
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                Virtual Coins are digital entertainment items delivered immediately upon payment
                confirmation. Completed Coin purchases are non-refundable except for verified
                duplicate charges, unauthorized billing, or confirmed technical non-delivery.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                2. 20% First-Time Purchase Bonus
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                Eligible first-time buyers receive a one-time +20% promotional Coin bonus. Bonus
                Coins are strictly <strong className="text-foreground">non-cashable</strong>;
                duplicate-account or <code className="text-xs">+</code>-alias bonus abuse results
                in account suspension and forfeiture.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" />
                3. Creator Earnings &amp; Payouts
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                Verified 18+ creators may withdraw genuine gift Diamonds once reaching 1,000
                Diamonds ($15 USD equivalent). Ad spend and promotional Coin refunds are strictly
                isolated from creator withdrawable payout balances.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-sky-500" />
                4. Sponsored Ads &amp; Ad Refunds
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                All user-submitted promotions require pre-publication approval by Lonkind
                Technologies. If rejected during moderation:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Coin-Paid Ads:</strong> 100% of spent Coins
                  are refunded atomically to your non-cashable promotional Coin balance.
                </li>
                <li>
                  <strong className="text-foreground">Direct Flutterwave Ad Payments:</strong>{' '}
                  Eligible card payments trigger an automated Flutterwave refund; channels
                  requiring manual settlement are refunded by our billing team—settling within{' '}
                  <strong className="text-foreground">5–10 business days</strong>.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-primary/25 bg-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-foreground">Need help with a payment or refund?</p>
                <p className="text-xs text-muted-foreground">
                  Email <strong className="text-foreground">support@lonkind.com</strong> with your
                  transaction reference or open a ticket in our Help &amp; Support Center.
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold shrink-0 hover:opacity-90 transition-opacity"
            >
              Contact Support
            </Link>
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
