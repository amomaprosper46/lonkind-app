'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  ShieldCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { countries } from '@/lib/countries';
import { auth } from '@/lib/firebase';
import {
  linkWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { SixDigitOtpInput } from './six-digit-otp-input';
import { toast } from '@/hooks/use-toast';

type ProviderId = 'firebase' | 'sendchamp' | 'backup_sms';

interface PhoneOtpVerificationScreenProps {
  onVerified: (phoneNumber: string) => void;
  onSignOutAndBack?: () => void;
  subtitle?: string;
}

export function PhoneOtpVerificationScreen({
  onVerified,
  onSignOutAndBack,
  subtitle,
}: PhoneOtpVerificationScreenProps) {
  const [countryCode, setCountryCode] = useState('+1');
  const [localPhone, setLocalPhone] = useState('');
  const [step, setStep] = useState<'enter_phone' | 'enter_code'>('enter_phone');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderId | null>(null);
  const [activeProviderLabel, setActiveProviderLabel] = useState<string>('');
  const [triedProviders, setTriedProviders] = useState<ProviderId[]>([]);
  const [verifiedE164, setVerifiedE164] = useState<string>('');
  const firebaseConfirmRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // 45-second countdown timer for Resend via Backup Provider
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const buildE164 = () => {
    let digits = localPhone.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    return `${countryCode}${digits}`;
  };

  const requestOtp = async (options?: {
    skipProviders?: ProviderId[];
    failedClientProvider?: { id: ProviderId; error: string };
    isBackupRetry?: boolean;
  }) => {
    const e164 = buildE164();
    if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Phone Number',
        description: 'Please enter a valid mobile number with your country code.',
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Session Required',
        description: 'Please sign in again to verify your phone number.',
      });
      return;
    }

    setIsSending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/phone-otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: e164,
          skipProviders: options?.skipProviders || [],
          failedClientProvider: options?.failedClientProvider,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Could not send verification code.');
      }

      setVerifiedE164(data.phoneE164 || e164);

      if (data.mode === 'firebase_client') {
        // Attempt Priority 1: Firebase Phone Auth; silently fail over to Provider 2/3 on any error!
        try {
          if (!recaptchaRef.current) {
            recaptchaRef.current = new RecaptchaVerifier(auth, 'phone-otp-recaptcha', {
              size: 'invisible',
            });
          }
          const confirmation = await linkWithPhoneNumber(
            user,
            data.phoneE164 || e164,
            recaptchaRef.current
          );
          firebaseConfirmRef.current = confirmation;
          setActiveProvider('firebase');
          setActiveProviderLabel(data.providerLabel || 'Firebase Phone Auth');
          setTriedProviders((prev) => (prev.includes('firebase') ? prev : [...prev, 'firebase']));
          setStep('enter_code');
          setCooldown(45);
          toast({
            title: '📱 SMS Code Sent!',
            description: `Enter the 6-digit verification code sent to ${data.phoneE164 || e164}.`,
          });
          return;
        } catch (fbErr: any) {
          // Silent automatic failover from Firebase Phone Auth -> SendChamp -> Backup SMS
          firebaseConfirmRef.current = null;
          const nextSkip: ProviderId[] = Array.from(
            new Set([...(options?.skipProviders || []), 'firebase'])
          );
          await requestOtp({
            skipProviders: nextSkip,
            failedClientProvider: {
              id: 'firebase',
              error: fbErr?.code || fbErr?.message || 'Firebase Phone Auth failed',
            },
          });
          return;
        }
      }

      // Server-delivered SMS (SendChamp or Backup Termii/Twilio)
      firebaseConfirmRef.current = null;
      const used = (data.providerUsed as ProviderId) || 'sendchamp';
      setActiveProvider(used);
      setActiveProviderLabel(data.providerLabel || 'SMS Gateway');
      setTriedProviders((prev) => (prev.includes(used) ? prev : [...prev, used]));
      setStep('enter_code');
      setCooldown(45);
      toast({
        title: options?.isBackupRetry
          ? '🔄 Code Resent via Backup Provider!'
          : '📱 SMS Code Sent!',
        description: `Enter the 6-digit code sent to ${data.phoneE164 || e164}.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'SMS Delivery Error',
        description: err?.message || 'Unable to send SMS code. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResendViaBackup = async () => {
    if (cooldown > 0 || isSending) return;
    // Rotate to the next available provider in the chain; reset cycle if all 3 were tried
    const nextSkip = triedProviders.length >= 3 ? [] : triedProviders;
    await requestOtp({ skipProviders: nextSkip, isBackupRetry: true });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: '6-Digit Code Required',
        description: 'Please enter the complete 6-digit SMS code.',
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsVerifying(true);
    try {
      let verifiedByFirebaseAuth = false;
      if (activeProvider === 'firebase' && firebaseConfirmRef.current) {
        await firebaseConfirmRef.current.confirm(cleanCode);
        await user.reload();
        verifiedByFirebaseAuth = true;
      }

      const freshToken = await user.getIdToken(true);
      const res = await fetch('/api/auth/phone-otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({
          phone: verifiedE164 || buildE164(),
          code: cleanCode,
          verifiedByFirebaseAuth,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Invalid verification code.');
      }

      toast({
        title: '✅ Phone Number Verified!',
        description: 'Your account is now fully unlocked for live streaming, coins, promotions, and payouts.',
      });
      onVerified(data.phoneNumber || verifiedE164);
    } catch (err: any) {
      const msg =
        err?.code === 'auth/invalid-verification-code'
          ? 'Incorrect 6-digit code. Please check your SMS and try again.'
          : err?.message || 'Verification failed. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: msg,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-5 py-2">
      <div id="phone-otp-recaptcha" />

      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Phone className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-extrabold">Verify Your Phone Number</h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {subtitle ||
            'One unique phone number per account is required to unlock live streaming, coin purchases, promotions, and creator payouts.'}
        </p>
      </div>

      {step === 'enter_phone' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Country</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={`${c.code}-${c.dial_code}`} value={c.dial_code}>
                      {c.code} ({c.dial_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Mobile Phone Number</Label>
              <Input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="e.g., 415 555 2671"
                className="h-10"
              />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              Protected by Lonkind’s 3-provider automatic SMS failover router for reliable global
              delivery.
            </span>
          </div>

          <Button
            type="button"
            onClick={() => requestOtp()}
            disabled={isSending || localPhone.replace(/\D/g, '').length < 6}
            className="w-full h-11 rounded-xl font-bold"
          >
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSending ? 'Sending 6-Digit SMS Code...' : 'Send 6-Digit SMS Code'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Code sent to <strong className="text-foreground">{verifiedE164}</strong>
            </p>
            {activeProviderLabel && (
              <Badge variant="secondary" className="text-[10px]">
                Delivered via {activeProviderLabel}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-center block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Enter 6-Digit Verification Code
            </Label>
            <SixDigitOtpInput
              value={otpCode}
              onChange={setOtpCode}
              disabled={isVerifying}
            />
          </div>

          <Button
            type="submit"
            disabled={isVerifying || otpCode.replace(/\D/g, '').length !== 6}
            className="w-full h-11 rounded-xl font-bold gap-2"
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isVerifying ? 'Verifying Code...' : 'Verify Phone & Unlock Account'}
          </Button>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cooldown > 0 || isSending}
              onClick={handleResendViaBackup}
              className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {cooldown > 0
                ? `Resend via Backup Provider (${cooldown}s)`
                : 'Resend via Backup Provider'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep('enter_phone');
                setOtpCode('');
                setTriedProviders([]);
              }}
              className="w-full text-xs text-muted-foreground gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change Phone Number
            </Button>
          </div>
        </form>
      )}

      {onSignOutAndBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut(auth).catch(() => {});
            onSignOutAndBack();
          }}
          className="w-full text-xs text-muted-foreground gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      )}
    </div>
  );
}
