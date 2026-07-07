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
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signInWithPhoneNumber, ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore"; 
import { addDummyFollowers } from '@/ai/flows/add-dummy-followers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries } from '@/lib/countries';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

const emailFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.'}),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

const phoneFormSchema = z.object({
    name: z.string().min(2, { message: 'Name must be at least 2 characters.'}),
    countryCode: z.string().min(1, "Please select a country."),
    phone: z.string().min(5, { message: 'Please enter a valid phone number.'})
});

const codeFormSchema = z.object({
    code: z.string().min(6, { message: 'Code must be 6 digits.'}),
});

type SignUpFormProps = {
    onSignUp: () => void;
    onShowSignIn: () => void;
};

export function SignUpForm({ onSignUp, onShowSignIn }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingForEmail, setIsWaitingForEmail] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [phoneAuthData, setPhoneAuthData] = useState<{name: string, phone: string} | null>(null);
  
  React.useEffect(() => {
      if (!window.recaptchaVerifier && auth) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible'
          });
      }
  }, []);

  React.useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isWaitingForEmail) {
          interval = setInterval(async () => {
              if (auth.currentUser) {
                  await auth.currentUser.reload();
                  if (auth.currentUser.emailVerified) {
                      clearInterval(interval);
                      setIsWaitingForEmail(false);
                      toast({ title: 'Email Verified!', description: 'Welcome to Lonkind!' });
                      onSignUp();
                  }
              }
          }, 3000); // Check every 3 seconds
      }
      return () => { if (interval) clearInterval(interval); }
  }, [isWaitingForEmail, onSignUp]);
  
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
        
        await updateProfile(user, { displayName: data.name });
        
        await sendEmailVerification(user);
        
        toast({
            title: 'Verification Email Sent!',
            description: "Please check your inbox to verify your email. This screen will automatically proceed once you click the link.",
        });

        setIsWaitingForEmail(true);

    } catch (error: any) {
         const errorCode = error.code;
         let errorMessage = "Something went wrong. Please try again.";
         if (errorCode === 'auth/email-already-in-use') {
            errorMessage = "This email address is already in use by another account.";
         }
         toast({
            variant: "destructive",
            title: 'Sign Up Failed',
            description: errorMessage,
        });
    } finally {
        setIsLoading(false);
    }
  };

  async function onPhoneSubmit(data: z.infer<typeof phoneFormSchema>) {
    setIsLoading(true);

    try {
      const verifier = window.recaptchaVerifier;
      if (!verifier) throw new Error('Recaptcha verifier not initialized');
      
      const fullPhoneNumber = data.countryCode + data.phone.replace(/\D/g, '');
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, verifier);
      window.confirmationResult = confirmationResult;

      setPhoneAuthData({ name: data.name, phone: fullPhoneNumber });
      setShowCodeForm(true);
      toast({ title: "Verification code sent!", description: `A code has been sent via SMS to ${fullPhoneNumber}.` });

    } catch(error) {
        console.error("Phone auth error: ", error);
        toast({ variant: 'destructive', title: 'Could not send code', description: 'This phone number may already be in use or is invalid.'});
    } finally {
        setIsLoading(false);
    }
  }

  async function onCodeSubmit(data: z.infer<typeof codeFormSchema>) {
      setIsLoading(true);
      try {
          const confirmationResult = window.confirmationResult;
          if (!confirmationResult || !phoneAuthData) throw new Error('No confirmation result found.');
          
          const userCredential = await confirmationResult.confirm(data.code);
          const user = userCredential.user;
          
          // User is now authenticated. `onAuthStateChanged` in social-home-page will detect them
          // as a new user and show the WelcomeDialog. We just need to update their name.
          await updateProfile(user, { displayName: phoneAuthData.name });
          
          toast({ title: 'Account Verified!', description: 'Welcome to Lonkind!'});
          onSignUp(); // Triggers the parent to close the auth card.

      } catch(error) {
           console.error("Code verification error: ", error);
           toast({ variant: 'destructive', title: 'Verification Failed', description: 'The code you entered is invalid. Please try again.'});
      } finally {
           setIsLoading(false);
      }
  }

  return (
    <>
        <div id="recaptcha-container"></div>
        {isWaitingForEmail ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div>
                    <h3 className="text-xl font-bold">Waiting for Verification</h3>
                    <p className="text-muted-foreground mt-2 max-w-[250px]">
                        We sent a verification link to your email. Please check your inbox and click the link. 
                        This screen will automatically disappear once verified.
                    </p>
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
                                Verify & Create Account
                            </Button>
                             <Button variant="link" size="sm" className="w-full" onClick={() => setShowCodeForm(false)}>Use a different phone number</Button>
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
                                                    {countries.map(country => (
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
                                <p className="text-sm font-medium text-destructive">{phoneForm.formState.errors.phone?.message || phoneForm.formState.errors.countryCode?.message}</p>
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
        <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={onShowSignIn}>
                Sign in
            </Button>
        </div>
    </>
  );
}
