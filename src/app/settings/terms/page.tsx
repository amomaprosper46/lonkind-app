import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale, Calendar, Radio, Wallet, ShieldAlert, UserCheck, Mail, Gavel } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Official Lonkind (lonkind.com) Terms of Service governing user accounts, live-streaming guidelines, Creator Wallet virtual currency, and community standards.',
};

const LAST_UPDATED = 'November 22, 2026';

export default function SettingsTermsOfServicePage() {
  return (
    <article className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-amber-950/30 to-slate-900/95 p-6 shadow-md space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold gap-1">
            <Gavel className="h-3.5 w-3.5" /> Official Platform Agreement
          </Badge>
          <Badge variant="secondary" className="text-[11px] font-semibold gap-1">
            <Calendar className="h-3 w-3" /> Last Updated: {LAST_UPDATED}
          </Badge>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-foreground">
          <Scale className="h-6 w-6 text-amber-400 shrink-0" />
          Lonkind Terms of Service
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Welcome to <strong>Lonkind</strong> (<strong>lonkind.com</strong>). By creating an account, watching or
          hosting a live stream, messaging other members, or purchasing virtual coins, you agree to these Terms of
          Service and our{' '}
          <Link href="/settings/privacy-policy" className="text-emerald-400 hover:underline font-semibold">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      {/* Structured Terms Content */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-6 sm:p-8 space-y-8 text-sm text-muted-foreground leading-relaxed">
          {/* 1. Eligibility & Account */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-400" />
              1. Eligibility &amp; Account Responsibility
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must be at least 13 years old (or the minimum legal age in your region) to use Lonkind, and at least <strong className="text-foreground">18 years old</strong> to host monetized live streams, purchase Coins, or withdraw Creator Diamonds.</li>
              <li>You are responsible for safeguarding your login credentials and keeping your Two-Factor Authentication (2FA) and email up to date.</li>
              <li>Impersonating another person, brand, or official Lonkind staff member is strictly prohibited.</li>
            </ul>
          </section>

          {/* 2. Live Stream Content Guidelines */}
          <section className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Radio className="h-4 w-4 text-rose-400" />
              2. Live Stream Content Guidelines &amp; Community Safety
            </h2>
            <p>
              Lonkind is built to celebrate creativity, kindness, and authentic global connection. While broadcasting
              live, posting content, or chatting, you agree <strong className="text-foreground">NOT</strong> to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Stream or share sexually explicit material, nudity, graphic violence, self-harm promotion, or illegal activity.</li>
              <li>Engage in hate speech, bullying, doxxing, harassment, or targeted abuse against any individual or group.</li>
              <li>Broadcast copyrighted movies, television, music, or sports events without holding proper rights or licenses.</li>
              <li>Run deceptive giveaways, financial scams, phishing links, or automated spam bots.</li>
            </ul>
            <p>
              Our moderation team reserves the right to terminate live broadcasts immediately, remove offending posts,
              and suspend or permanently ban accounts that violate these guidelines.
            </p>
          </section>

          {/* 3. Wallet & Virtual Currency Terms */}
          <section className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-400" />
              3. Creator Wallet, Virtual Coins &amp; Diamond Payouts
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Virtual Coins:</strong> Lonkind Coins are digital virtual items used
                exclusively inside Lonkind to send animated 3D virtual gifts and support creators. Coins have no cash
                value outside Lonkind, are non-transferable between users outside official gifting features, and are
                non-refundable except where required by applicable law.
              </li>
              <li>
                <strong className="text-foreground">Creator Diamonds &amp; 24-Hour Payout Processing:</strong> Eligible creators earn
                Diamonds when viewers send virtual gifts. Verified payout requests are processed within{' '}
                <strong className="text-foreground">24 hours</strong>, subject to identity/compliance review,
                anti-fraud ledger verification, minimum withdrawal limits, and applicable local payment processor fees.
              </li>
              <li>
                <strong className="text-foreground">Anti-Gift-Cycling, Fraud &amp; Chargebacks:</strong> Any fraudulent purchase,
                unauthorized chargeback, duplicate-account bonus farming, or artificial gift-cycling scheme may result in immediate forfeiture of
                disputed balances and permanent account suspension.
              </li>
            </ul>
          </section>

          {/* 4. User Content & Intellectual Property */}
          <section className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground">
              4. User Content &amp; Intellectual Property
            </h2>
            <p>
              You retain ownership of the original posts, videos, and streams you publish on Lonkind. By posting content
              on Lonkind, you grant us a worldwide, non-exclusive, royalty-free license to host, store, transcode,
              display, and distribute that content solely to operate and improve the Lonkind platform. The Lonkind name,
              3D &ldquo;L&rdquo; logo, custom 3D virtual gift animations, and software code remain the exclusive
              property of Lonkind.
            </p>
          </section>

          {/* 5. Account Termination & Disclaimers */}
          <section className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              5. Account Termination, Disclaimers &amp; Liability
            </h2>
            <p>
              You may delete your account at any time from{' '}
              <Link href="/settings" className="text-indigo-400 hover:underline font-semibold">
                Settings → Account &amp; Profile
              </Link>
              . Lonkind is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis. To the fullest
              extent permitted by law, Lonkind is not liable for indirect, incidental, or consequential damages arising
              from user-generated content, third-party outages, or unauthorized account access caused by compromised
              passwords.
            </p>
          </section>

          {/* 6. Contact Information */}
          <section className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-sky-400" />
              6. Legal &amp; Support Contact
            </h2>
            <div className="p-4 rounded-2xl bg-secondary/35 border border-border/60 space-y-1 text-xs sm:text-sm">
              <p><strong className="text-foreground">Platform:</strong> Lonkind (https://lonkind.com)</p>
              <p><strong className="text-foreground">Founder &amp; Lead Developer:</strong> Prosper Amoma</p>
              <p>
                <strong className="text-foreground">Legal Notices:</strong>{' '}
                <a href="mailto:legal@lonkind.com" className="text-amber-400 hover:underline font-semibold">
                  legal@lonkind.com
                </a>
              </p>
              <p>
                <strong className="text-foreground">Creator &amp; User Support:</strong>{' '}
                <a href="mailto:support@lonkind.com" className="text-sky-400 hover:underline font-semibold">
                  support@lonkind.com
                </a>{' '}
                or visit{' '}
                <Link href="/settings/support" className="text-indigo-400 hover:underline font-semibold">
                  Help &amp; Support
                </Link>
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </article>
  );
}
