'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  LogOut,
  Loader2,
  HelpCircle,
  Wallet,
  Shield,
  Users,
  Settings as SettingsIcon,
  EyeOff,
  UserX,
  KeyRound,
  Palette,
  Sun,
  Moon,
  Monitor,
  ExternalLink,
  Mail,
  User,
  Trash2,
  Camera,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { Form, FormControl, FormField, FormItem } from '../ui/form';
import { submitSupportTicket } from '@/ai/flows/submit-support-ticket';
import { toast } from '@/hooks/use-toast';
import type { ProfileData } from './edit-profile-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '../ui/switch';
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
  onGoToWallet?: () => void;
}

const supportFormSchema = z.object({
  subject: z.string().min(5, { message: 'Subject must be at least 5 characters.' }),
  message: z.string().min(20, { message: 'Message must be at least 20 characters.' }),
});

export default function SettingsView({
  user,
  onSignOut,
  onUpdateProfile,
  onPasswordReset,
  onDeleteAccount,
  blockedUsers = [],
  onUnblockUser,
  onGoToWallet,
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [businessUrl, setBusinessUrl] = useState(user.businessUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
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
    } catch {
      setIsFollowersPrivate(!checked);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update privacy setting.' });
    }
  };

  useEffect(() => {
    setDisplayName(user.name);
    setBio(user.bio || '');
    setBusinessUrl(user.businessUrl || '');
  }, [user.name, user.bio, user.businessUrl]);

  const supportForm = useForm<z.infer<typeof supportFormSchema>>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: { subject: '', message: '' },
  });

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleProfileSave = async () => {
    if (!displayName.trim()) return;
    setIsSavingProfile(true);
    try {
      const ok = await onUpdateProfile({
        name: displayName.trim(),
        bio: bio.trim(),
        businessUrl: businessUrl.trim(),
        ...(avatarFile ? { avatarFile } : {}),
      });
      if (ok) {
        setAvatarFile(null);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Failed to update account profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not delete your account.' });
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
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'Could not send your support ticket. Please try again later.',
      });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleLocalUnblock = async (userId: string) => {
    if (!onUnblockUser) return;
    setIsUnblockingMap((prev) => ({ ...prev, [userId]: true }));
    try {
      await onUnblockUser(userId);
      toast({ title: 'User Unblocked' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to unblock user.' });
    } finally {
      setIsUnblockingMap((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const hasProfileChanges =
    displayName.trim() !== user.name ||
    bio.trim() !== (user.bio || '') ||
    businessUrl.trim() !== (user.businessUrl || '') ||
    avatarFile !== null;

  return (
    <div className="w-full space-y-6">
      {/* Top Profile & Settings Banner */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-indigo-950/40 to-slate-900/95 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label htmlFor="settings-avatar-upload" className="relative cursor-pointer group shrink-0" title="Click to change profile picture">
              <Avatar className="h-14 w-14 border-2 border-indigo-500/50 shadow-lg group-hover:opacity-85 transition-opacity">
                <AvatarImage src={avatarPreviewUrl || user.avatarUrl} alt={user.name} />
                <AvatarFallback className="bg-indigo-600 text-white font-bold text-lg">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md border border-slate-900">
                <Camera className="h-3.5 w-3.5" />
              </span>
              <input
                id="settings-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </label>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
                  {user.name}
                </h1>
                <Badge variant="secondary" className="text-xs font-semibold">
                  @{user.handle}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                {user.email || 'Manage your account, privacy, appearance, and support preferences.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {onGoToWallet && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToWallet}
                className="rounded-xl gap-1.5 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10"
              >
                <Wallet className="h-4 w-4" />
                <span>Wallet</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className="rounded-xl gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Organized Settings Tabs */}
      <Tabs defaultValue="account" className="w-full space-y-5">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1.5 gap-1.5 bg-slate-900/90 border border-border/60 rounded-2xl">
          <TabsTrigger
            value="account"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <User className="h-4 w-4 shrink-0" />
            <span>Account</span>
          </TabsTrigger>

          <TabsTrigger
            value="privacy"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span>Privacy & Safety</span>
          </TabsTrigger>

          <TabsTrigger
            value="appearance"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <Palette className="h-4 w-4 shrink-0" />
            <span>Appearance</span>
          </TabsTrigger>

          <TabsTrigger
            value="support"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>Help & Legal</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ACCOUNT & SECURITY */}
        <TabsContent value="account" className="space-y-5 mt-0 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-indigo-400" />
                Profile & Account Details
              </CardTitle>
              <CardDescription className="text-xs">
                Update how your name, bio, and links appear across Lonkind.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Profile Picture Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-indigo-500/40">
                    <AvatarImage src={avatarPreviewUrl || user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="bg-indigo-600 text-white font-bold">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">Profile Picture</p>
                    <p className="text-xs text-muted-foreground">
                      Updating your photo automatically updates all your past posts, comments, messages, and friends lists.
                    </p>
                  </div>
                </div>
                <label htmlFor="settings-avatar-upload-btn" className="cursor-pointer shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-600/30 transition-colors">
                    <Camera className="h-3.5 w-3.5" />
                    {avatarFile ? 'Photo Selected' : 'Upload New Photo'}
                  </span>
                  <input
                    id="settings-avatar-upload-btn"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-display-name" className="text-xs font-semibold">
                    Display Name
                  </Label>
                  <Input
                    id="settings-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    className="rounded-xl bg-secondary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email Address
                  </Label>
                  <Input
                    value={user.email || 'No email associated'}
                    disabled
                    className="rounded-xl bg-secondary/20 opacity-75 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-bio" className="text-xs font-semibold">
                  Bio
                </Label>
                <Textarea
                  id="settings-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the community a little about yourself..."
                  rows={2}
                  className="rounded-xl bg-secondary/40 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-website" className="text-xs font-semibold">
                  Website or Business Link
                </Label>
                <Input
                  id="settings-website"
                  value={businessUrl}
                  onChange={(e) => setBusinessUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="rounded-xl bg-secondary/40"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleProfileSave}
                  disabled={isSavingProfile || !hasProfileChanges || !displayName.trim()}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Login & Security Card */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                Password & Security
              </CardTitle>
              <CardDescription className="text-xs">
                Manage your account password and active session.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 p-0">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">Reset Password</p>
                  <p className="text-xs text-muted-foreground">
                    Send a secure password reset link to {user.email || 'your email'}.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onPasswordReset} className="rounded-xl self-start sm:self-center">
                  Send Reset Email
                </Button>
              </div>

              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-950/10">
                <div>
                  <p className="font-semibold text-sm text-rose-400 flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4" />
                    Delete Account Permanently
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove your profile, posts, and account data.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting} className="rounded-xl self-start sm:self-center">
                      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PRIVACY & SAFETY */}
        <TabsContent value="privacy" className="space-y-5 mt-0 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                Visibility & Privacy Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Control who can see your online activity and follower list.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 p-0">
              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div>
                  <Label className="font-semibold text-sm">Active Status</Label>
                  <p className="text-xs text-muted-foreground">Show when you are active on Lonkind.</p>
                </div>
                <Switch checked={lastSeenVisible} onCheckedChange={setLastSeenVisible} />
              </div>

              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div>
                  <Label className="font-semibold text-sm flex items-center gap-1.5">
                    <EyeOff className="h-4 w-4 text-indigo-400" />
                    Ghost Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">Browse profiles privately without leaving view traces.</p>
                </div>
                <Switch checked={ghostMode} onCheckedChange={setGhostMode} />
              </div>

              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div>
                  <Label className="font-semibold text-sm flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-purple-400" />
                    Private Followers List
                  </Label>
                  <p className="text-xs text-muted-foreground">Hide your followers list from other users on your profile.</p>
                </div>
                <Switch checked={isFollowersPrivate} onCheckedChange={handleFollowerPrivacyChange} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserX className="h-4 w-4 text-rose-400" />
                Blocked Accounts ({blockedUsers.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Blocked users cannot message you or interact with your posts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {blockedUsers.length > 0 ? (
                <div className="space-y-2.5">
                  {blockedUsers.map((blockedUser) => (
                    <div
                      key={blockedUser.uid}
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/50"
                    >
                      <div>
                        <p className="font-semibold text-sm">{blockedUser.name}</p>
                        <p className="text-xs text-muted-foreground">@{blockedUser.handle}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        disabled={isUnblockingMap[blockedUser.uid] || !onUnblockUser}
                        onClick={() => handleLocalUnblock(blockedUser.uid)}
                      >
                        {isUnblockingMap[blockedUser.uid] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Unblock'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground">
                  You haven&apos;t blocked any accounts.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: APPEARANCE */}
        <TabsContent value="appearance" className="space-y-5 mt-0 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-indigo-400" />
                Display Theme
              </CardTitle>
              <CardDescription className="text-xs">
                Choose how Lonkind looks on your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'dark', label: 'Dark Mode', desc: 'Sleek midnight theme', icon: Moon },
                  { id: 'light', label: 'Light Mode', desc: 'Crisp daylight theme', icon: Sun },
                  { id: 'system', label: 'System Sync', desc: 'Match device setting', icon: Monitor },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTheme(item.id)}
                      className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-500/15 shadow-md'
                          : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-400' : 'text-muted-foreground'}`} />
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sm text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: HELP & LEGAL */}
        <TabsContent value="support" className="space-y-5 mt-0 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" />
                Contact Help & Support
              </CardTitle>
              <CardDescription className="text-xs">
                Have a question or issue? Send a ticket directly to our team.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <Form {...supportForm}>
                <form onSubmit={supportForm.handleSubmit(handleSupportSubmit)} className="space-y-4">
                  <FormField
                    control={supportForm.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-xs font-semibold">Subject</Label>
                        <FormControl>
                          <Input placeholder="Brief summary of your request" {...field} className="rounded-xl bg-secondary/40" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supportForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-xs font-semibold">Message</Label>
                        <FormControl>
                          <Textarea
                            placeholder="Describe how we can help you..."
                            rows={4}
                            {...field}
                            className="rounded-xl bg-secondary/40 resize-none"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                      {isSubmittingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Submit Support Ticket
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-400" />
                Legal Policies & Community Guidelines
              </CardTitle>
              <CardDescription className="text-xs">
                Review our platform terms, privacy disclosures, and community standards.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 p-0">
              {[
                {
                  href: '/privacy',
                  title: 'Privacy Policy',
                  desc: 'Detailed disclosure on data collection, encryption, and account security.',
                },
                {
                  href: '/terms',
                  title: 'Terms of Service',
                  desc: 'Rules governing service usage, creator payouts, and user rights.',
                },
                {
                  href: '/rules',
                  title: 'Community Guidelines & Rules',
                  desc: 'Safety rules, live stream standards, and content moderation policies.',
                },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
