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

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="account"><SettingsIcon className="mr-2 h-4 w-4" />Account</TabsTrigger>
          <TabsTrigger value="wallet"><Wallet className="mr-2 h-4 w-4" />Wallet</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="privacy"><Shield className="mr-2 h-4 w-4" />Privacy</TabsTrigger>
          <TabsTrigger value="support"><HelpCircle className="mr-2 h-4 w-4" />Support</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Manage your public and private account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email || 'No email associated'} disabled className="bg-muted/40" />
                <p className="text-sm text-muted-foreground">Your email address cannot be changed.</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <div className="flex items-center gap-2">
                  <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  <Button onClick={handleNameSave} disabled={isSavingName || displayName === user.name || !displayName.trim()}>
                    {isSavingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">This is your public display name.</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Password</Label>
                <div>
                  <Button variant="outline" onClick={onPasswordReset}>Change Password</Button>
                </div>
                <p className="text-sm text-muted-foreground">You will be sent an email to reset your password.</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between rounded-lg border border-input p-4">
                <div>
                  <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Active Sessions</h4>
                  <p className="text-sm text-muted-foreground">See and manage where your account is logged in.</p>
                </div>
                <Button variant="outline" disabled>View Devices</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="mt-6">
          <WalletView />
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the app to your preference.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                defaultValue={theme} 
                onValueChange={setTheme}
                className="grid sm:grid-cols-3 gap-4"
              >
                {['light', 'dark', 'system'].map((t) => (
                  <div key={t}>
                    <RadioGroupItem value={t} id={t} className="peer sr-only" />
                    <Label htmlFor={t} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary capitalize cursor-pointer">
                      {t}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="privacy" className="mt-6">
           <Card>
            <CardHeader>
              <CardTitle>Privacy and Safety</CardTitle>
              <CardDescription>Control who can interact with you and your content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-input p-4">
                <div>
                  <h4 className="font-semibold">Show your online status</h4>
                  <p className="text-sm text-muted-foreground">Allow others to see when you are online.</p>
                </div>
                <Switch
                  checked={lastSeenVisible}
                  onCheckedChange={setLastSeenVisible}
                  aria-label="Toggle online status visibility"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-input p-4">
                <div>
                  <h4 className="font-semibold flex items-center gap-2"><EyeOff className="h-4 w-4 text-muted-foreground" /> Ghost Mode</h4>
                  <p className="text-sm text-muted-foreground">When enabled, your views on profiles and content will not be counted or shown.</p>
                </div>
                <Switch
                  checked={ghostMode}
                  onCheckedChange={setGhostMode}
                  aria-label="Toggle ghost mode"
                />
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2"><UserX className="h-4 w-4 text-muted-foreground" /> Blocked Users</h4>
                <p className="text-sm text-muted-foreground">Blocked users cannot see your profile, posts, or message you.</p>
                {blockedUsers.length > 0 ? (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      {blockedUsers.map(blockedUser => (
                        <div key={blockedUser.uid} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{blockedUser.name}</p>
                            <p className="text-sm text-muted-foreground">@{blockedUser.handle}</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={isUnblockingMap[blockedUser.uid] || !onUnblockUser}
                            onClick={() => handleLocalUnblock(blockedUser.uid)}
                          >
                            {isUnblockingMap[blockedUser.uid] && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Unblock
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground italic p-4 text-center border rounded-lg bg-muted/20">You haven't blocked any users.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Help & Support</CardTitle>
              <CardDescription>Contact our support team for assistance.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...supportForm}>
                <form onSubmit={supportForm.handleSubmit(handleSupportSubmit)} className="space-y-4">
                  <FormField
                    control={supportForm.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Issue with my transaction" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supportForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Please describe your issue in detail..." rows={5} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSubmittingTicket}>
                    {isSubmittingTicket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Message
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
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