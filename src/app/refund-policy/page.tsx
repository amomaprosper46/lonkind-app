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
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicFooter } from '@/components/social/public-footer';

export const metadata: Metadata = {
  title: 'Virtual Coins, Gifts & Refund Policy — Lonkind',
  description:
    'Read Lonkind’s global Virtual Coins, 20% First-Time Buyer Bonus, Creator Payouts, and Direct Ad Payment & Refund Policy.',
  alternates: { canonical: '/refund-policy' },
  openGraph: {
    title: 'Virtual Coins, Gifts & Refund Policy — Lonkind',
    description:
      'Transparent global policy for Virtual Coins, 20% first-time buyer bonus, creator Diamond withdrawals, and ad refunds on lonkind.com.',
    url: 'https://lonkind.com/refund-policy',
    siteName: 'Lonkind',
    images: [{ url: 'https://lonkind.com/og-banner.png', width: 1200, height: 630, alt: 'Lonkind Refund Policy' }],
    type: 'website',
  },
};

export default function RefundPolicyPage() {
  const lastUpdated = 'November 24, 2026';

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
        <section className="space-y-4">
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-3 py-1"
          >
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            Global Digital Commerce Policy
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Virtual Coins, Gifts &amp; Refund Policy
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            This policy governs Virtual Coin purchases, promotional bonuses, virtual gift exchanges,
            creator earnings withdrawals, and direct ad payments across{' '}
            <strong className="text-foreground">lonkind.com</strong> worldwide. Lonkind is operated
            globally by its founder based in Nigeria and supports international multi-currency
            payments via Flutterwave and Paystack.
          </p>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/40 px-3.5 py-1.5 rounded-full border border-border/60">
            <RefreshCw className="h-3.5 w-3.5" />
            Last Updated: {lastUpdated}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                1. Global Virtual Coin Purchases
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Virtual Coins are digital credits used inside Lonkind to send interactive gifts to
                creators or boost eligible posts and live streams. Users worldwide may purchase
                Coins in <strong className="text-foreground">USD</strong> or supported local
                currencies (<strong className="text-foreground">NGN, GBP, EUR, GHS, KES, ZAR</strong>)
                using Cards, Bank Transfer, USSD, or Mobile Money.
              </p>
              <p>
                Because Virtual Coins are delivered instantaneously to your wallet upon verified
                payment settlement, completed Coin purchases are generally non-refundable except in
                cases of verified duplicate billing, unauthorized transactions, or technical
                delivery failure.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                2. 20% First-Time Buyer Promotional Bonus
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Eligible first-time Coin buyers automatically receive a one-time{' '}
                <strong className="text-foreground">+20% promotional Coin bonus</strong> credited
                atomically alongside their first settled Coin purchase.
              </p>
              <p>
                Promotional bonus Coins are non-cashable, cannot be withdrawn directly as fiat
                currency, and are limited to one bonus per verified account.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" />
                3. Creator Earnings &amp; Withdrawals
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Eligible adult creators (18+ with verified email) earn Creator Diamonds from
                genuine audience gifts and may withdraw once reaching the minimum payout threshold
                (1,000 Diamonds / $15 USD equivalent) in their preferred supported currency.
              </p>
              <p>
                To prevent fraud and gift-cycling, high-value or flagged payouts may undergo a
                standard 24–26 hour security review before bank or mobile-money settlement.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-sky-500" />
                4. Sponsored Ads &amp; Ad Refund Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                All user-submitted promotions undergo safety review before going live. If a
                promotion is rejected during review:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Coin-Paid Promotions</strong>: 100% of spent
                  Coins are automatically refunded to your promotional Coin balance immediately.
                </li>
                <li>
                  <strong className="text-foreground">Direct Flutterwave Ad Payments</strong>:
                  Eligible Card payments are automatically refunded via Flutterwave’s Refund API.
                  Channels that do not support instant API refunds (such as certain Bank Transfers
                  or USSD payments) are settled manually by our team within 3–5 business days.
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
                  transaction reference (`tx_ref`) or open a ticket in our Help &amp; Support Center.
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
