import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ShieldCheck, Calendar, Mail, Lock, Trash2, Radio, Bell } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Official Lonkind (lonkind.com) Privacy Policy covering Firebase Authentication, Cloud Firestore data handling, live streaming, virtual wallet records, and user privacy rights.',
};

const LAST_UPDATED = 'November 22, 2026';

export default function SettingsPrivacyPolicyPage() {
  return (
    <article className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-950 p-6 shadow-md space-y-3 text-white">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-[11px] font-bold gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Official Legal Document
          </Badge>
          <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold gap-1">
            <Calendar className="h-3 w-3" /> Last Updated: {LAST_UPDATED}
          </Badge>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-white">
          <FileText className="h-6 w-6 text-emerald-400 shrink-0" />
          Lonkind Privacy Policy
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
          Your privacy matters to us. This Privacy Policy explains how <strong className="text-white">Lonkind</strong> (operated at{' '}
          <strong className="text-white">lonkind.com</strong> and our mobile web/Android applications) collects, uses, stores, and protects
          your personal information when you connect, broadcast live, message friends, or participate in our creator
          economy.
        </p>
      </div>

      {/* Structured Legal Content */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-6 sm:p-8 space-y-8 text-sm text-muted-foreground leading-relaxed">
          {/* 1. Data Collection */}
          <section id="data-collection" className="space-y-3">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              1. Information We Collect
            </h2>
            <p>
              We collect only the information needed to deliver a safe, real-time social and live-streaming experience:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Account &amp; Authentication Information:</strong> When you create
                an account via <strong>Firebase Authentication</strong>, we collect your display name, unique{' '}
                <code>@username</code> handle, email address, and encrypted authentication credentials.
              </li>
              <li>
                <strong className="text-foreground">Profile &amp; User Content:</strong> Photos, cover banners, bios,
                business links, posts, comments, voice notes, direct messages, and saved bookmarks stored in{' '}
                <strong>Cloud Firestore</strong> and <strong>Firebase Storage</strong>.
              </li>
              <li>
                <strong className="text-foreground">Live Streaming &amp; Communications:</strong> Real-time audio and
                video streams, co-host sessions, live chat messages, and 3D virtual gift events transmitted while you
                host or participate in a live room.
              </li>
              <li>
                <strong className="text-foreground">Wallet &amp; Transaction Records:</strong> Coin balances, Diamond
                creator earnings, gift history, and payout requests (payment card details are processed directly by
                certified payment processors and are never stored on Lonkind servers).
              </li>
              <li>
                <strong className="text-foreground">Push Notifications &amp; Device Data:</strong> If you opt in, we
                store a <strong>Firebase Cloud Messaging (FCM)</strong> device token to deliver incoming call alerts,
                direct messages, follower requests, and live-stream notifications.
              </li>
            </ul>
          </section>

          {/* 2. How We Use Information */}
          <section id="how-we-use" className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-400" />
              2. How We Use Your Data &amp; Telemetry Controls
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Authenticate your identity, secure your account with optional Two-Factor Authentication (2FA), and prevent fraud or unauthorized access.</li>
              <li>Deliver real-time feeds, friend/follower graphs, private account approval queues, direct messaging, and interactive live-streaming rooms.</li>
              <li>Process virtual coin top-ups, creator gift attribution, and diamond payout requests accurately via double-entry ledger records.</li>
              <li>Send push, email, and in-app notifications strictly according to your preferences in <Link href="/settings" className="text-indigo-400 hover:underline font-semibold">Settings</Link>.</li>
              <li>
                <strong className="text-foreground">Telemetry &amp; AI Training Opt-Out:</strong> You can disable
                diagnostic telemetry and opt out of model training data usage globally at any time in{' '}
                <Link href="/settings/privacy" className="text-indigo-400 hover:underline font-semibold">
                  Settings → Privacy &amp; Safety
                </Link>
                .
              </li>
            </ul>
          </section>

          {/* 3. Live Stream & Social Visibility */}
          <section id="live-visibility" className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Radio className="h-4 w-4 text-rose-400" />
              3. Public Content, Private Accounts &amp; Live Streams
            </h2>
            <p>
              Public posts, profiles, and live broadcasts on Lonkind may be visible to other community members and
              guests. When you enable <strong className="text-foreground">Private Account</strong> inside{' '}
              <Link href="/settings/privacy/followers" className="text-indigo-400 hover:underline font-semibold">
                Follower Requests &amp; Privacy
              </Link>
              , new follow requests require your explicit confirmation before gaining access to your private content.
              You may also hide your followers list, toggle Activity Status and Read Receipts, or block accounts at any
              time.
            </p>
          </section>

          {/* 4. Data Security & Third-Party Processors */}
          <section id="security" className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground">
              4. Infrastructure Security &amp; Data Protection
            </h2>
            <p>
              Lonkind runs on Google Cloud and Firebase infrastructure with TLS encryption in transit, AES-256
              encryption at rest, strict Firestore Security Rules enforcing account-owner authorization, and server-side
              token verification on sensitive wallet and privacy endpoints. We do <strong className="text-foreground">not</strong>{' '}
              sell your personal information to third-party data brokers.
            </p>
          </section>

          {/* 5. User Rights & Account Deletion */}
          <section id="user-rights" className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-400" />
              5. Your Privacy Rights &amp; Permanent Account Deletion
            </h2>
            <p>
              Depending on your jurisdiction (including GDPR, CCPA/CPRA, and NDPR), you have the right to access,
              correct, export, or permanently delete your personal data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Self-Service Deletion:</strong> Signed-in users can permanently
                delete their account directly inside <Link href="/settings" className="text-indigo-400 hover:underline font-semibold">Settings → Account &amp; Profile → Delete Account Permanently</Link>.
              </li>
              <li>
                <strong className="text-foreground">Email / Ticket Deletion Requests:</strong> If you cannot access
                your account, submit a deletion request via{' '}
                <Link href="/settings/support" className="text-indigo-400 hover:underline font-semibold">
                  Help &amp; Support
                </Link>{' '}
                or email <a href="mailto:privacy@lonkind.com" className="text-emerald-400 hover:underline font-semibold">privacy@lonkind.com</a>.
              </li>
              <li>
                <strong className="text-foreground">Children&apos;s Privacy:</strong> Lonkind is not directed to
                children under 13 (or the minimum digital consent age in your country). Users must be at least 18 to use
                Creator Wallet payouts or purchase virtual coins.
              </li>
            </ul>
          </section>

          {/* 6. Contact Info */}
          <section id="contact" className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-sky-400" />
              6. Contact Lonkind Privacy Team
            </h2>
            <p>
              If you have questions about this Privacy Policy or how your data is handled on <strong>lonkind.com</strong>,
              please contact us:
            </p>
            <div className="p-4 rounded-2xl bg-secondary/35 border border-border/60 space-y-1 text-xs sm:text-sm">
              <p><strong className="text-foreground">Platform:</strong> Lonkind (https://lonkind.com)</p>
              <p><strong className="text-foreground">Founder &amp; Lead Developer:</strong> Prosper Amoma</p>
              <p>
                <strong className="text-foreground">Privacy Inquiries:</strong>{' '}
                <a href="mailto:privacy@lonkind.com" className="text-emerald-400 hover:underline font-semibold">
                  privacy@lonkind.com
                </a>
              </p>
              <p>
                <strong className="text-foreground">General Support:</strong>{' '}
                <a href="mailto:support@lonkind.com" className="text-sky-400 hover:underline font-semibold">
                  support@lonkind.com
                </a>{' '}
                or via{' '}
                <Link href="/settings/support" className="text-indigo-400 hover:underline font-semibold">
                  Help &amp; Support Center
                </Link>
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </article>
  );
}
