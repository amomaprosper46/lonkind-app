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
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries } from '@/lib/countries';
import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

declare global {
  interface Window {
    confirmationResult?: ConfirmationResult;
  }
}

const formSchema = z.object({
  identifier: z.string().min(1, { message: 'Please enter your email or phone number.' }),
  password: z.string().optional(),
});

const phoneFormSchema = z.object({
    phone: z.string().regex(/^\+\d{10,}$/, { message: 'Please enter a valid phone number with country code (e.g., +11234567890).'}),
    deliveryMethod: z.enum(['sms', 'notification', 'whatsapp'], { required_error: 'You need to select a delivery method.' }),
});

const codeFormSchema = z.object({
    code: z.string().min(6, { message: 'Code must be 6 digits.'}),
});


type SignInFormProps = {
  onSignIn: () => void;
  onForgotPassword: () => void;
  onShowSignUp: () => void;
};

export function SignInForm({ onSignIn, onForgotPassword, onShowSignUp }: SignInFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [authMode, setAuthMode] = useState<'email-password' | 'phone-code'>('email-password');
  const [showCodeForm, setShowCodeForm] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
      resolver: zodResolver(phoneFormSchema),
      defaultValues: { phone: '', deliveryMethod: 'sms' },
  });

  const codeForm = useForm<z.infer<typeof codeFormSchema>>({
      resolver: zodResolver(codeFormSchema),
      defaultValues: { code: '' },
  });
  
  const isEmail = (identifier: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (isEmail(data.identifier)) {
        // Email sign in
        if (!data.password) {
            form.setError('password', { type: 'manual', message: 'Password is required.' });
            setIsLoading(false);
            return;
        }
        try {
            await signInWithEmailAndPassword(auth, data.identifier, data.password);
            toast({
                title: 'Signed In!',
                description: "Welcome back!",
            });
            onSignIn();
        } catch(error: any) {
            toast({
                variant: "destructive",
                title: 'Sign In Failed',
                description: "Invalid credentials. Please check your email and password.",
            });
        } finally {
            setIsLoading(false);
        }
    } else {
        // Not an email, likely a phone number
        toast({
            variant: 'default',
            title: 'Phone Number Detected',
            description: 'To sign in with your phone, please use the "Sign In with Phone" option below.',
        });
        setIsLoading(false);
    }
  }

  async function onPhoneSubmit(data: z.infer<typeof phoneFormSchema>) {
    setIsLoading(true);

    if (data.deliveryMethod === 'whatsapp') {
        toast({
            title: 'Coming Soon!',
            description: `WhatsApp delivery is not yet available. Please select another method.`,
        });
        setIsLoading(false);
        return;
    }
    
    if (data.deliveryMethod === 'notification') {
        // Simulate sending a notification. In a real app, this would use FCM.
        console.log("Simulating sending a push notification for verification...");
        toast({
            title: 'In-App Notification Sent',
            description: `A verification code has been sent as a Lonkind notification. For this demo, we'll proceed with SMS.`,
        });
    }

    try {
      const verifier = window.recaptchaVerifier;
      if (!verifier) {
          throw new Error('Recaptcha verifier not initialized');
      }
      const fullPhoneNumber = data.phone;
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, verifier);
      window.confirmationResult = confirmationResult;
      setShowCodeForm(true);
      toast({ title: "Verification code sent!", description: `A code has been sent via SMS to ${fullPhoneNumber}.` });
    } catch(error) {
        console.error("Phone auth error: ", error);
        toast({ variant: 'destructive', title: 'Could not send code', description: 'Please check the phone number and try again.'});
    } finally {
        setIsLoading(false);
    }
  }

  async function onCodeSubmit(data: z.infer<typeof codeFormSchema>) {
      setIsLoading(true);
      try {
          const confirmationResult = window.confirmationResult;
          if (!confirmationResult) {
              throw new Error('No confirmation result found.');
          }
          await confirmationResult.confirm(data.code);
          toast({ title: 'Signed In!', description: 'Welcome back!'});
          onSignIn();
      } catch(error) {
           console.error("Code verification error: ", error);
           toast({ variant: 'destructive', title: 'Verification Failed', description: 'The code you entered is invalid. Please try again.'});
      } finally {
           setIsLoading(false);
      }
  }
  
  if (authMode === 'phone-code') {
    return (
        <>
            {showCodeForm ? (
                 <Form {...codeForm}>
                    <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={codeForm.control}
                            name="code"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Verification Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="123456" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Verify & Sign In
                        </Button>
                        <Button variant="link" size="sm" className="w-full" onClick={() => setShowCodeForm(false)}>Use a different phone number</Button>
                    </form>
                </Form>
             ) : (
                <Form {...phoneForm}>
                    <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={phoneForm.control}
                            name="phone"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                    <Input type="tel" placeholder="+11234567890" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={phoneForm.control}
                            name="deliveryMethod"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>How to get the code?</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-col space-y-1"
                                        >
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="sms" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            SMS message
                                            </FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="whatsapp" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            WhatsApp Message
                                            </FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="notification" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            Lonkind Notification
                                            </FormLabel>
                                        </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Code
                        </Button>
                    </form>
                </Form>
             )}
             <div className="mt-4 text-center text-sm">
                <Button variant="link" className="p-0 h-auto" onClick={() => setAuthMode('email-password')}>
                    Sign in with Email instead
                </Button>
            </div>
             <div className="mt-4 text-center text-sm">
                Don't have an account?{" "}
                <Button variant="link" className="p-0 h-auto" onClick={onShowSignUp}>
                    Sign up
                </Button>
            </div>
        </>
    );
  }

  return (
    <>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input type="text" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <div className="flex justify-between items-center">
                        <FormLabel>Password</FormLabel>
                        <Button variant="link" size="sm" className="p-0 h-auto" type="button" onClick={onForgotPassword}>Forgot Password?</Button>
                    </div>
                    <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                </Button>
            </form>
        </Form>
        <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs text-muted-foreground">OR</span>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setAuthMode('phone-code')}>
            Sign In with Phone
        </Button>
        <div className="mt-4 text-center text-sm">
            Don't have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={onShowSignUp}>
                Sign up
            </Button>
        </div>
    </>
  );
}

  

    
