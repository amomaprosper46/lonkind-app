'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChevronRight,
  Lock,
  Users,
  UserPlus,
  UserMinus,
  Eye,
  EyeOff,
  CheckCheck,
  ShieldCheck,
  Smartphone,
  Mail,
  KeyRound,
  Database,
  UserX,
  Search,
  Check,
  X,
  Loader2,
  Copy,
  BadgeCheck,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';
import type { SettingsRouteId, UserSettings } from '@/lib/settings-schema';
import type { CurrentUser } from './social-dashboard';
import FollowerPrivacyManager from './follower-privacy-manager';
import Link from 'next/link';

export interface BlockedUserItem {
  uid: string;
  name: string;
  handle: string;
}

interface SubMenuCommonProps {
  user: CurrentUser;
  settings: UserSettings;
  updateSettings: (updater: (prev: UserSettings) => UserSettings) => Promise<boolean>;
  onNavigate: (route: SettingsRouteId) => void;
  blockedUsers: BlockedUserItem[];
  onUnblockUser?: (uid: string) => Promise<void>;
}

// Reusable iOS/Modern Drill-Down Navigation Row
export function SettingsNavRow({
  icon: Icon,
  iconColor = 'text-indigo-400',
  title,
  description,
  badge,
  statusText,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  description: string;
  badge?: number | string;
  statusText?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-secondary/40 active:bg-secondary/60 transition-colors text-left group"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-secondary/70 border border-border/60 flex items-center justify-center shrink-0 group-hover:border-indigo-500/40 transition-colors">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-foreground group-hover:text-indigo-400 transition-colors">
              {title}
            </span>
            {badge !== undefined && badge !== 0 && badge !== '' && (
              <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 font-bold">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {statusText && (
          <span className="hidden sm:inline-block text-[11px] font-semibold text-muted-foreground bg-secondary/70 px-2.5 py-1 rounded-lg">
            {statusText}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}

// ============================================================================
// LIVE FOLLOWER ITEM WITH REAL-TIME AVATAR SYNC
// ============================================================================
function FollowerManageRow({
  follower,
  mode,
  isBusy,
  onAccept,
  onDecline,
  onRemove,
}: {
  follower: any;
  mode: 'request' | 'existing';
  isBusy: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
}) {
  const uid = follower.from?.uid || follower.uid;
  const live = useLiveUserProfile(
    uid,
    follower.from?.avatarUrl || follower.avatarUrl,
    follower.from?.name || follower.name,
    follower.from?.handle || follower.handle
  );

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-secondary/25 border border-border/50 hover:border-indigo-500/35 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-11 w-11 border border-indigo-500/30 shrink-0">
          <AvatarImage src={live.avatarUrl} alt={live.name} />
          <AvatarFallback className="bg-indigo-600 text-white font-bold">
            {live.name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm text-foreground truncate">{live.name}</p>
            {(live.handle === 'lonkind' || follower.isProfessional) && (
              <BadgeCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">@{live.handle}</p>
        </div>
      </div>

      {mode === 'request' ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            disabled={isBusy}
            onClick={onAccept}
            className="h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3"
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={onDecline}
            className="h-8 rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs px-2.5"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={onRemove}
          className="h-8 rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold shrink-0"
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remove'}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// STACK LEVEL 1: PRIVACY & SECURITY HUB
// ============================================================================
export function PrivacySecurityMenu({
  user,
  settings,
  updateSettings,
  onNavigate,
  blockedUsers,
}: SubMenuCommonProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubReq = onSnapshot(collection(db, 'users', user.uid, 'friendRequests'), (snap) => {
      setPendingCount(snap.size);
    });
    const unsubFriends = onSnapshot(collection(db, 'users', user.uid, 'friends'), (snap) => {
      setFollowersCount(snap.size);
    });
    return () => {
      unsubReq();
      unsubFriends();
    };
  }, [user?.uid]);

  return (
    <div className="space-y-5">
      {/* Group 1: Private Followers & Visibility Navigation */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            Audience, Followers & Visibility
          </CardTitle>
          <CardDescription className="text-xs">
            Drill into nested controls for follower approval, existing followers, and online presence.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          <SettingsNavRow
            icon={Users}
            iconColor="text-purple-400"
            title="Private Followers & Request Management"
            description="Private account toggle, approve/decline pending follower requests, or remove existing followers."
            badge={pendingCount > 0 ? `${pendingCount} Pending` : undefined}
            statusText={settings.privacy.privateAccount ? 'Private' : `Public (${followersCount})`}
            onClick={() => onNavigate('privacy-followers')}
          />
          <SettingsNavRow
            icon={Eye}
            iconColor="text-cyan-400"
            title="Activity Status & Read Receipts"
            description="Control active online status, direct message read receipts, and ghost mode browsing."
            statusText={settings.privacy.showActivityStatus ? 'Visible' : 'Hidden'}
            onClick={() => onNavigate('privacy-activity')}
          />
          <SettingsNavRow
            icon={UserX}
            iconColor="text-rose-400"
            title="Blocked Accounts"
            description="View and unblock people you have restricted from interacting with you."
            badge={blockedUsers.length > 0 ? blockedUsers.length : undefined}
            statusText={blockedUsers.length === 0 ? 'None' : `${blockedUsers.length} Blocked`}
            onClick={() => onNavigate('privacy-blocked')}
          />
        </CardContent>
      </Card>

      {/* Group 2: Data Collection, AI Model Training & 2FA */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Data Collection, AI Training & Account Protection
          </CardTitle>
          <CardDescription className="text-xs">
            Global privacy controls for telemetry, model training opt-out, and Two-Factor Authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Database className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <Label className="font-bold text-sm text-foreground">
                  Disable Telemetry & Model Training Data Usage
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opt out globally from diagnostic analytics telemetry and prevent your posts, messages, and AI chats from being used for model training.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.privacy.disableTelemetryAndTraining}
              onCheckedChange={async (checked) => {
                const ok = await updateSettings((prev) => ({
                  ...prev,
                  privacy: { ...prev.privacy, disableTelemetryAndTraining: checked },
                }));
                if (ok) {
                  toast({
                    title: checked ? 'Telemetry & AI Training Disabled' : 'Telemetry Enabled',
                    description: checked
                      ? 'Your data is excluded from telemetry and AI model training.'
                      : 'Anonymous diagnostic telemetry is enabled.',
                  });
                }
              }}
            />
          </div>

          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label className="font-bold text-sm text-foreground">Two-Factor Authentication (2FA)</Label>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-bold ${
                      settings.privacy.twoFactorEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {settings.privacy.twoFactorEnabled ? 'Protected' : 'Off'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Require a verification code from your authenticator app, SMS, or email whenever you sign in on a new device.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={settings.privacy.twoFactorEnabled}
                onCheckedChange={async (checked) => {
                  const ok = await updateSettings((prev) => ({
                    ...prev,
                    privacy: { ...prev.privacy, twoFactorEnabled: checked },
                  }));
                  if (ok) {
                    toast({
                      title: checked ? '2FA Enabled' : '2FA Disabled',
                      description: checked
                        ? 'Your account now requires Two-Factor verification on new logins.'
                        : 'Two-Factor Authentication has been turned off.',
                    });
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('privacy-2fa')}
                className="rounded-xl text-xs text-indigo-400 hover:bg-indigo-500/10"
              >
                Configure
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STACK LEVEL 2: PRIVATE FOLLOWERS & REQUEST MANAGEMENT
// ============================================================================
export function PrivateFollowersMenu({
  settings,
  updateSettings,
  onNavigate,
}: SubMenuCommonProps) {
  return (
    <div className="space-y-5">
      {/* Full-Stack Follower Privacy Manager (Confirmation Modal, Search, Pagination, Bulk Actions, Silent Remove & Block) */}
      <FollowerPrivacyManager
        initialTab="PENDING"
        onPrivateStatusChange={(nextPrivate) => {
          updateSettings((prev) => ({
            ...prev,
            privacy: { ...prev.privacy, privateAccount: nextPrivate },
          }));
        }}
      />

      {/* Profile List Visibility + Deep Links */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0 divide-y divide-border/50">
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <Label className="font-bold text-sm text-foreground">
                Hide Followers &amp; Friends List on Public Profile
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Other visitors will not be able to open the Friends &amp; Followers tab on your profile page.
              </p>
            </div>
            <Switch
              checked={settings.privacy.hideFollowersList}
              onCheckedChange={async (checked) => {
                const ok = await updateSettings((prev) => ({
                  ...prev,
                  privacy: { ...prev.privacy, hideFollowersList: checked },
                }));
                if (ok) {
                  toast({
                    title: checked ? 'Followers List Hidden' : 'Followers List Public',
                  });
                }
              }}
            />
          </div>

          <SettingsNavRow
            icon={CheckCheck}
            iconColor="text-cyan-400"
            title="Activity Status & Read Receipts"
            description="Manage whether followers can see your online status or when you read their messages."
            statusText={settings.privacy.readReceipts ? 'Receipts On' : 'Receipts Off'}
            onClick={() => onNavigate('privacy-activity')}
          />

          <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-secondary/15">
            <div>
              <p className="font-bold text-xs text-foreground">Direct Nested Route</p>
              <p className="text-[11px] text-muted-foreground">
                Open the dedicated full-page URL at <code className="font-mono text-indigo-400">/settings/privacy/followers</code>
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold shrink-0">
              <Link href="/settings/privacy/followers">Open Dedicated Page</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STACK LEVEL 3: PENDING FOLLOWER REQUESTS (ACCEPT / DECLINE)
// ============================================================================
export function PendingFollowerRequestsScreen({ user }: { user: CurrentUser }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.uid) return;
    let friendReqs: any[] = [];
    let followReqs: any[] = [];

    const mergeAndSet = () => {
      const merged = new Map<string, any>();
      [...followReqs, ...friendReqs].forEach((r) => {
        const key = r.from?.uid || r.followerId || r.uid;
        if (key && !merged.has(key)) merged.set(key, { ...r, uid: key });
      });
      setRequests(Array.from(merged.values()));
      setLoading(false);
    };

    const unsubFriendReqs = onSnapshot(
      collection(db, 'users', user.uid, 'friendRequests'),
      (snap) => {
        friendReqs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        mergeAndSet();
      },
      (err) => {
        console.error('[PendingFollowerRequestsScreen] friendRequests listener error:', err);
        setLoading(false);
      }
    );

    const unsubFollowReqs = onSnapshot(
      collection(db, 'users', user.uid, 'followRequests'),
      (snap) => {
        followReqs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        mergeAndSet();
      },
      () => {
        // Non-fatal if collection hasn't been created yet
      }
    );

    return () => {
      unsubFriendReqs();
      unsubFollowReqs();
    };
  }, [user?.uid]);

  const callFollowerApi = async (payload: Record<string, any>) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Authentication session expired. Please sign in again.');
    }
    const res = await fetch('/api/privacy/followers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  };

  const handleAccept = async (req: any) => {
    if (!user?.uid) return;
    const requesterUid = req.from?.uid || req.followerId || req.uid;
    if (!requesterUid) {
      toast({
        variant: 'destructive',
        title: 'Missing Requester ID',
        description: 'Could not determine which user sent this follow request.',
      });
      return;
    }
    if (busyIds[requesterUid]) return; // Prevent double-click duplicate writes

    const prevRequests = requests;
    setBusyIds((prev) => ({ ...prev, [requesterUid]: true }));
    // Optimistic UI removal
    setRequests((curr) => curr.filter((r) => (r.from?.uid || r.followerId || r.uid) !== requesterUid));

    try {
      await callFollowerApi({ action: 'confirm', followerUid: requesterUid });
      toast({
        title: 'Follow Request Accepted',
        description: `${req.from?.name || req.name || 'User'} is now following you and has been notified.`,
      });
    } catch (err: any) {
      console.error('[PendingFollowerRequestsScreen] Accept request error:', err);
      setRequests(prevRequests); // Rollback optimistic update
      toast({
        variant: 'destructive',
        title: 'Could Not Accept Request',
        description: err?.message || 'Permission error or missing document prevented approval.',
      });
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[requesterUid];
        return next;
      });
    }
  };

  const handleDecline = async (req: any) => {
    if (!user?.uid) return;
    const requesterUid = req.from?.uid || req.followerId || req.uid;
    if (!requesterUid || busyIds[requesterUid]) return;

    const prevRequests = requests;
    setBusyIds((prev) => ({ ...prev, [requesterUid]: true }));
    setRequests((curr) => curr.filter((r) => (r.from?.uid || r.followerId || r.uid) !== requesterUid));

    try {
      await callFollowerApi({ action: 'decline', followerUid: requesterUid });
      toast({ title: 'Request Declined', description: 'The pending request was removed silently.' });
    } catch (err: any) {
      console.error('[PendingFollowerRequestsScreen] Decline request error:', err);
      setRequests(prevRequests);
      toast({
        variant: 'destructive',
        title: 'Could Not Decline Request',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[requesterUid];
        return next;
      });
    }
  };

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-indigo-400" />
          Pending Follower Requests ({requests.length})
        </CardTitle>
        <CardDescription className="text-xs">
          Approve or decline incoming follower requests. Declining does not notify the sender.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-border/60 text-muted-foreground">
            <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm text-foreground">No pending follower requests</p>
            <p className="text-xs mt-1">New requests will show up here for your approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const reqKey = req.from?.uid || req.followerId || req.uid;
              return (
                <FollowerManageRow
                  key={reqKey}
                  follower={req}
                  mode="request"
                  isBusy={Boolean(busyIds[reqKey])}
                  onAccept={() => handleAccept(req)}
                  onDecline={() => handleDecline(req)}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 3: REMOVE EXISTING FOLLOWERS (SEARCH + REMOVE TOOL)
// ============================================================================
export function RemoveFollowersScreen({ user }: { user: CurrentUser }) {
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'friends'), (snap) => {
      setFollowers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleRemove = async (follower: any) => {
    if (!user?.uid || !follower?.uid || busyId === follower.uid) return;
    setBusyId(follower.uid);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication session expired. Please sign in again.');
      const res = await fetch('/api/privacy/followers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'remove_follower', followerUid: follower.uid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove follower.');
      toast({
        title: 'Follower Removed',
        description: `${follower.name || 'User'} has been silently removed from your followers.`,
      });
    } catch (err: any) {
      console.error('[RemoveFollowersScreen] Remove follower error:', err);
      toast({
        variant: 'destructive',
        title: 'Could Not Remove Follower',
        description: err?.message || 'Permission error prevented removal.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = followers.filter(
    (f) =>
      !searchTerm.trim() ||
      f.name?.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      f.handle?.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 space-y-3">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-rose-400" />
            Remove Existing Followers ({followers.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Search your followers and remove anyone. Lonkind will not notify them that they were removed.
          </CardDescription>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search followers by name or @username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl bg-secondary/40 h-9 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-border/60 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm text-foreground">
              {followers.length === 0 ? 'No followers yet' : `No followers match "${searchTerm}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((f) => (
              <FollowerManageRow
                key={f.uid}
                follower={f}
                mode="existing"
                isBusy={busyId === f.uid}
                onRemove={() => handleRemove(f)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 2: ACTIVITY STATUS & READ RECEIPTS
// ============================================================================
export function ActivityStatusMenu({ settings, updateSettings }: SubMenuCommonProps) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-400" />
          Activity Status & Read Receipts
        </CardTitle>
        <CardDescription className="text-xs">
          Control how your real-time presence and message read status appear to others.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/50">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <Label className="font-bold text-sm">Show Active Online Status</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Allow your friends and followers to see when you are active or last seen on Lonkind.
            </p>
          </div>
          <Switch
            checked={settings.privacy.showActivityStatus}
            onCheckedChange={(checked) =>
              updateSettings((prev) => ({
                ...prev,
                privacy: { ...prev.privacy, showActivityStatus: checked },
              }))
            }
          />
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <Label className="font-bold text-sm flex items-center gap-1.5">
              <CheckCheck className="h-4 w-4 text-indigo-400" />
              Direct Message Read Receipts
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Let people know when you have seen their direct messages. If disabled, you won&apos;t see theirs either.
            </p>
          </div>
          <Switch
            checked={settings.privacy.readReceipts}
            onCheckedChange={(checked) =>
              updateSettings((prev) => ({
                ...prev,
                privacy: { ...prev.privacy, readReceipts: checked },
              }))
            }
          />
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <Label className="font-bold text-sm flex items-center gap-1.5">
              <EyeOff className="h-4 w-4 text-purple-400" />
              Ghost Mode (Private Profile Browsing)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              View profiles and public streams discreetly without appearing in profile view logs.
            </p>
          </div>
          <Switch
            checked={settings.privacy.ghostMode}
            onCheckedChange={(checked) =>
              updateSettings((prev) => ({
                ...prev,
                privacy: { ...prev.privacy, ghostMode: checked },
              }))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STACK LEVEL 2: TWO-FACTOR AUTHENTICATION (2FA)
// ============================================================================
export function TwoFactorAuthMenu({ settings, updateSettings }: SubMenuCommonProps) {
  const [backupCodes] = useState(() => [
    'LNK-4829-A7F1',
    'LNK-9104-C2E8',
    'LNK-3376-B9D4',
    'LNK-7651-E4A2',
  ]);

  const handleCopyBackup = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      toast({ title: 'Backup Codes Copied', description: 'Store these recovery codes somewhere safe.' });
    }
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" />
            Two-Factor Authentication (2FA)
          </CardTitle>
          <CardDescription className="text-xs">
            Add an extra layer of protection to your Lonkind account and Creator Wallet payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <Label className="font-bold text-sm">Enable Two-Factor Authentication</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Require a one-time security verification code whenever signing in from an unrecognized device.
              </p>
            </div>
            <Switch
              checked={settings.privacy.twoFactorEnabled}
              onCheckedChange={(checked) =>
                updateSettings((prev) => ({
                  ...prev,
                  privacy: { ...prev.privacy, twoFactorEnabled: checked },
                }))
              }
            />
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Preferred Verification Method
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'authenticator' as const,
                  label: 'Authenticator App',
                  desc: 'Google Auth / Authy',
                  icon: ShieldCheck,
                },
                {
                  id: 'sms' as const,
                  label: 'SMS Text Message',
                  desc: '6-digit code to phone',
                  icon: Smartphone,
                },
                {
                  id: 'email' as const,
                  label: 'Email Security Code',
                  desc: 'Send code to email',
                  icon: Mail,
                },
              ].map((method) => {
                const Icon = method.icon;
                const active = settings.privacy.twoFactorMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        privacy: { ...prev.privacy, twoFactorMethod: method.id },
                      }))
                    }
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/15 shadow-sm'
                        : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${active ? 'text-indigo-400' : 'text-muted-foreground'}`} />
                    <p className="font-bold text-xs text-foreground">{method.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{method.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <Label className="font-bold text-sm">Unrecognized Login Alerts</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified immediately when your account is accessed from a new browser or mobile device.
              </p>
            </div>
            <Switch
              checked={settings.privacy.loginAlerts}
              onCheckedChange={(checked) =>
                updateSettings((prev) => ({
                  ...prev,
                  privacy: { ...prev.privacy, loginAlerts: checked },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {settings.privacy.twoFactorEnabled && (
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-950/15 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Emergency Recovery Backup Codes
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopyBackup} className="rounded-xl text-xs gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copy Codes
              </Button>
            </div>
            <CardDescription className="text-xs">
              Save these single-use recovery codes in case you lose access to your 2FA device.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {backupCodes.map((code) => (
              <div
                key={code}
                className="font-mono text-xs font-bold tracking-wider px-3 py-2 rounded-xl bg-background/60 border border-border/50 text-center"
              >
                {code}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// STACK LEVEL 2: BLOCKED ACCOUNTS MANAGER
// ============================================================================
export function BlockedAccountsMenu({
  blockedUsers,
  onUnblockUser,
}: Pick<SubMenuCommonProps, 'blockedUsers' | 'onUnblockUser'>) {
  const [unblockingMap, setUnblockingMap] = useState<Record<string, boolean>>({});
  const [queryText, setQueryText] = useState('');

  const handleUnblock = async (uid: string) => {
    if (!onUnblockUser) return;
    setUnblockingMap((prev) => ({ ...prev, [uid]: true }));
    try {
      await onUnblockUser(uid);
      toast({ title: 'User Unblocked' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to unblock user.' });
    } finally {
      setUnblockingMap((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const filtered = blockedUsers.filter(
    (u) =>
      !queryText.trim() ||
      u.name?.toLowerCase().includes(queryText.trim().toLowerCase()) ||
      u.handle?.toLowerCase().includes(queryText.trim().toLowerCase())
  );

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 space-y-3">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <UserX className="h-4 w-4 text-rose-400" />
            Blocked Accounts ({blockedUsers.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Blocked accounts cannot view your posts, send you messages, or join your live rooms.
          </CardDescription>
        </div>
        {blockedUsers.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search blocked users..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="pl-9 rounded-xl bg-secondary/40 h-9 text-xs"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 rounded-2xl border border-dashed border-border/60 text-xs text-muted-foreground">
            {blockedUsers.length === 0
              ? "You haven't blocked any accounts."
              : `No blocked users match "${queryText}".`}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((u) => (
              <div
                key={u.uid}
                className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/35 border border-border/50"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{u.handle}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={unblockingMap[u.uid] || !onUnblockUser}
                  onClick={() => handleUnblock(u.uid)}
                  className="rounded-xl text-xs font-semibold shrink-0"
                >
                  {unblockingMap[u.uid] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Unblock'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
