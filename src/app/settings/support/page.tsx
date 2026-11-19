'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  HelpCircle,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  Shield,
  Radio,
  Wallet,
  Users,
  FileText,
  Scale,
  Clock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSettingsContext } from '../settings-context';

const FAQ_SECTIONS = [
  {
    id: 'account-verification',
    icon: Shield,
    iconColor: 'text-indigo-400',
    question: 'How do Account Settings, Profile Updates & Creator Verification work?',
    answer:
      'You can update your Display Name, @username handle, bio, profile picture, and cover banner anytime from Settings -> Account & Profile. Updating your avatar automatically syncs across all your past posts, comments, messages, and friends lists. Verified badges are granted to official Lonkind accounts and eligible established creators who follow our Community Guidelines.',
  },
  {
    id: 'live-streaming-rules',
    icon: Radio,
    iconColor: 'text-rose-400',
    question: 'What are the Live Streaming rules and safety guidelines on Lonkind?',
    answer:
      'Lonkind hosts must be 18+ to broadcast live or receive virtual gift payouts. Hate speech, harassment, explicit adult content, dangerous stunts, copyrighted rebroadcasts without rights, and scam promotions are strictly prohibited. Hosts can moderate their rooms in real time, invite verified co-hosts, and report violators directly from the live stream interface.',
  },
  {
    id: 'wallet-payouts',
    icon: Wallet,
    iconColor: 'text-amber-400',
    question: 'How do Creator Wallet Coins, 3D Virtual Gifts & Diamond Payouts work?',
    answer:
      'Supporters purchase Coins inside Settings -> Creator Wallet (with a +20% bonus on eligible first-time coin purchases) and send 3D virtual gifts during live broadcasts. Creators earn Diamonds from received gifts and can request payouts directly from their Creator Wallet once minimum withdrawal thresholds and account security checks are met.',
  },
  {
    id: 'follower-privacy',
    icon: Users,
    iconColor: 'text-emerald-400',
    question: 'How do I turn on Private Account & manage Follower Requests?',
    answer:
      'Open Settings -> Privacy & Safety -> Follower Requests (/settings/privacy/followers). Turning on "Private Account" places every new follower into a Pending state until you manually Confirm or Delete their request. You can also bulk-approve/decline pending requests, silently remove existing followers without notifying them, or block accounts directly.',
  },
  {
    id: 'account-deletion',
    icon: HelpCircle,
    iconColor: 'text-purple-400',
    question: 'How can I reset my password or permanently delete my Lonkind account?',
    answer:
      'Go to Settings -> Account & Profile to trigger a secure Firebase password reset link to your email, or use "Delete Account Permanently" to remove your profile, authentication credentials, and stored content. If you cannot sign in and need data removal assistance, submit a ticket below or email support@lonkind.com.',
  },
];

export default function SettingsSupportPage() {
  const { currentUser } = useSettingsContext();
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Account & Profile');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.email && !email) {
      setEmail(currentUser.email);
    }
  }, [currentUser?.email, email]);

  const handleCopyEmail = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText('support@lonkind.com');
      toast({ title: 'Email Copied', description: 'support@lonkind.com copied to your clipboard.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast({ variant: 'destructive', title: 'Valid Email Required', description: 'Please enter a valid email address so we can reply.' });
      return;
    }
    if (cleanSubject.length < 4) {
      toast({ variant: 'destructive', title: 'Subject Too Short', description: 'Please enter a brief subject (at least 4 characters).' });
      return;
    }
    if (cleanMessage.length < 15) {
      toast({ variant: 'destructive', title: 'More Details Needed', description: 'Please describe your question in at least 15 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Attempt direct Firestore write when signed in; fall back cleanly to server API route for public visitors
      let ticketId: string | null = null;
      if (auth?.currentUser) {
        try {
          const docRef = await addDoc(collection(db, 'support_tickets'), {
            userId: auth.currentUser.uid,
            email: cleanEmail.toLowerCase(),
            category,
            subject: cleanSubject,
            message: cleanMessage,
            status: 'OPEN',
            createdAt: serverTimestamp(),
          });
          ticketId = docRef.id;
        } catch {
          // Fall through to Admin SDK API endpoint
        }
      }

      if (!ticketId) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (auth?.currentUser) {
          const token = await auth.currentUser.getIdToken().catch(() => '');
          if (token) headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch('/api/support/ticket', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: cleanEmail,
            category,
            subject: cleanSubject,
            message: cleanMessage,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not submit ticket.');
        ticketId = data.ticketId;
      }

      setSubmittedTicketId(ticketId);
      setSubject('');
      setMessage('');
      toast({
        title: 'Support Ticket Received',
        description: `Ticket #${ticketId?.slice(0, 8).toUpperCase()} has been created. Our team will reply to ${cleanEmail}.`,
      });
    } catch (err: any) {
      console.error('[SettingsSupportPage] Submit error:', err);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: err?.message || 'Please email support@lonkind.com directly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner with Official Support Email */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-sky-950/35 to-slate-900/95 p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold">
                Lonkind Trust &amp; Support Center
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                <Clock className="h-3 w-3 text-emerald-400" /> Typical reply within 24 hours
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <HelpCircle className="h-6 w-6 text-sky-400 shrink-0" />
              Help &amp; Support
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Find instant answers to common questions about Lonkind (lonkind.com) or reach our creator &amp; community support team directly.
            </p>
          </div>

          {/* Official Visible Support Email Box */}
          <div className="rounded-2xl bg-secondary/45 border border-border/60 p-3.5 space-y-2 shrink-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Official Support Email
            </p>
            <div className="flex items-center gap-2">
              <a
                href="mailto:support@lonkind.com"
                className="text-sm font-bold text-sky-400 hover:underline flex items-center gap-1.5"
              >
                <Mail className="h-4 w-4 shrink-0" />
                support@lonkind.com
              </a>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleCopyEmail}
                title="Copy support email"
                className="h-7 w-7 rounded-lg"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Frequently Asked Questions Accordion */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base font-bold">Frequently Asked Questions</CardTitle>
          <CardDescription className="text-xs">
            Quick guides for Account Verification, Live Streaming Rules, Creator Payouts, and Follower Privacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="rounded-xl border border-border/60 bg-secondary/20 px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3.5 text-left">
                    <span className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                      <Icon className={`h-4 w-4 shrink-0 ${item.iconColor}`} />
                      {item.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Section 2: Working Contact Support Form -> Firestore `support_tickets` */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-400" />
            Contact Support
          </CardTitle>
          <CardDescription className="text-xs">
            Submit a support ticket directly to our Firebase helpdesk. Every ticket receives a tracking reference and email follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          {submittedTicketId && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold text-emerald-300">
                  Ticket Submitted — Reference #{submittedTicketId.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Status: <strong className="text-emerald-300">OPEN</strong>. Our support specialists will review your inquiry and reply to your email.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="support-email" className="text-xs font-semibold">
                  Your Email Address
                </Label>
                <Input
                  id="support-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-xl bg-secondary/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-category" className="text-xs font-semibold">
                  Topic Category
                </Label>
                <select
                  id="support-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="Account & Profile">Account &amp; Verification</option>
                  <option value="Live Streaming">Live Streaming &amp; Audio/Video</option>
                  <option value="Wallet & Payouts">Wallet, Coins &amp; Creator Payouts</option>
                  <option value="Privacy & Safety">Privacy, Follower Requests &amp; Safety</option>
                  <option value="Bug Report">Bug Report or Technical Issue</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="support-subject" className="text-xs font-semibold">
                Subject
              </Label>
              <Input
                id="support-subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your request"
                className="rounded-xl bg-secondary/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="support-message" className="text-xs font-semibold">
                Message
              </Label>
              <Textarea
                id="support-message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Include any helpful details, usernames, or transaction references..."
                className="rounded-xl bg-secondary/40 resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-muted-foreground">
                You can also email us directly at{' '}
                <a href="mailto:support@lonkind.com" className="text-sky-400 font-semibold hover:underline">
                  support@lonkind.com
                </a>
              </p>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 self-start sm:self-center"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Support Ticket
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Related Legal Links Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/settings/privacy-policy"
          className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-emerald-500/40 transition-colors"
        >
          <span className="flex items-center gap-2.5 text-sm font-bold">
            <FileText className="h-4 w-4 text-emerald-400" />
            Read Privacy Policy
          </span>
          <span className="text-xs text-muted-foreground">View →</span>
        </Link>

        <Link
          href="/settings/terms"
          className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-amber-500/40 transition-colors"
        >
          <span className="flex items-center gap-2.5 text-sm font-bold">
            <Scale className="h-4 w-4 text-amber-400" />
            Read Terms of Service
          </span>
          <span className="text-xs text-muted-foreground">View →</span>
        </Link>
      </div>
    </div>
  );
}
