'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Settings as SettingsIcon,
  KeyRound,
  Palette,
  ExternalLink,
  Mail,
  User,
  Trash2,
  Camera,
  AtSign,
  Globe,
  Bell,
  Image as ImageIcon,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Database,
  X,
  CheckCircle2,
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
import type { CurrentUser } from './social-dashboard';
import {
  SETTINGS_ROUTE_MAP,
  getBreadcrumbTrail,
  useUserSettings,
  type SettingsRouteId,
} from '@/lib/settings-schema';
import {
  SettingsNavRow,
  PrivacySecurityMenu,
  PrivateFollowersMenu,
  PendingFollowerRequestsScreen,
  RemoveFollowersScreen,
  ActivityStatusMenu,
  TwoFactorAuthMenu,
  BlockedAccountsMenu,
  type BlockedUserItem,
} from './settings-privacy-submenus';
import { LiveChatSafetySettingsPanel } from './live-moderation-system';
import {
  NotificationsHubMenu,
  PushNotificationsScreen,
  EmailNotificationsScreen,
  InAppNotificationsScreen,
  AppearanceDisplayMenu,
  DataStorageTelemetryMenu,
} from './settings-channel-submenus';
import {
  NetworkSettingsHub,
  NetworkDataSaverSubMenu,
  NetworkBackgroundSyncSubMenu,
  NetworkOfflineQueueSubMenu,
} from './network-settings-menu';
import { Wifi } from 'lucide-react';

interface SettingsViewProps {
  user: CurrentUser;
  onSignOut: () => void;
  onUpdateProfile: (data: ProfileData) => Promise<boolean>;
  onPasswordReset: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  blockedUsers?: BlockedUserItem[];
  onUnblockUser?: (uid: string) => Promise<void>;
  onGoToWallet?: () => void;
  onViewProfile?: () => void;
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
  onViewProfile,
}: SettingsViewProps) {
  // Multi-layered nested settings navigation state ("Settings on Top of Settings")
  const [activeRoute, setActiveRoute] = useState<SettingsRouteId>('root');
  const [searchQuery, setSearchQuery] = useState('');

  // Persisted Firestore + localStorage User Settings state manager
  const { settings, isSaving: isSavingSettings, updateSettings } = useUserSettings(user?.uid);

  // Account & Profile Form States
  const [displayName, setDisplayName] = useState(user.name || '');
  const [handleInput, setHandleInput] = useState(user.handle || '');
  const [bio, setBio] = useState(user.bio || '');
  const [businessUrl, setBusinessUrl] = useState(user.businessUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Hydrate route from URL `?settingsPath=...` if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search).get('settingsPath') as SettingsRouteId | null;
    if (sp && SETTINGS_ROUTE_MAP[sp]) {
      setActiveRoute(sp);
    }
  }, []);

  useEffect(() => {
    setDisplayName(user.name || '');
    setHandleInput(user.handle || '');
    setBio(user.bio || '');
    setBusinessUrl(user.businessUrl || '');
  }, [user.name, user.handle, user.bio, user.businessUrl]);

  const navigateTo = (route: SettingsRouteId) => {
    setActiveRoute(route);
    setSearchQuery('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (route === 'root') url.searchParams.delete('settingsPath');
      else url.searchParams.set('settingsPath', route);
      window.history.replaceState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    const parent = SETTINGS_ROUTE_MAP[activeRoute]?.parent;
    navigateTo(parent || 'root');
  };

  const breadcrumbs = useMemo(() => getBreadcrumbTrail(activeRoute), [activeRoute]);
  const currentRouteMeta = SETTINGS_ROUTE_MAP[activeRoute];

  // Global search across all nested levels (Level 1, Level 2, Level 3)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(SETTINGS_ROUTE_MAP).filter(
      (route) =>
        route.id !== 'root' &&
        (route.title.toLowerCase().includes(q) ||
          route.subtitle.toLowerCase().includes(q) ||
          route.keywords.some((kw) => kw.toLowerCase().includes(q)))
    );
  }, [searchQuery]);

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

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleProfileSave = async () => {
    if (!displayName.trim()) {
      toast({ variant: 'destructive', title: 'Name Required', description: 'Please enter a display name.' });
      return;
    }
    const cleanHandle = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanHandle.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Invalid Username',
        description: 'Handle must be at least 3 characters (letters, numbers, underscores).',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const ok = await onUpdateProfile({
        name: displayName.trim(),
        handle: cleanHandle,
        bio: bio.trim(),
        businessUrl: businessUrl.trim(),
        ...(avatarFile ? { avatarFile } : {}),
        ...(coverFile ? { coverFile } : {}),
      });
      if (ok) {
        setAvatarFile(null);
        setCoverFile(null);
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

  const hasProfileChanges =
    displayName.trim() !== (user.name || '') ||
    handleInput.trim().toLowerCase() !== (user.handle || '').toLowerCase() ||
    bio.trim() !== (user.bio || '') ||
    businessUrl.trim() !== (user.businessUrl || '') ||
    avatarFile !== null ||
    coverFile !== null;

  const activeCoverSrc = coverPreviewUrl || (user as any).coverUrl;
  const isSoftwareStyle = settings.appearance.layoutStyle === 'software_engineering';

  return (
    <div className={`w-full ${isSoftwareStyle ? 'space-y-4' : 'space-y-6'}`}>
      {/* ==================================================================== */}
      {/* TOP STACK HEADER: BREADCRUMBS, BACK BUTTON & LIVE SYNC INDICATOR     */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
        {activeRoute === 'root' ? (
          <>
            {/* Root Profile Banner */}
            <div className="relative h-32 sm:h-36 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 overflow-hidden">
              {activeCoverSrc && (
                <img src={activeCoverSrc} alt="Cover" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/75 border border-white/15 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Cloud Synced
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="px-5 pb-5 pt-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-end gap-3.5 -mt-10 relative z-10 min-w-0">
                <Avatar className="h-20 w-20 border-4 border-background shadow-xl shrink-0">
                  <AvatarImage src={avatarPreviewUrl || user.avatarUrl} alt={user.name} />
                  <AvatarFallback className="bg-indigo-600 text-white font-bold text-2xl">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
                      {user.name}
                    </h1>
                    <Badge variant="secondary" className="text-xs font-semibold">
                      @{user.handle}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {user.email || 'Lonkind Settings Architecture'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-end">
                {onViewProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onViewProfile}
                    className="rounded-xl gap-1.5 text-xs font-bold"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-400" />
                    My Profile
                  </Button>
                )}
                {onGoToWallet && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onGoToWallet}
                    className="rounded-xl gap-1.5 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 text-xs font-bold"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Wallet
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSignOut}
                  className="rounded-xl gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-bold"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </Button>
              </div>
            </div>

            {/* Global Nested Settings Search Bar */}
            <div className="px-5 pb-5">
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search any setting (e.g., 2FA, private followers, telemetry, read receipts, layout)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-9 rounded-xl bg-secondary/50 border-border/60 h-10 text-xs sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Nested Stack Navigation Header with Interactive Breadcrumb Trail & Back Button */
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900/95 via-indigo-950/35 to-slate-900/95 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                className="rounded-xl gap-1.5 -ml-2 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to {SETTINGS_ROUTE_MAP[currentRouteMeta.parent || 'root'].title}
              </Button>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/70 border border-border/60 text-[11px] font-semibold text-emerald-400">
                {isSavingSettings ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </>
                )}
              </span>
            </div>

            {/* Clickable Multi-Level Breadcrumbs */}
            <nav aria-label="Settings breadcrumb" className="flex items-center flex-wrap gap-1 text-[11px] font-semibold">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => navigateTo(crumb.id)}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        isLast
                          ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 cursor-default'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {crumb.title}
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            <div>
              <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight text-foreground ${isSoftwareStyle ? 'font-mono' : ''}`}>
                {currentRouteMeta.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{currentRouteMeta.subtitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* STACK LEVEL 0: MAIN SETTINGS DASHBOARD (OR LIVE SEARCH RESULTS)      */}
      {/* ==================================================================== */}
      {activeRoute === 'root' && (
        <>
          {searchQuery.trim() ? (
            <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-sm font-bold">
                  Search Results for &ldquo;{searchQuery}&rdquo; ({searchResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/50">
                {searchResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No matching settings found. Try searching for &ldquo;2FA&rdquo;, &ldquo;followers&rdquo;, &ldquo;telemetry&rdquo;, or &ldquo;theme&rdquo;.
                  </div>
                ) : (
                  searchResults.map((res) => (
                    <SettingsNavRow
                      key={res.id}
                      icon={SettingsIcon}
                      iconColor="text-indigo-400"
                      title={res.title}
                      description={res.subtitle}
                      statusText={`Level ${res.level}`}
                      onClick={() => navigateTo(res.id)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-indigo-400" />
                  Settings Dashboard
                </CardTitle>
                <CardDescription className="text-xs">
                  Select a category to open nested sub-settings and privacy controls.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/50">
                <SettingsNavRow
                  icon={User}
                  iconColor="text-indigo-400"
                  title="Account & Profile Management"
                  description="Edit display name, @handle, profile picture, cover banner, bio, password reset, and account deletion."
                  statusText={`@${user.handle}`}
                  onClick={() => navigateTo('account')}
                />
                <SettingsNavRow
                  icon={Shield}
                  iconColor="text-emerald-400"
                  title="Privacy & Security"
                  description="Private followers, pending follower requests, remove followers, activity status, read receipts, telemetry opt-out & 2FA."
                  statusText={
                    settings.privacy.privateAccount
                      ? 'Private • 2FA ' + (settings.privacy.twoFactorEnabled ? 'On' : 'Off')
                      : settings.privacy.twoFactorEnabled
                      ? '2FA Protected'
                      : 'Standard'
                  }
                  onClick={() => navigateTo('privacy')}
                />
                <SettingsNavRow
                  icon={Bell}
                  iconColor="text-amber-400"
                  title="Notifications"
                  description="Nested channel controls for Push Notifications, Email Notifications, and In-App & 3D Gift Audio."
                  statusText={
                    settings.notifications.push.enabled ? 'Push On' : 'Push Paused'
                  }
                  onClick={() => navigateTo('notifications')}
                />
                <SettingsNavRow
                  icon={Palette}
                  iconColor="text-purple-400"
                  title="Appearance & Display"
                  description="Customize theme appearance, display density, and data saver mode."
                  statusText={
                    settings.appearance.layoutStyle === 'software_engineering'
                      ? 'Compact'
                      : 'Standard'
                  }
                  onClick={() => navigateTo('appearance')}
                />
                <SettingsNavRow
                  icon={Wifi}
                  iconColor="text-sky-400"
                  title="Network & Connection Settings"
                  description="Live connection status, data saver mode, video auto-play, background sync, and safe offline retry."
                  statusText={
                    settings.dataStorage.dataSaverMode ? 'Data Saver On' : 'Standard'
                  }
                  onClick={() => navigateTo('network')}
                />
                <SettingsNavRow
                  icon={Database}
                  iconColor="text-cyan-400"
                  title="Data & Storage / Telemetry Preferences"
                  description="Disable telemetry & model training data usage, video auto-play quality, data saver, and local cache."
                  statusText={
                    settings.privacy.disableTelemetryAndTraining ? 'Telemetry Off' : 'Telemetry On'
                  }
                  onClick={() => navigateTo('data-storage')}
                />
                <SettingsNavRow
                  icon={HelpCircle}
                  iconColor="text-rose-400"
                  title="Creator Wallet, Help & Legal Policies"
                  description="Coins & diamonds summary, submit support tickets, privacy policy, terms of service, and community guidelines."
                  statusText={`${(user.coins || 0).toLocaleString()} Coins`}
                  onClick={() => navigateTo('support-legal')}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* STACK LEVEL 1: ACCOUNT & PROFILE MANAGEMENT                          */}
      {/* ==================================================================== */}
      {activeRoute === 'account' && (
        <div className="space-y-5">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-400" />
                Public Profile, Photos & Identity
              </CardTitle>
              <CardDescription className="text-xs">
                Update your avatar, cover banner, display name, @username, bio, and links.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12 border border-indigo-500/40 shrink-0">
                      <AvatarImage src={avatarPreviewUrl || user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="bg-indigo-600 text-white font-bold">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">Profile Picture</p>
                      <p className="text-[11px] text-muted-foreground truncate">Syncs across posts & chats</p>
                    </div>
                  </div>
                  <label htmlFor="settings-avatar-upload-btn" className="cursor-pointer shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-600/30">
                      <Camera className="h-3.5 w-3.5" />
                      {avatarFile ? 'Selected' : 'Upload'}
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

                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-16 rounded-lg overflow-hidden border border-purple-500/40 bg-gradient-to-r from-indigo-700 to-pink-600 shrink-0 flex items-center justify-center">
                      {activeCoverSrc ? (
                        <img src={activeCoverSrc} alt="Cover" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-white/80" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">Cover Banner</p>
                      <p className="text-[11px] text-muted-foreground truncate">Shown on your profile</p>
                    </div>
                  </div>
                  <label htmlFor="settings-cover-upload-btn" className="cursor-pointer shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {coverFile ? 'Selected' : 'Upload'}
                    </span>
                    <input
                      id="settings-cover-upload-btn"
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-display-name" className="text-xs font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-400" /> Display Name
                  </Label>
                  <Input
                    id="settings-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-xl bg-secondary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-handle" className="text-xs font-semibold flex items-center gap-1.5">
                    <AtSign className="h-3.5 w-3.5 text-indigo-400" /> Username Handle
                  </Label>
                  <Input
                    id="settings-handle"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="rounded-xl bg-secondary/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="settings-bio" className="text-xs font-semibold">Bio</Label>
                  <span className="text-[11px] text-muted-foreground">{bio.length}/160</span>
                </div>
                <Textarea
                  id="settings-bio"
                  value={bio}
                  maxLength={160}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="rounded-xl bg-secondary/40 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-website" className="text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-indigo-400" /> Website / Business Link
                  </Label>
                  <Input
                    id="settings-website"
                    value={businessUrl}
                    onChange={(e) => setBusinessUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="rounded-xl bg-secondary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address
                  </Label>
                  <Input value={user.email || 'No email associated'} disabled className="rounded-xl bg-secondary/20 opacity-75" />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border/40">
                <Button
                  onClick={handleProfileSave}
                  disabled={isSavingProfile || !hasProfileChanges || !displayName.trim()}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5"
                >
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Profile Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                Password & Account Ownership
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/50">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">Reset Password</p>
                  <p className="text-xs text-muted-foreground">Send a reset link to {user.email || 'your email'}.</p>
                </div>
                <Button variant="outline" size="sm" onClick={onPasswordReset} className="rounded-xl self-start sm:self-center">
                  Send Reset Email
                </Button>
              </div>

              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-950/10">
                <div>
                  <p className="font-semibold text-sm text-rose-400 flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4" /> Delete Account Permanently
                  </p>
                  <p className="text-xs text-muted-foreground">Permanently remove your profile, posts, and data.</p>
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
                        This action cannot be undone and permanently deletes your Lonkind account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground">
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STACK LEVELS 1, 2 & 3: PRIVACY & SECURITY SUB-MENUS                  */}
      {/* ==================================================================== */}
      {activeRoute === 'privacy' && (
        <div className="space-y-5">
          <PrivacySecurityMenu
            user={user}
            settings={settings}
            updateSettings={updateSettings}
            onNavigate={navigateTo}
            blockedUsers={blockedUsers}
            onUnblockUser={onUnblockUser}
          />
          <LiveChatSafetySettingsPanel user={user} />
        </div>
      )}
      {activeRoute === 'privacy-followers' && (
        <PrivateFollowersMenu
          user={user}
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={navigateTo}
          blockedUsers={blockedUsers}
          onUnblockUser={onUnblockUser}
        />
      )}
      {activeRoute === 'privacy-pending-requests' && <PendingFollowerRequestsScreen user={user} />}
      {activeRoute === 'privacy-remove-followers' && <RemoveFollowersScreen user={user} />}
      {activeRoute === 'privacy-activity' && (
        <ActivityStatusMenu
          user={user}
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={navigateTo}
          blockedUsers={blockedUsers}
          onUnblockUser={onUnblockUser}
        />
      )}
      {activeRoute === 'privacy-2fa' && (
        <TwoFactorAuthMenu
          user={user}
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={navigateTo}
          blockedUsers={blockedUsers}
          onUnblockUser={onUnblockUser}
        />
      )}
      {activeRoute === 'privacy-blocked' && (
        <BlockedAccountsMenu blockedUsers={blockedUsers} onUnblockUser={onUnblockUser} />
      )}

      {/* ==================================================================== */}
      {/* STACK LEVELS 1 & 2: NOTIFICATIONS (PUSH, EMAIL, IN-APP)              */}
      {/* ==================================================================== */}
      {activeRoute === 'notifications' && (
        <NotificationsHubMenu settings={settings} updateSettings={updateSettings} onNavigate={navigateTo} />
      )}
      {activeRoute === 'notifications-push' && (
        <PushNotificationsScreen settings={settings} updateSettings={updateSettings} />
      )}
      {activeRoute === 'notifications-email' && (
        <EmailNotificationsScreen settings={settings} updateSettings={updateSettings} />
      )}
      {activeRoute === 'notifications-inapp' && (
        <InAppNotificationsScreen settings={settings} updateSettings={updateSettings} />
      )}

      {/* ==================================================================== */}
      {/* STACK LEVEL 1: APPEARANCE & DISPLAY                                  */}
      {/* ==================================================================== */}
      {activeRoute === 'appearance' && (
        <AppearanceDisplayMenu settings={settings} updateSettings={updateSettings} />
      )}

      {/* ==================================================================== */}
      {/* STACK LEVEL 1 & 2: NETWORK & CONNECTION SETTINGS                     */}
      {/* ==================================================================== */}
      {activeRoute === 'network' && (
        <NetworkSettingsHub
          settings={settings}
          updateSettings={updateSettings}
          onNavigate={navigateTo}
        />
      )}
      {activeRoute === 'network-data-saver' && (
        <NetworkDataSaverSubMenu settings={settings} updateSettings={updateSettings} />
      )}
      {activeRoute === 'network-background-sync' && (
        <NetworkBackgroundSyncSubMenu settings={settings} updateSettings={updateSettings} />
      )}
      {activeRoute === 'network-offline-queue' && (
        <NetworkOfflineQueueSubMenu settings={settings} updateSettings={updateSettings} />
      )}

      {/* ==================================================================== */}
      {/* STACK LEVEL 1: DATA, STORAGE & TELEMETRY                             */}
      {/* ==================================================================== */}
      {activeRoute === 'data-storage' && (
        <DataStorageTelemetryMenu settings={settings} updateSettings={updateSettings} />
      )}

      {/* ==================================================================== */}
      {/* STACK LEVEL 1: CREATOR WALLET, HELP & LEGAL                          */}
      {/* ==================================================================== */}
      {activeRoute === 'support-legal' && (
        <div className="space-y-5">
          {onGoToWallet && (
            <Card className="rounded-2xl border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-purple-950/40 shadow-sm">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-amber-400" />
                    <h3 className="font-bold text-base">Creator Wallet, Coins & Payouts</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Balance: <strong className="text-amber-400">{(user.coins || 0).toLocaleString()} Coins</strong> •{' '}
                    <strong className="text-cyan-400">{(user.diamonds || 0).toLocaleString()} Diamonds</strong>
                  </p>
                </div>
                <Button onClick={onGoToWallet} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                  Open Creator Wallet
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" />
                Contact Help & Support
              </CardTitle>
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
                    <Button type="submit" disabled={isSubmittingTicket} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                      {isSubmittingTicket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Support Ticket
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-400" />
                Legal Policies & Community Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 p-0">
              {[
                { href: '/privacy', title: 'Privacy Policy', desc: 'Data collection, encryption, and account security.' },
                { href: '/terms', title: 'Terms of Service', desc: 'Service usage, creator payouts, and user rights.' },
                { href: '/rules', title: 'Community Guidelines & Rules', desc: 'Live stream standards and moderation policies.' },
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
        </div>
      )}
    </div>
  );
}
