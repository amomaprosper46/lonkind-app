import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  Database,
  Lock,
  CreditCard,
  Globe,
  Cookie,
  Trash2,
  Mail,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicFooter } from '@/components/social/public-footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Lonkind Technologies',
  description:
    'Official Privacy Policy for Lonkind (lonkind.com), owned and operated globally by Lonkind Technologies (CAC, Nigeria): 18+ data protection, @gmail.com auth, Google Firebase security & encrypted daily backups, Flutterwave PCI-DSS Level 1 privacy, and GDPR/CCPA rights.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy — Lonkind Technologies',
    description:
      'Official global Privacy Policy for Lonkind (lonkind.com), owned and operated by Lonkind Technologies.',
    url: 'https://lonkind.com/privacy',
    siteName: 'Lonkind',
    images: [{ url: 'https://lonkind.com/og-banner.png', width: 1200, height: 630, alt: 'Lonkind Privacy Policy' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — Lonkind Technologies',
    description: 'Official global Privacy Policy for Lonkind (lonkind.com).',
    images: ['https://lonkind.com/og-banner.png'],
  },
};

const POLICY_VERSION = 'v3.1';
const LAST_UPDATED = 'November 28, 2026';

export default function PrivacyPolicyContent() {
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
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Policy {POLICY_VERSION}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-1 rounded-full border border-border/60">
              <RefreshCw className="h-3.5 w-3.5" />
              Last Updated: {LAST_UPDATED}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Privacy Policy</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            <strong className="text-foreground">Lonkind</strong> (
            <strong className="text-foreground">lonkind.com</strong>) is owned and operated
            globally by <strong className="text-foreground">Lonkind Technologies</strong>, a
            company duly registered under the{' '}
            <strong className="text-foreground">Corporate Affairs Commission (CAC) of Nigeria</strong>.
            This Privacy Policy explains how Lonkind Technologies collects, safeguards, and manages
            your personal data worldwide.
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
                Updated data controller identity to{' '}
                <strong className="text-foreground">Lonkind Technologies</strong> (CAC, Nigeria)
                operating globally at lonkind.com.
              </li>
              <li>
                Documented <strong className="text-foreground">18+ Date of Birth</strong>{' '}
                verification and <strong className="text-foreground">Real-Name + @gmail.com</strong>{' '}
                (anti-disposable &amp; anti-<code className="text-xs">+</code>-alias) account
                integrity checks.
              </li>
              <li>
                Disclosed <strong className="text-foreground">Google Firebase</strong> cloud
                security (Authentication, Cloud Firestore, Cloud Storage, App Check, and encrypted
                daily backups with 14-day rolling retention).
              </li>
              <li>
                Confirmed <strong className="text-foreground">Flutterwave PCI-DSS Level 1</strong>{' '}
                payment privacy with strict Zero Card &amp; Bank Credential Storage.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 1: Data We Collect */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-500" />
              1. Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Account &amp; Identity Data:</strong> Real full
                name, verified <code className="text-xs bg-muted px-1 rounded">@gmail.com</code>{' '}
                address (or verified phone number), Date of Birth (to confirm 18+ eligibility),
                handle, avatar, and bio.
              </li>
              <li>
                <strong className="text-foreground">Content &amp; Live Stream Activity:</strong>{' '}
                Posts, comments, uploaded media, live broadcasts, live chat messages, virtual gifts,
                and user-submitted Sponsored Ad creatives.
              </li>
              <li>
                <strong className="text-foreground">Transaction Ledger Metadata:</strong>{' '}
                Non-sensitive transaction references, currency, Virtual Coin/Diamond balances, and
                creator payout routing details supplied by creators for payout settlement.
              </li>
              <li>
                <strong className="text-foreground">Security &amp; Anti-Fraud Signals:</strong> IP
                addresses, user-agent headers, rate-limit counters, and anonymous ad viewability
                signals used solely to stop bots, credential stuffing, and invalid ad impressions.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 2: Google Firebase Security & Encrypted Daily Backups */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              2. Data Security &amp; Google Firebase Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Lonkind Technologies uses <strong className="text-foreground">Google Firebase</strong>{' '}
              to safeguard user accounts, media, and transaction ledgers globally:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Firebase Authentication:</strong> Protects
                account credentials, Gmail verification links, and session tokens.
              </li>
              <li>
                <strong className="text-foreground">Cloud Firestore &amp; Cloud Storage:</strong>{' '}
                Enforces strict server-side Security Rules preventing unauthorized client writes to
                wallets, roles, or private files.
              </li>
              <li>
                <strong className="text-foreground">Firebase App Check:</strong> Verifies genuine
                app requests to protect platform APIs from automated abuse.
              </li>
              <li>
                <strong className="text-foreground">Encrypted Daily Backups &amp; Audit Logs:</strong>{' '}
                Automated daily compressed backups are stored in private, non-public cloud storage
                with a rolling 14-day retention schedule, alongside immutable security audit logs.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 3: Payment Privacy */}
        <Card className="rounded-2xl border-emerald-500/35 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              3. Payment Processing Privacy (Flutterwave PCI-DSS Level 1)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>
              Payments and creator payout disbursements are handled by our authorized third-party
              payment gateway, <strong className="text-foreground">Flutterwave</strong>.
            </p>
            <p>
              <strong className="text-foreground">Zero Bank &amp; Card Detail Exposure:</strong>{' '}
              Lonkind Technologies never collects, views, or stores raw card numbers, CVVs, or bank
              login credentials. All payment processing is encrypted under{' '}
              <strong className="text-foreground">PCI-DSS Level 1</strong> standards via
              Flutterwave, and corporate settlement banking details remain strictly confidential.
            </p>
          </CardContent>
        </Card>

        {/* Section 4: Cookies & Responsible Ads */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Cookie className="h-5 w-5 text-amber-500" />
              4. Cookies, Local Preferences &amp; Responsible Ads
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">
            <p>
              We use essential session cookies and browser local storage to maintain sign-in state,
              honor Dark/Light theme and Data Saver Mode settings, and prevent duplicate Sponsored
              Ad impressions. Lonkind Technologies does <strong className="text-foreground">not</strong>{' '}
              sell personal data to third-party data brokers.
            </p>
          </CardContent>
        </Card>

        {/* Section 5: 18+ Global Policy & International Privacy Rights */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              5. Strict 18+ Policy &amp; Global Privacy Rights (GDPR / CCPA)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Lonkind is strictly an <strong className="text-foreground">18+ global platform</strong>.
              We do not knowingly collect data from anyone under 18. Report any underage account to{' '}
              <a href="mailto:privacy@lonkind.com" className="text-primary underline font-semibold">
                privacy@lonkind.com
              </a>{' '}
              for immediate removal.
            </p>
            <p>
              Users worldwide (including under <strong className="text-foreground">GDPR</strong> and{' '}
              <strong className="text-foreground">CCPA/CPRA</strong>) may request access,
              correction, export, or permanent deletion of their personal data via Settings or by
              emailing{' '}
              <a href="mailto:privacy@lonkind.com" className="text-primary underline font-semibold">
                privacy@lonkind.com
              </a>
              .
            </p>
            <p className="text-xs flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              Account deletion requests are completed within 30 days, subject only to mandatory
              anti-fraud and financial ledger retention required by law.
            </p>
          </CardContent>
        </Card>

        {/* Section 6: Corporate Privacy Contact */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              6. Data Controller &amp; Privacy Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p className="font-bold text-foreground">
              Lonkind Technologies (Registered with CAC, Nigeria)
            </p>
            <p>Founder &amp; Lead Developer: <strong className="text-foreground">Prosper Amoma</strong></p>
            <p>
              Privacy:{' '}
              <a href="mailto:privacy@lonkind.com" className="text-primary underline font-semibold">
                privacy@lonkind.com
              </a>{' '}
              • Support:{' '}
              <a href="mailto:support@lonkind.com" className="text-primary underline font-semibold">
                support@lonkind.com
              </a>
            </p>
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
