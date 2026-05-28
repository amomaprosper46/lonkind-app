
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { type User, updateProfile } from 'firebase/auth';
import { addDummyFriends } from '@/ai/flows/add-dummy-friends';
import placeholderImages from '@/lib/placeholder-images.json';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SignUpWizardProps {
  user: User;
  onProfileCreated: () => void;
}

export default function SignUpWizard({ user, onProfileCreated }: SignUpWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user.displayName || '');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState<Date | undefined>();
  const [agreed, setAgreed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = () => {
    if (step === 1 && name.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Invalid Name', description: 'Please enter a name with at least 2 characters.' });
      return;
    }
    if (step === 2 && !gender) {
      toast({ variant: 'destructive', title: 'Gender Required', description: 'Please select a gender.' });
      return;
    }
    if (step === 3 && !dob) {
      toast({ variant: 'destructive', title: 'Date of Birth Required', description: 'Please select your date of birth.' });
      return;
    }
    setStep(prev => prev + 1);
  };
  
  const handleFinish = async () => {
    if (!agreed) {
        toast({ variant: 'destructive', title: 'Agreement Required', description: 'You must agree to the terms to continue.' });
        return;
    }
    setIsSaving(true);
    try {
        const usersRef = collection(db, 'users');
        let finalHandle = '';
        let isHandleUnique = false;
        const baseHandle = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        for (let i = 0; i < 10; i++) {
            const handleCandidate = baseHandle + Math.floor(100 + Math.random() * 900);
            const q = query(usersRef, where('handle', '==', handleCandidate));
            const handleDoc = await getDocs(q);
            if (handleDoc.empty) {
                finalHandle = handleCandidate;
                isHandleUnique = true;
                break;
            }
        }

        if (!isHandleUnique) {
             toast({ variant: 'destructive', title: 'Could not create handle', description: 'Could not generate a unique handle. Please try again.' });
             setIsSaving(false);
             return;
        }

        const avatarUrl = placeholderImages.avatar.url.replace('<seed>', name.charAt(0).toUpperCase());
        const isProfessionalAccount = user.email?.toLowerCase() === 'admin@lonkind.com';

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            handle: finalHandle,
            avatarUrl: avatarUrl,
            email: user.email?.toLowerCase() || null,
            phoneNumber: user.phoneNumber || null,
            gender: gender,
            dateOfBirth: dob ? Timestamp.fromDate(dob) : null,
            isProfessional: isProfessionalAccount,
            bio: isProfessionalAccount ? 'CEO of Lonkind. Connecting the world, one idea at a time.' : 'Hey there! I am using Lonkind.',
            friendsCount: 0,
            balance: isProfessionalAccount ? 123.45 : 0,
            coins: 100,
            diamonds: 0,
        });

        await updateProfile(user, { displayName: name, photoURL: avatarUrl });

        if (isProfessionalAccount) {
            await addDummyFriends({ userId: user.uid, count: 500 });
            await setDoc(doc(db, 'admins', user.uid), { addedAt: new Date() });
        }

        toast({ title: 'Welcome to Lonkind!', description: `Your profile has been created with handle @${finalHandle}` });
        onProfileCreated();

    } catch (error) {
        console.error("Error creating profile:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create your profile.' });
    } finally {
        setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <>
            <DialogHeader>
              <DialogTitle>Welcome! What's your name?</DialogTitle>
              <DialogDescription>This will be your display name on Lonkind.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Jane Doe" />
            </div>
            <DialogFooter>
              <Button onClick={handleNext}>Next</Button>
            </DialogFooter>
          </>
        );
      case 2:
        return (
          <>
            <DialogHeader>
              <DialogTitle>What's your gender?</DialogTitle>
              <DialogDescription>This helps us personalize your experience.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <RadioGroup value={gender} onValueChange={setGender}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other">Prefer not to say</Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleNext}>Next</Button>
            </DialogFooter>
          </>
        );
      case 3:
        return (
          <>
            <DialogHeader>
              <DialogTitle>When's your birthday?</DialogTitle>
              <DialogDescription>Your birthday will not be public.</DialogDescription>
            </DialogHeader>
            <div className="py-4 flex justify-center">
               <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-[280px] justify-start text-left font-normal",
                            !dob && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dob ? format(dob, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={dob}
                        onSelect={setDob}
                        disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleNext}>Next</Button>
            </DialogFooter>
          </>
        );
      case 4:
        return (
          <>
            <DialogHeader>
              <DialogTitle>One last step</DialogTitle>
              <DialogDescription>Please review and agree to our terms.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 text-sm text-muted-foreground">
                <p>Your account is secured and verified via the {user.email ? 'email address' : 'phone number'} you provided.</p>
                <p>By creating an account, you agree to our <Link href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/rules" target="_blank" className="text-primary hover:underline">Community Guidelines</Link>.</p>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(!!checked)} />
                    <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        I have read and agree to the terms.
                    </label>
                </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleFinish} disabled={isSaving || !agreed}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Finish and Create Account
              </Button>
            </DialogFooter>
          </>
        );
      default:
        return null;
    }
  };
  
  return (
    <Dialog open={true}>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
