'use client';

import React, { useState } from 'react';
import {
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const FAQ_ITEMS = [
  {
    q: 'Why didn’t I receive my Gmail verification link after signing up?',
    a: 'First check your Gmail Spam, Promotions, or Updates tabs for an email from Lonkind / Firebase Auth. You can also tap "Resend Verification Email" on the confirmation screen after the 60-second cooldown. Make sure you entered a valid @gmail.com address without typos.',
  },
  {
    q: 'How do Virtual Coins and the 20% First-Time Buyer Bonus work?',
    a: 'You can purchase Virtual Coins worldwide in USD or supported local currencies (NGN, GBP, EUR, GHS, KES, ZAR) via Card, Bank Transfer, USSD, or Mobile Money. Your very first settled Coin purchase automatically receives +20% bonus promotional Coins.',
  },
  {
    q: 'How do creators withdraw their Diamond earnings?',
    a: 'Adult creators (18+ with verified Gmail) can convert received gift Diamonds into cash payouts once reaching 1,000 Diamonds ($15 USD equivalent) inside Settings -> Wallet. Standard payouts are settled within 24–26 hours.',
  },
  {
    q: 'What happens if my promoted post or ad is not approved?',
    a: 'All user promotions are reviewed for safety before going live. If rejected, Coin-paid promotions are 100% refunded automatically to your wallet, and direct Flutterwave ad payments are refunded back to your original payment method (automatically for Cards, or within 3–5 business days for Bank Transfer/USSD).',
  },
  {
    q: 'Is Lonkind available outside Nigeria?',
    a: 'Yes! Lonkind is a global live-streaming and creator community platform open to adult users (18+) worldwide across North America, Europe, Africa, Asia, and South America, with multi-currency checkout and automatic local timezone support.',
  },
];

export function PublicContactClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('account_signup');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          subject: `[Public Contact] ${category}`,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not submit support ticket.');
      }
      setSubmittedRef(data?.ticketId || 'RECEIVED');
      setName('');
      setEmail('');
      setMessage('');
      toast({
        title: '✅ Support Ticket Submitted',
        description: 'Our global support team received your message and will reply via email.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Submission Notice',
        description:
          err?.message || 'You can also email us directly at support@lonkind.com anytime.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Direct Global Support Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-5 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-extrabold">Direct Support Email</p>
              <a
                href="mailto:support@lonkind.com"
                className="text-sm font-semibold text-primary hover:underline block"
              >
                support@lonkind.com
              </a>
              <p className="text-xs text-muted-foreground">
                Include your `@handle` or transaction reference (`tx_ref`) for faster resolution.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-5 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-extrabold">Global Support Availability</p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Worldwide Coverage • Typical Reply: &lt; 24 Hours
              </p>
              <p className="text-xs text-muted-foreground">
                Operated globally by Lonkind’s founder team for creators &amp; viewers everywhere.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Accordion */}
      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription className="text-xs">
            Quick answers on Signup &amp; Gmail Verification, Virtual Coins, Payouts, and Sponsored Ads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-border/70 overflow-hidden bg-muted/10"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 text-sm font-bold hover:bg-muted/30 transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Support Ticket Form */}
      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold">Submit a Support Ticket</CardTitle>
          <CardDescription className="text-xs">
            Have an account, payment, payout, or ad inquiry? Send a message directly to our team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submittedRef ? (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-5 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-foreground">
                Thank you! Your support request has been logged.
              </p>
              <p className="text-xs text-muted-foreground">
                Ticket Reference: <code>{submittedRef}</code>. We will respond to your email soon.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl mt-2"
                onClick={() => setSubmittedRef(null)}
              >
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Full Name</Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Topic</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account_signup">Signup &amp; Email Verification</SelectItem>
                    <SelectItem value="coins_billing">Virtual Coins &amp; 20% Bonus</SelectItem>
                    <SelectItem value="creator_payouts">Creator Payouts &amp; Withdrawals</SelectItem>
                    <SelectItem value="sponsored_ads">Sponsored Ads &amp; Refunds</SelectItem>
                    <SelectItem value="safety_privacy">Safety, Privacy &amp; Data Deletion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Message</Label>
                <Textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe how we can help (include your @handle or tx_ref if relevant)..."
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-xl font-bold gap-2 px-6"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting ? 'Sending...' : 'Submit Support Ticket'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
