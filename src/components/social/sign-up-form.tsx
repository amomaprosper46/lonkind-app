'use client';

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
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle2, Calendar, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signInWithCustomToken, RecaptchaVerifier } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries } from '@/lib/countries';
import { SixDigitOtpInput } from './six-digit-otp-input';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const emailFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

const phoneFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  countryCode: z.string().min(1, 'Please select a country.'),
  phone: z.string().min(5, { message: 'Please enter a valid phone number.' }),
});

const codeFormSchema = z.object({
  code: z.string().min(6, { message: 'Code must be 6 digits.' }),
});

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

type SignUpFormProps = {
  onSignUp: () => void;
  onShowSignIn: () => void;
};

export function SignUpForm({ onSignUp, onShowSignIn }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingForEmail, setIsWaitingForEmail] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [showAgeStep, setShowAgeStep] = useState(false);
  const [phoneAuthData, setPhoneAuthData] = useState<{ name: string; phone: string } | null>(null);

  // Age verification state (Facebook style)
  const [birthMonth, setBirthMonth] = useState('01');
  const [birthDay, setBirthDay] = useState('01');
  const [birthYear, setBirthYear] = useState('2000');

  React.useEffect(() => {
    if (!window.recaptchaVerifier && auth) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, []);

  // Poll for email verification every 3 seconds
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaitingForEmail) {
      interval = setInterval(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            setIsWaitingForEmail(false);
            toast({ title: '🎉 Email Verified!', description: 'Please enter your date of birth to complete your profile.' });
            setShowAgeStep(true);
          }
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWaitingForEmail]);

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { name: '', countryCode: '+234', phone: '' },
  });

  const codeForm = useForm<z.infer<typeof codeFormSchema>>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  });

  const createEmailAccount = async (data: z.infer<typeof emailFormSchema>) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: data.name }).catch(() => {});

      // Ensure initial Firestore user document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        const baseHandle = (data.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user') + '_' + user.uid.slice(-4);
        await setDoc(userDocRef, {
          uid: user.uid,
          name: data.name,
          handle: baseHandle,
          email: data.email,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`,
          isProfessional: false,
          bio: 'Hey there! I am using Lonkind.',
          followersCount: 0,
          followingCount: 0,
          balance: 0,
          coins: 0,
          diamonds: 0,
          createdAt: new Date().toISOString(),
        });
      }

      await sendEmailVerification(user).catch(() => {});

      toast({
        title: '📧 Verification Email Sent!',
        description: 'Please check your inbox and click the link to verify your email address.',
      });

      setIsWaitingForEmail(true);
    } catch (error: any) {
      let errorMessage = 'Something went wrong. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already in use by another account.';
      } else if (error.message) {
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

  const handleManualEmailCheck = async () => {
    setIsLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setIsWaitingForEmail(false);
          toast({ title: '🎉 Email Verified!', description: 'Please complete your date of birth.' });
          setShowAgeStep(true);
        } else {
          toast({
            variant: 'destructive',
            title: 'Not Verified Yet',
            description: 'Your email has not been verified yet. Please check your inbox and click the link.',
          });
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        toast({ title: 'Email Sent', description: 'A new verification link has been sent to your email.' });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Could not send email', description: err.message });
      }
    }
  };

  async function onPhoneSubmit(data: z.infer<typeof phoneFormSchema>) {
    setIsLoading(true);
    let rawDigits = data.phone.replace(/\D/g, '');
    if (rawDigits.startsWith('0')) {
      rawDigits = rawDigits.slice(1);
    }
    const fullPhoneNumber = data.countryCode + rawDigits;
    setPhoneAuthData({ name: data.name, phone: fullPhoneNumber });

    try {
      const res = await fetch('/api/sendchamp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
          channel: 'sms',
        }),
      });

      let resData: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        resData = await res.json();
      } else {
        const textResponse = await res.text();
        console.error('Non-JSON send-otp response:', textResponse);
        throw new Error('Server temporarily busy. Please try again.');
      }

      if (!res.ok || resData.error) {
        throw new Error(resData.error || 'Could not send verification code.');
      }

      setShowCodeForm(true);

      toast({
        title: '📱 Verification Code Sent!',
        description: resData.message || `A 6-digit verification code has been sent via SMS to ${fullPhoneNumber}.`,
      });
    } catch (error: any) {
      console.error('Phone sign up error: ', error);
      toast({
        variant: 'destructive',
        title: 'Phone Sign Up Error',
        description: error.message || 'Could not send verification code. Please try again.',
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
        }),
      });

      let resData: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        resData = await res.json();
      } else {
        const textResponse = await res.text();
        console.error('Non-JSON verify-otp response:', textResponse);
        throw new Error('Server response format error. Please try again.');
      }

      if (!res.ok || resData.error || !resData.customToken) {
        throw new Error(resData.error || 'Verification failed.');
      }

      // Sign in using custom token
      const userCredential = await signInWithCustomToken(auth, resData.customToken);
      const user = userCredential.user;

      if (user && phoneAuthData.name) {
        await updateProfile(user, { displayName: phoneAuthData.name }).catch(() => {});
      }

      toast({ title: '🎉 Phone Verified!', description: 'Please complete your date of birth.' });
      setShowCodeForm(false);
      setShowAgeStep(true);
    } catch (error: any) {
      console.error('Code verification error: ', error);
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: error.message || 'The code you entered is invalid. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate age from selected Date of Birth
  const calculateAge = () => {
    const dob = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const handleAgeSubmit = async () => {
    const calculatedAge = calculateAge();
    if (calculatedAge < 13) {
      toast({
        variant: 'destructive',
        title: 'Age Requirement Notice',
        description: 'You must be at least 13 years old to create an account on Lonkind.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const dateOfBirth = `${birthYear}-${birthMonth}-${birthDay}`;
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          dateOfBirth,
          age: calculatedAge,
          birthMonth: parseInt(birthMonth),
          birthDay: parseInt(birthDay),
          birthYear: parseInt(birthYear),
          updatedAt: new Date().toISOString(),
        }).catch(async () => {
          // If doc doesn't exist yet, set it
          await setDoc(userDocRef, {
            uid: currentUser.uid,
            name: currentUser.displayName || 'Lonkind User',
            email: currentUser.email || '',
            dateOfBirth,
            age: calculatedAge,
            createdAt: new Date().toISOString(),
          }, { merge: true });
        });

        toast({ title: '🎉 Profile Complete!', description: 'Welcome to Lonkind!' });
        onSignUp();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'User session not found.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Age Update Failed', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div id="recaptcha-container"></div>

      {showAgeStep ? (
        // Facebook-Style Age Verification Screen
        <div className="flex flex-col space-y-6 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Calendar className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">What's your date of birth?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your date of birth. This helps keep Lonkind safe for creators.
            </p>
          </div>

          <div className="space-y-4 text-left max-w-sm mx-auto w-full">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Date of Birth</Label>
            <div className="grid grid-cols-3 gap-2">
              {/* Month */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Month</Label>
                <Select value={birthMonth} onValueChange={setBirthMonth}>
                  <SelectTrigger className="h-12 border-slate-300 dark:border-slate-700">
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
              </div>

              {/* Day */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Day</Label>
                <Select value={birthDay} onValueChange={setBirthDay}>
                  <SelectTrigger className="h-12 border-slate-300 dark:border-slate-700">
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
              </div>

              {/* Year */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Year</Label>
                <Select value={birthYear} onValueChange={setBirthYear}>
                  <SelectTrigger className="h-12 border-slate-300 dark:border-slate-700">
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

            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground font-medium">Calculated Age:</span>
              <span className="font-bold text-primary text-base">{calculateAge()} years old</span>
            </div>
          </div>

          <Button onClick={handleAgeSubmit} className="w-full h-12 text-base font-semibold" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Complete Sign Up & Continue
          </Button>
        </div>
      ) : isWaitingForEmail ? (
        // Email Verification Waiting Screen
        <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-8 w-8 animate-bounce" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Check Your Email Inbox</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              We sent a verification link to your email address. Please open your email and click the verification link to proceed.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Listening for verification link...</span>
          </div>

          <div className="space-y-2 w-full pt-2">
            <Button onClick={handleManualEmailCheck} className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              I've Verified My Email
            </Button>

            <Button variant="outline" size="sm" className="w-full" onClick={handleResendEmail}>
              Resend Verification Email
            </Button>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="phone">Phone</TabsTrigger>
          </TabsList>
          <TabsContent value="email">
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(createEmailAccount)} className="space-y-4 pt-4">
                <FormField
                  control={emailForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="8+ characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="phone">
            {showCodeForm ? (
              <Form {...codeForm}>
                <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={codeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-center block text-sm font-semibold">Enter 6-Digit SMS Code</FormLabel>
                        <FormControl>
                          <SixDigitOtpInput
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify Code & Continue
                  </Button>
                  <Button variant="link" size="sm" className="w-full" onClick={() => setShowCodeForm(false)}>
                    Use a different phone number
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={phoneForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <div className="flex gap-2">
                      <FormField
                        control={phoneForm.control}
                        name="countryCode"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-28">
                                <SelectValue placeholder="Code" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country.code} value={country.dial_code}>
                                  {country.code} ({country.dial_code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FormField
                        control={phoneForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormControl>
                            <Input type="tel" placeholder="123 456 7890" {...field} />
                          </FormControl>
                        )}
                      />
                    </div>
                    <p className="text-sm font-medium text-destructive">
                      {phoneForm.formState.errors.phone?.message || phoneForm.formState.errors.countryCode?.message}
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send SMS Code
                  </Button>
                </form>
              </Form>
            )}
          </TabsContent>
        </Tabs>
      )}

      <div className="mt-4 text-center text-sm space-y-2">
        <div>
          Already have an account?{' '}
          <Button variant="link" className="p-0 h-auto" onClick={onShowSignIn}>
            Sign in
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          By signing up, you agree to our{' '}
          <a href="/terms" target="_blank" className="underline hover:text-primary">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" className="underline hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </>
  );
}
