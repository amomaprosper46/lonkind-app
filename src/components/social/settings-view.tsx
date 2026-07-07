'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  LogOut, 
  Loader2, 
  HelpCircle, 
  Wallet,
  Shield, 
  Users, 
  Settings as SettingsIcon, 
  EyeOff, 
  UserX 
} from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { submitSupportTicket } from '@/ai/flows/submit-support-ticket';
import { toast } from '@/hooks/use-toast';
import type { ProfileData } from './edit-profile-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '../ui/switch';
import WalletView from './wallet-view';
import type { CurrentUser } from './social-dashboard';

interface BlockedUserItem {
  uid: string;
  name: string;
  handle: string;
}

interface SettingsViewProps {
  user: CurrentUser;
  onSignOut: () => void;
  onUpdateProfile: (data: ProfileData) => Promise<boolean>;
  onPasswordReset: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  blockedUsers?: BlockedUserItem[];
  onUnblockUser?: (uid: string) => Promise<void>;
}

const supportFormSchema = z.object({
  subject: z.string().min(5, { message: "Subject must be at least 5 characters." }),
  message: z.string().min(20, { message: "Message must be at least 20 characters." }),
});

export default function SettingsView({ 
  user, 
  onSignOut, 
  onUpdateProfile, 
  onPasswordReset, 
  onDeleteAccount,
  blockedUsers = [],
  onUnblockUser
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [isUnblockingMap, setIsUnblockingMap] = useState<Record<string, boolean>>({});
  
  const [lastSeenVisible, setLastSeenVisible] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [isFollowersPrivate, setIsFollowersPrivate] = useState(user.followerPrivacy === 'private');

  const handleFollowerPrivacyChange = async (checked: boolean) => {
    setIsFollowersPrivate(checked);
    try {
        await onUpdateProfile({ followerPrivacy: checked ? 'private' : 'public' });
        toast({ title: 'Privacy Updated', description: 'Your follower list privacy has been updated.' });
    } catch (err) {
        setIsFollowersPrivate(!checked);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update privacy setting.' });
    }
  };

  // Sync state cleanly if the upstream user payload structure updates dynamically
  useEffect(() => {
    setDisplayName(user.name);
  }, [user.name]);

  const supportForm = useForm<z.infer<typeof supportFormSchema>>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: { subject: '', message: '' },
  });

  const handleNameSave = async () => {
    if (displayName === user.name || displayName.trim() === '') return;
    setIsSavingName(true);
    try {
      await onUpdateProfile({ name: displayName });
      toast({ title: 'Profile Updated', description: 'Your display name has been modified successfully.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Failed to update account display metadata.' });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not execute account removal sequence.' });
      setIsDeleting(false);
    }
  };

  const handleSupportSubmit = async (values: z.infer<typeof supportFormSchema>) => {
    if (!user.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not submit ticket, user email not found.' });
      return;
    }
    setIsSubmittingTicket(true);
    try {
      const result = await submitSupportTicket({
        name: user.name,
        email: user.email,
        subject: values.subject,
        message: values.message,
      });
      toast({ title: 'Ticket Submitted!', description: result?.confirmationMessage || 'Support ticket logged.' });
      supportForm.reset();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not send your support ticket. Please try again later.' });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleLocalUnblock = async (userId: string) => {
    if (!onUnblockUser) return;
    setIsUnblockingMap(prev => ({ ...prev, [userId]: true }));
    try {
      await onUnblockUser(userId);
      toast({ title: 'User Unblocked' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove user from restrictions list.' });
    } finally {
      setIsUnblockingMap(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <main className="col-span-9 space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account, privacy, and app preferences.</p>
      </header>

      <div className="w-full space-y-4">
        {/* Account Information */}
        <Card className="rounded-none sm:rounded-lg shadow-sm border-x-0 sm:border-x">
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" /> Account Settings
            </h2>
          </div>
          <div className="divide-y divide-border/50">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Label className="font-semibold text-base">Display Name</Label>
                <p className="text-sm text-muted-foreground">This is your public name on the app.</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-transparent border-t-0 border-x-0 rounded-none px-0 focus-visible:ring-0 w-full sm:w-[200px]" />
                <Button variant="secondary" size="sm" onClick={handleNameSave} disabled={isSavingName || displayName === user.name || !displayName.trim()}>
                  {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                </Button>
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Label className="font-semibold text-base">Email Address</Label>
                <p className="text-sm text-muted-foreground">{user.email || 'No email associated'}</p>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors" onClick={onPasswordReset}>
              <div>
                <Label className="font-semibold text-base cursor-pointer">Security and Login</Label>
                <p className="text-sm text-muted-foreground">Change your password.</p>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
          </div>
        </Card>

        {/* Privacy and Safety */}
        <Card className="rounded-none sm:rounded-lg shadow-sm border-x-0 sm:border-x">
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" /> Privacy & Safety
            </h2>
          </div>
          <div className="divide-y divide-border/50">
            <div className="p-4 flex items-center justify-between">
              <div>
                <Label className="font-semibold text-base">Active Status</Label>
                <p className="text-sm text-muted-foreground">Show when you're active.</p>
              </div>
              <Switch checked={lastSeenVisible} onCheckedChange={setLastSeenVisible} />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <Label className="font-semibold text-base flex items-center gap-2"><EyeOff className="h-4 w-4" /> Ghost Mode</Label>
                <p className="text-sm text-muted-foreground">Hide your profile views.</p>
              </div>
              <Switch checked={ghostMode} onCheckedChange={setGhostMode} />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <Label className="font-semibold text-base flex items-center gap-2"><Users className="h-4 w-4" /> Follower Privacy</Label>
                <p className="text-sm text-muted-foreground">Hide your followers list from other users.</p>
              </div>
              <Switch checked={isFollowersPrivate} onCheckedChange={handleFollowerPrivacyChange} />
            </div>

            <div className="p-4">
              <Label className="font-semibold text-base flex items-center gap-2 mb-2"><UserX className="h-4 w-4" /> Blocking</Label>
              <p className="text-sm text-muted-foreground mb-3">Review people you've previously blocked.</p>
              {blockedUsers.length > 0 ? (
                <div className="space-y-3 bg-muted/20 rounded-md p-3 border">
                  {blockedUsers.map(blockedUser => (
                    <div key={blockedUser.uid} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{blockedUser.name}</p>
                        <p className="text-xs text-muted-foreground">@{blockedUser.handle}</p>
                      </div>
                      <Button variant="secondary" size="sm" disabled={isUnblockingMap[blockedUser.uid] || !onUnblockUser} onClick={() => handleLocalUnblock(blockedUser.uid)}>
                        {isUnblockingMap[blockedUser.uid] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Unblock'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic border rounded-md bg-muted/10 p-3">No blocked users.</p>
              )}
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="rounded-none sm:rounded-lg shadow-sm border-x-0 sm:border-x">
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Appearance</h2>
          </div>
          <div className="p-4">
            <RadioGroup defaultValue={theme} onValueChange={setTheme} className="flex gap-4">
              {['light', 'dark', 'system'].map((t) => (
                <div key={t} className="flex items-center space-x-2">
                  <RadioGroupItem value={t} id={t} />
                  <Label htmlFor={t} className="capitalize cursor-pointer">{t}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </Card>

        {/* Wallet */}
        <Card className="rounded-none sm:rounded-lg shadow-sm border-x-0 sm:border-x">
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Creator Wallet
            </h2>
          </div>
          <div className="p-4">
             <WalletView currentUser={user} />
          </div>
        </Card>

        {/* Support */}
        <Card className="rounded-none sm:rounded-lg shadow-sm border-x-0 sm:border-x">
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> Help & Support
            </h2>
          </div>
          <div className="p-4">
             <Form {...supportForm}>
                <form onSubmit={supportForm.handleSubmit(handleSupportSubmit)} className="space-y-4">
                  <FormField control={supportForm.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Subject" {...field} className="bg-transparent" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField control={supportForm.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder="How can we help?" rows={3} {...field} className="bg-transparent" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="sm" disabled={isSubmittingTicket} className="w-full sm:w-auto">
                    {isSubmittingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send to Support'}
                  </Button>
                </form>
              </Form>
          </div>
        </Card>
      </div>
      
      <Card className="border-destructive/40 bg-destructive/[0.01] mt-8">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription className="text-destructive/80">These actions are permanent and cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-input bg-background p-4">
            <div>
              <h4 className="font-semibold">Sign Out</h4>
              <p className="text-sm text-muted-foreground">You will be logged out of your account on this device.</p>
            </div>
            <Button variant="outline" onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-background p-4">
            <div>
              <h4 className="font-semibold text-destructive">Delete Account</h4>
              <p className="text-sm text-muted-foreground">Permanently delete your account and all of its data.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}