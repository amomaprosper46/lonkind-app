'use client';

import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  Loader2,
  Mail,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithCustomToken,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { countries } from '@/lib/countries';
import { SixDigitOtpInput } from './six-digit-otp-input';
import {
  CONSENT_VERSION,
  DEFAULT_USER_SETTINGS,
  type LegalConsentRecord,
} from '@/lib/settings-schema';
import {
  MAX_FULL_NAME_LEN,
  realFullNameSchema,
  validateRealFullName,
} from '@/lib/real-name-validation';
import { strictGmailSchema, validateStrictGmail } from '@/lib/gmail-validation';
import { calculateAgeFromDob } from '@/lib/age-and-ad-safety';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => String(CURRENT_YEAR - i));

/**
 * Returns the Firebase Auth `actionCodeSettings` with a safe authorized continue URL
 * (`https://lonkind.com` in production, `window.location.origin` in local dev).
 */
export function buildVerificationActionCodeSettings() {
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const continueUrl = isLocal ? window.location.origin : 'https://lonkind.com';
  return {
    url: continueUrl,
    handleCodeInApp: false,
  };
}

/**
 * Reliably sends Firebase Auth verification email with proper try/catch and fallback
 * if a custom continue URL is ever rejected by Firebase domain settings.
 */
export async function sendReliableVerificationEmail(user: FirebaseUser): Promise<void> {
  const actionCodeSettings = buildVerificationActionCodeSettings();
  try {
    await sendEmailVerification(user, actionCodeSettings);
  } catch (err: any) {
    const code = String(err?.code || '');
    if (
      code === 'auth/unauthorized-continue-uri' ||
      code === 'auth/invalid-continue-uri'
    ) {
      // Fallback without custom continue URL so verification email still delivers
      await sendEmailVerification(user);
      return;
    }
    throw err;
  }
}

/**
 * Reusable Gmail Verification Pending Screen with 60-second Resend cooldown
 * and automatic 3-second polling so activating an account feels seamless.
 */
export function EmailVerificationPendingScreen({
  email,
  onVerified,
  onSignOutAndBack,
}: {
  email?: string | null;
  onVerified: () => void;
  onSignOutAndBack?: () => void;
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // 60-second resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-poll Firebase Auth every 3 seconds for verification link click
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const current = auth.currentUser;
        if (!current) return;
        await current.reload();
        if (current.emailVerified) {
          clearInterval(poll);
          await setDoc(
            doc(db, 'users', current.uid),
            { emailVerified: true, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
          toast({
            title: '🎉 Gmail Verified!',
            description: 'Welcome to Lonkind! Your account is now active.',
          });
          onVerified();
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [onVerified]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const current = auth.currentUser;
      if (!current) {
        toast({
          variant: 'destructive',
          title: 'Session Not Found',
          description: 'Please sign in with your Gmail and password to continue.',
        });
        return;
      }
      await current.reload();
      if (current.emailVerified) {
        await setDoc(
          doc(db, 'users', current.uid),
          { emailVerified: true, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
        toast({
          title: '🎉 Gmail Verified!',
          description: 'Welcome to Lonkind! Your account is now active.',
        });
        onVerified();
      } else {
        toast({
          variant: 'destructive',
          title: 'Not Verified Yet',
          description:
            'Please open your Gmail Inbox or Spam folder and click the verification link first.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Verification Check Failed',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    const current = auth.currentUser;
    if (!current) return;

    setIsResending(true);
    try {
      await sendReliableVerificationEmail(current);
      setCooldown(60);
      toast({
        title: '📧 Verification Email Resent!',
        description: 'Check your Gmail Inbox or Spam folder for the fresh activation link.',
      });
    } catch (err: any) {
      const msg =
        err?.code === 'auth/too-many-requests'
          ? 'Please wait a minute before requesting another verification email.'
          : err?.message || 'Could not resend verification email.';
      toast({ variant: 'destructive', title: 'Resend Failed', description: msg });
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = async () => {
    await signOut(auth).catch(() => {});
    onSignOutAndBack?.();
  };

  return (
    <div className="flex flex-col items-center justify-center py-5 space-y-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <Mail className="h-8 w-8" />
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        <h3 className="text-xl font-extrabold text-foreground">
          Verify Your Gmail Address
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Verification link sent to your Gmail! Check your{' '}
          <strong className="text-foreground">Inbox or Spam folder</strong> and click the link to
          activate your account.
        </p>
        {email && (
          <p className="text-xs font-mono bg-muted/60 rounded-lg px-3 py-1.5 inline-block text-foreground">
            {email}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Waiting for you to click the link...</span>
      </div>

      <div className="space-y-2.5 w-full max-w-sm pt-1">
        <Button
          type="button"
          onClick={handleManualCheck}
          className="w-full h-11 rounded-xl font-bold"
          disabled={isChecking}
        >
          {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          I&apos;ve Verified My Gmail
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full h-10 rounded-xl font-semibold gap-2"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
        >
          {isResending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {cooldown > 0
            ? `Resend Verification Email (${cooldown}s)`
            : 'Resend Verification Email'}
        </Button>

        {onSignOutAndBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="w-full text-xs text-muted-foreground gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Use a different Gmail address
          </Button>
        )}
      </div>
    </div>
  );
}

const emailFormSchema = z.object({
  name: realFullNameSchema,
  email: strictGmailSchema,
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  consentTermsAndAge: z.boolean().refine((v) => v === true, {
    message: 'Please accept the Terms, Privacy Policy, and 18+ Real-Name confirmation.',
  }),
});

const phoneFormSchema = z.object({
  name: realFullNameSchema,
  countryCode: z.string().min(1, 'Please select a country.'),
  phone: z.string().min(5, { message: 'Please enter a valid phone number.' }),
  consentTermsAndAge: z.boolean().refine((v) => v === true, {
    message: 'Please accept the Terms, Privacy Policy, and 18+ Real-Name confirmation.',
  }),
});

const codeFormSchema = z.object({
  code: z.string().min(6, { message: 'Code must be 6 digits.' }),
});

type SignUpFormProps = {
  onSignUp: () => void;
  onShowSignIn: () => void;
};

export function SignUpForm({ onSignUp, onShowSignIn }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingForEmail, setIsWaitingForEmail] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [phoneAuthData, setPhoneAuthData] = useState<{
    name: string;
    phone: string;
    dob: string;
    age: number;
    legalConsent: LegalConsentRecord;
  } | null>(null);

  // Date of Birth (18+ required right on the signup form)
  const [birthMonth, setBirthMonth] = useState('01');
  const [birthDay, setBirthDay] = useState('01');
  const [birthYear, setBirthYear] = useState('2000');

  const dobString = `${birthYear}-${birthMonth}-${birthDay}`;
  const calculatedAge = calculateAgeFromDob(dobString) ?? 0;
  const isUnderage = calculatedAge < 18;

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      consentTermsAndAge: false,
    },
  });

  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
    resolver: zodResolver(phoneFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      countryCode: '+234',
      phone: '',
      consentTermsAndAge: false,
    },
  });

  const codeForm = useForm<z.infer<typeof codeFormSchema>>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  });

  const createEmailAccount = async (data: z.infer<typeof emailFormSchema>) => {
    if (isUnderage) {
      toast({
        variant: 'destructive',
        title: '18+ Age Requirement',
        description: 'Lonkind is an 18+ platform. Please enter a valid Date of Birth (18 or older).',
      });
      return;
    }

    const localName = validateRealFullName(data.name);
    if (!localName.valid || !localName.formattedName) {
      toast({
        variant: 'destructive',
        title: 'Real Full Name Required',
        description: localName.error || 'Please enter your first and last name.',
      });
      return;
    }

    const localEmail = validateStrictGmail(data.email);
    if (!localEmail.valid) {
      toast({
        variant: 'destructive',
        title: 'Valid @gmail.com Required',
        description: localEmail.error || 'Please enter a valid @gmail.com email address.',
      });
      return;
    }

    const formattedName = localName.formattedName;
    const normalizedEmail = localEmail.normalizedEmail;
    const canonicalEmail = localEmail.canonicalEmail || normalizedEmail;

    setIsLoading(true);
    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        data.password
      );
      const user = userCredential.user;

      // 2. Update Auth displayName (non-blocking if slow)
      await updateProfile(user, { displayName: formattedName }).catch(() => {});

      // 3. Create initial Firestore user profile matching firestore.rules schema
      const legalConsent: LegalConsentRecord = {
        consentVersion: CONSENT_VERSION,
        agreedAt: new Date().toISOString(),
        termsAndPrivacyAccepted: true,
        ageVerified: true,
        realNameAndGuidelinesAccepted: true,
      };
      const baseHandle =
        (formattedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user') +
        '_' +
        user.uid.slice(-4);

      const initialUserPayload = {
        uid: user.uid,
        name: formattedName,
        fullName: formattedName,
        handle: baseHandle,
        email: normalizedEmail,
        canonicalEmail,
        emailVerified: false,
        phoneVerified: false,
        phoneVerificationRequired: true,
        dob: dobString,
        dateOfBirth: dobString,
        age: calculatedAge,
        isAdult: true,
        birthMonth: parseInt(birthMonth, 10),
        birthDay: parseInt(birthDay, 10),
        birthYear: parseInt(birthYear, 10),
        role: 'user',
        coinBalance: 0,
        coins: 0,
        diamonds: 0,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`,
        bio: 'Hey there! I am using Lonkind.',
        followersCount: 0,
        followingCount: 0,
        settings: DEFAULT_USER_SETTINGS,
        legalConsent,
        onboardingLayerCompleted: 1,
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', user.uid), initialUserPayload);
      } catch (profileErr: any) {
        console.warn('[SignUp] Initial Firestore profile write warning:', profileErr?.message);
      }

      // 4. Immediately send Firebase Email Verification Link with proper try/catch
      try {
        await sendReliableVerificationEmail(user);
        toast({
          title: '📧 Verification Link Sent!',
          description:
            'Verification link sent to your Gmail! Check your Inbox or Spam folder and click the link to activate your account.',
        });
      } catch (emailErr: any) {
        console.error('[SignUp] sendEmailVerification failed:', emailErr);
        toast({
          variant: 'destructive',
          title: 'Account Created — Click Resend Email',
          description:
            emailErr?.code === 'auth/too-many-requests'
              ? 'Too many email requests. Wait 60 seconds and click "Resend Verification Email".'
              : emailErr?.message ||
                'Account created, but we could not send the email right away. Click "Resend Verification Email" below.',
        });
      }

      setRegisteredEmail(normalizedEmail);
      setIsWaitingForEmail(true);
    } catch (error: any) {
      let errorMessage = 'Something went wrong. Please try again.';
      if (error?.code === 'auth/email-already-in-use') {
        errorMessage = 'This Gmail address is already registered. Please sign in instead.';
      } else if (error?.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 8 characters.';
      } else if (error?.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid @gmail.com address.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  async function onPhoneSubmit(data: z.infer<typeof phoneFormSchema>) {
    if (isUnderage) {
      toast({
        variant: 'destructive',
        title: '18+ Age Requirement',
        description: 'Lonkind is an 18+ platform. You must be at least 18 years old to register.',
      });
      return;
    }

    const localName = validateRealFullName(data.name);
    if (!localName.valid || !localName.formattedName) {
      toast({
        variant: 'destructive',
        title: 'Real Full Name Required',
        description: localName.error || 'Please enter your first and last name.',
      });
      return;
    }

    setIsLoading(true);
    let rawDigits = data.phone.replace(/\D/g, '');
    if (rawDigits.startsWith('0')) {
      rawDigits = rawDigits.slice(1);
    }
    const fullPhoneNumber = data.countryCode + rawDigits;

    try {
      const legalConsent: LegalConsentRecord = {
        consentVersion: CONSENT_VERSION,
        agreedAt: new Date().toISOString(),
        termsAndPrivacyAccepted: true,
        ageVerified: true,
        realNameAndGuidelinesAccepted: true,
      };
      setPhoneAuthData({
        name: localName.formattedName,
        phone: fullPhoneNumber,
        dob: dobString,
        age: calculatedAge,
        legalConsent,
      });

      const res = await fetch('/api/sendchamp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
          channel: 'sms',
        }),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok || resData?.error) {
        throw new Error(resData?.error || 'Could not send verification code.');
      }

      setShowCodeForm(true);
      toast({
        title: '📱 Verification Code Sent!',
        description:
          resData?.message || `A 6-digit verification code has been sent to ${fullPhoneNumber}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Phone Sign Up Error',
        description: error?.message || 'Could not send verification code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onCodeSubmit(data: z.infer<typeof codeFormSchema>) {
    setIsLoading(true);
    try {
      if (!phoneAuthData) throw new Error('Phone verification details missing.');

      const res = await fetch('/api/sendchamp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneAuthData.phone,
          code: data.code,
          name: phoneAuthData.name,
          isSignup: true,
          legalConsent: phoneAuthData.legalConsent,
        }),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok || resData?.error || !resData?.customToken) {
        throw new Error(resData?.error || 'Verification failed.');
      }

      const userCredential = await signInWithCustomToken(auth, resData.customToken);
      const user = userCredential.user;

      if (user) {
        await updateProfile(user, {
          displayName: resData.formattedName || phoneAuthData.name,
        }).catch(() => {});
        await setDoc(
          doc(db, 'users', user.uid),
          {
            dob: phoneAuthData.dob,
            dateOfBirth: phoneAuthData.dob,
            age: phoneAuthData.age,
            isAdult: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
      }

      toast({ title: '🎉 Welcome to Lonkind!', description: 'Your account is ready.' });
      onSignUp();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: error?.message || 'Invalid verification code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isWaitingForEmail) {
    return (
      <EmailVerificationPendingScreen
        email={registeredEmail || auth.currentUser?.email}
        onVerified={onSignUp}
        onSignOutAndBack={() => setIsWaitingForEmail(false)}
      />
    );
  }

  const dobPickerBlock = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          Date of Birth (18+ Required)
        </Label>
        <span
          className={`text-[11px] font-bold ${
            isUnderage ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {isUnderage ? `${calculatedAge} yrs (Must be 18+)` : `${calculatedAge} yrs ✓`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Select value={birthMonth} onValueChange={setBirthMonth}>
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={birthDay} onValueChange={setBirthDay}>
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            {DAYS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={birthYear} onValueChange={setBirthYear}>
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div id="recaptcha-container" />

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="email" className="font-semibold">
            Gmail Sign Up
          </TabsTrigger>
          <TabsTrigger value="phone" className="font-semibold">
            Phone Sign Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <Form {...emailForm}>
            <form
              onSubmit={emailForm.handleSubmit(createEmailAccount)}
              className="space-y-3.5 pt-3"
            >
              <FormField
                control={emailForm.control}
                name="name"
                render={({ field }) => {
                  const preview = field.value?.trim()
                    ? validateRealFullName(field.value)
                    : null;
                  return (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold">Real Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John Doe"
                          autoComplete="name"
                          maxLength={MAX_FULL_NAME_LEN}
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                      {preview?.valid && preview.formattedName !== field.value.trim() && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Saved as &ldquo;{preview.formattedName}&rdquo;</span>
                        </p>
                      )}
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Gmail Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="yourname@gmail.com"
                        autoComplete="email"
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">
                      We&apos;ll send an activation link to this @gmail.com address.
                    </p>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={emailForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-semibold">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="8+ characters"
                        autoComplete="new-password"
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {dobPickerBlock}

              <FormField
                control={emailForm.control}
                name="consentTermsAndAge"
                render={({ field }) => (
                  <FormItem className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1">
                    <div className="flex items-start gap-2.5">
                      <FormControl>
                        <Checkbox
                          id="signup-email-consent"
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(Boolean(v))}
                          className="mt-0.5"
                        />
                      </FormControl>
                      <label
                        htmlFor="signup-email-consent"
                        className="text-xs leading-snug text-foreground cursor-pointer select-none"
                      >
                        <span className="font-semibold flex items-center gap-1 mb-0.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary inline" />
                          Agreement &amp; 18+ Verification
                        </span>
                        I confirm I am <strong>18+</strong>, using my real full name, and agree to
                        the{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary"
                        >
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary"
                        >
                          Privacy Policy
                        </a>
                        .
                      </label>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold"
                disabled={isLoading || isUnderage}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Creating Account...' : 'Create Account & Send Verification Link'}
              </Button>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="phone">
          {showCodeForm ? (
            <Form {...codeForm}>
              <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4 pt-3">
                <FormField
                  control={codeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-center block text-sm font-semibold">
                        Enter 6-Digit SMS Code
                      </FormLabel>
                      <FormControl>
                        <SixDigitOtpInput
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-center text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-bold"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify &amp; Create Account
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowCodeForm(false)}
                >
                  Back to Phone Number
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...phoneForm}>
              <form
                onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
                className="space-y-3.5 pt-3"
              >
                <FormField
                  control={phoneForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold">Real Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John Doe"
                          maxLength={MAX_FULL_NAME_LEN}
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={phoneForm.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-semibold">Code</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
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
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="col-span-2 space-y-1">
                        <FormLabel className="text-xs font-semibold">Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="801 234 5678"
                            className="h-10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {dobPickerBlock}

                <FormField
                  control={phoneForm.control}
                  name="consentTermsAndAge"
                  render={({ field }) => (
                    <FormItem className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1">
                      <div className="flex items-start gap-2.5">
                        <FormControl>
                          <Checkbox
                            id="signup-phone-consent"
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(Boolean(v))}
                            className="mt-0.5"
                          />
                        </FormControl>
                        <label
                          htmlFor="signup-phone-consent"
                          className="text-xs leading-snug text-foreground cursor-pointer select-none"
                        >
                          I confirm I am <strong>18+</strong>, using my real full name, and agree to
                          the{' '}
                          <a
                            href="/terms"
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-primary"
                          >
                            Terms
                          </a>{' '}
                          and{' '}
                          <a
                            href="/privacy"
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-primary"
                          >
                            Privacy Policy
                          </a>
                          .
                        </label>
                      </div>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-bold"
                  disabled={isLoading || isUnderage}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send SMS Verification Code
                </Button>
              </form>
            </Form>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground pt-1">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onShowSignIn}
          className="font-bold text-primary hover:underline"
        >
          Sign In
        </button>
      </p>
    </div>
  );
}
