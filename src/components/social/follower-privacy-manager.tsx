'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Lock,
  Globe,
  UserPlus,
  UserCheck,
  UserX,
  UserMinus,
  Search,
  Check,
  X,
  Ban,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  BadgeCheck,
  Loader2,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type {
  FollowStatus,
  FollowerListItem,
  PaginatedFollowersResponse,
} from '@/lib/follows-schema';

export interface FollowerPrivacyManagerProps {
  initialTab?: FollowStatus;
  onPrivateStatusChange?: (isPrivate: boolean) => void;
}

const PAGE_SIZE = 8;

async function getBearerHeaders(): Promise<HeadersInit> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function FollowerRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-secondary/20">
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-3 w-48 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
    </div>
  );
}

export default function FollowerPrivacyManager({
  initialTab = 'PENDING',
  onPrivateStatusChange,
}: FollowerPrivacyManagerProps) {
  const [activeTab, setActiveTab] = useState<FollowStatus>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<FollowerListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, blocked: 0 });
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [busyUids, setBusyUids] = useState<Record<string, 'confirm' | 'decline' | 'remove' | 'block'>>({});

  // Confirmation Dialog States
  const [privateToggleTarget, setPrivateToggleTarget] = useState<boolean | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FollowerListItem | null>(null);
  const [blockTarget, setBlockTarget] = useState<FollowerListItem | null>(null);
  const [bulkActionTarget, setBulkActionTarget] = useState<'approve_all' | 'decline_all' | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Fetch paginated follower records from authenticated backend API
  const fetchFollowers = useCallback(async (silent = false) => {
    if (!auth?.currentUser) return;
    if (!silent) setIsLoading(true);
    try {
      const headers = await getBearerHeaders();
      const params = new URLSearchParams({
        status: activeTab,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const res = await fetch(`/api/privacy/followers?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Failed to load records');
      const data: PaginatedFollowersResponse = await res.json();

      setItems(data.items);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setCounts(data.counts);
      setIsPrivateAccount(data.isPrivateAccount);
    } catch (err) {
      console.error('[FollowerPrivacyManager] fetch error:', err);
      toast({
        variant: 'destructive',
        title: 'Could Not Load Records',
        description: 'Please check your connection and try again.',
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [activeTab, page, debouncedQuery]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  // POST helper
  const postAction = async (payload: Record<string, any>) => {
    const headers = await getBearerHeaders();
    const res = await fetch('/api/privacy/followers', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Action failed');
    }
    return res.json();
  };

  // 1. Master Private Account Toggle (Confirmed via Modal)
  const executePrivateToggle = async (nextPrivate: boolean, autoApprovePending = false) => {
    setIsMutating(true);
    const prevPrivate = isPrivateAccount;
    setIsPrivateAccount(nextPrivate);
    setPrivateToggleTarget(null);

    try {
      const result = await postAction({
        action: 'toggle_private',
        privateAccount: nextPrivate,
        autoApprovePending,
      });
      onPrivateStatusChange?.(nextPrivate);
      toast({
        title: nextPrivate ? 'Private Account Enabled' : 'Account Switched to Public',
        description: nextPrivate
          ? 'All new followers will now be placed in Pending Requests for your approval.'
          : result.autoApprovedCount > 0
          ? `Switched to Public and auto-approved ${result.autoApprovedCount} pending requests.`
          : 'Anyone can now follow your profile immediately.',
      });
      await fetchFollowers(true);
    } catch (err: any) {
      setIsPrivateAccount(prevPrivate);
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsMutating(false);
    }
  };

  // 2. Optimistic Confirm Request (with double-click guard + clear error reporting)
  const handleConfirmRequest = async (item: FollowerListItem) => {
    if (!item?.uid || busyUids[item.uid]) return;
    const prevItems = items;
    const prevCounts = counts;
    setBusyUids((prev) => ({ ...prev, [item.uid]: 'confirm' }));
    setItems((curr) => curr.filter((i) => i.uid !== item.uid));
    setCounts((c) => ({
      ...c,
      pending: Math.max(0, c.pending - 1),
      accepted: c.accepted + 1,
    }));

    try {
      await postAction({ action: 'confirm', followerUid: item.uid });
      toast({
        title: 'Follow Request Accepted',
        description: `${item.name} is now following you and has been notified.`,
      });
    } catch (err: any) {
      console.error('[FollowerPrivacyManager] Confirm request failed:', err);
      setItems(prevItems);
      setCounts(prevCounts);
      toast({
        variant: 'destructive',
        title: 'Could Not Accept Request',
        description: err?.message || 'Permission or server error prevented approval.',
      });
    } finally {
      setBusyUids((prev) => {
        const next = { ...prev };
        delete next[item.uid];
        return next;
      });
    }
  };

  // 3. Optimistic Delete / Ignore Request (with double-click guard)
  const handleDeclineRequest = async (item: FollowerListItem) => {
    if (!item?.uid || busyUids[item.uid]) return;
    const prevItems = items;
    const prevCounts = counts;
    setBusyUids((prev) => ({ ...prev, [item.uid]: 'decline' }));
    setItems((curr) => curr.filter((i) => i.uid !== item.uid));
    setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1) }));

    try {
      await postAction({ action: 'decline', followerUid: item.uid });
      toast({ title: 'Request Declined', description: `${item.name}'s request was ignored silently.` });
    } catch (err: any) {
      console.error('[FollowerPrivacyManager] Decline request failed:', err);
      setItems(prevItems);
      setCounts(prevCounts);
      toast({
        variant: 'destructive',
        title: 'Could Not Decline Request',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setBusyUids((prev) => {
        const next = { ...prev };
        delete next[item.uid];
        return next;
      });
    }
  };

  // 4. Bulk Actions ("Approve All" / "Decline All")
  const executeBulkAction = async (action: 'approve_all' | 'decline_all') => {
    setIsMutating(true);
    const prevItems = items;
    const prevCounts = counts;
    setBulkActionTarget(null);

    if (action === 'approve_all') {
      setItems([]);
      setCounts((c) => ({ ...c, accepted: c.accepted + c.pending, pending: 0 }));
    } else {
      setItems([]);
      setCounts((c) => ({ ...c, pending: 0 }));
    }

    try {
      const res = await postAction({ action });
      toast({
        title: action === 'approve_all' ? 'All Requests Approved' : 'All Requests Declined',
        description:
          action === 'approve_all'
            ? `Approved ${res.approvedCount || 0} pending follower requests.`
            : `Declined ${res.declinedCount || 0} pending follower requests.`,
      });
      await fetchFollowers(true);
    } catch (err: any) {
      setItems(prevItems);
      setCounts(prevCounts);
      toast({ variant: 'destructive', title: 'Bulk Action Failed', description: err.message });
    } finally {
      setIsMutating(false);
    }
  };

  // 5. Silent Remove Existing Follower
  const executeRemoveFollower = async (item: FollowerListItem) => {
    const prevItems = items;
    const prevCounts = counts;
    setRemoveTarget(null);
    setItems((curr) => curr.filter((i) => i.uid !== item.uid));
    setCounts((c) => ({ ...c, accepted: Math.max(0, c.accepted - 1) }));

    try {
      await postAction({ action: 'remove_follower', followerUid: item.uid });
      toast({
        title: 'Follower Removed Silently',
        description: `${item.name} was removed and will not receive any notification.`,
      });
    } catch (err: any) {
      setItems(prevItems);
      setCounts(prevCounts);
      toast({ variant: 'destructive', title: 'Remove Failed', description: err.message });
    }
  };

  // 6. Block User Directly from Pending Request or Follower List
  const executeBlockUser = async (item: FollowerListItem) => {
    const prevItems = items;
    const prevCounts = counts;
    setBlockTarget(null);
    setItems((curr) => curr.filter((i) => i.uid !== item.uid));
    setCounts((c) => ({
      pending: activeTab === 'PENDING' ? Math.max(0, c.pending - 1) : c.pending,
      accepted: activeTab === 'ACCEPTED' ? Math.max(0, c.accepted - 1) : c.accepted,
      blocked: c.blocked + 1,
    }));

    try {
      await postAction({
        action: 'block_user',
        targetUid: item.uid,
        name: item.name,
        handle: item.handle,
      });
      toast({
        title: 'Account Blocked',
        description: `${item.name} (@${item.handle}) has been blocked and removed.`,
      });
    } catch (err: any) {
      setItems(prevItems);
      setCounts(prevCounts);
      toast({ variant: 'destructive', title: 'Block Failed', description: err.message });
    }
  };

  // 7. Unblock Account
  const handleUnblockUser = async (item: FollowerListItem) => {
    const prevItems = items;
    const prevCounts = counts;
    setItems((curr) => curr.filter((i) => i.uid !== item.uid));
    setCounts((c) => ({ ...c, blocked: Math.max(0, c.blocked - 1) }));

    try {
      await postAction({ action: 'unblock_user', targetUid: item.uid });
      toast({ title: 'User Unblocked', description: `${item.name} has been unblocked.` });
    } catch (err: any) {
      setItems(prevItems);
      setCounts(prevCounts);
      toast({ variant: 'destructive', title: 'Unblock Failed', description: err.message });
    }
  };

  return (
    <div className="space-y-5">
      {/* ==================================================================== */}
      {/* 1. MASTER "PRIVATE ACCOUNT" TOGGLE CARD                              */}
      {/* ==================================================================== */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              {isPrivateAccount ? (
                <Lock className="h-4 w-4 text-purple-400" />
              ) : (
                <Globe className="h-4 w-4 text-emerald-400" />
              )}
              Private Account Control
            </CardTitle>
            <Badge
              variant="secondary"
              className={`text-[11px] font-bold ${
                isPrivateAccount
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isPrivateAccount ? 'Private • Approval Required' : 'Public Account'}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            When enabled, every new follower enters a <strong>PENDING</strong> state until you manually confirm them.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-bold text-sm text-foreground">
              Private Account / Approval Required for Followers
            </p>
            <p className="text-xs text-muted-foreground">
              Existing approved followers will not be affected. You can switch back to Public anytime.
            </p>
          </div>
          <Switch
            disabled={isMutating}
            checked={isPrivateAccount}
            onCheckedChange={(nextChecked) => setPrivateToggleTarget(nextChecked)}
          />
        </CardContent>
      </Card>

      {/* ==================================================================== */}
      {/* 2. FOLLOWER REQUESTS, APPROVED FOLLOWERS & BLOCKED ACCOUNTS TABS     */}
      {/* ==================================================================== */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as FollowStatus);
          setPage(1);
          setSearchQuery('');
        }}
        className="w-full space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3 h-auto p-1.5 gap-1.5 bg-slate-900/90 border border-border/60 rounded-2xl">
          <TabsTrigger
            value="PENDING"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            <span>Pending</span>
            <Badge className="bg-rose-500/90 text-white text-[10px] px-1.5 py-0">
              {counts.pending}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="ACCEPTED"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>Followers ({counts.accepted})</span>
          </TabsTrigger>

          <TabsTrigger
            value="BLOCKED"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <UserX className="h-4 w-4 shrink-0" />
            <span>Blocked ({counts.blocked})</span>
          </TabsTrigger>
        </TabsList>

        {/* SHARED SEARCH + BULK ACTIONS CARD */}
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  {activeTab === 'PENDING' && (
                    <>
                      <UserPlus className="h-4 w-4 text-indigo-400" />
                      Pending Follower Requests ({counts.pending})
                    </>
                  )}
                  {activeTab === 'ACCEPTED' && (
                    <>
                      <UserCheck className="h-4 w-4 text-emerald-400" />
                      Approved Followers ({counts.accepted})
                    </>
                  )}
                  {activeTab === 'BLOCKED' && (
                    <>
                      <Ban className="h-4 w-4 text-rose-400" />
                      Blocked &amp; Restricted Accounts ({counts.blocked})
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {activeTab === 'PENDING' &&
                    'Confirm or delete individual requests, block suspicious accounts, or use bulk actions.'}
                  {activeTab === 'ACCEPTED' &&
                    'Search your current followers to silently remove or block anyone.'}
                  {activeTab === 'BLOCKED' &&
                    'Blocked users cannot view your profile, request to follow you, or message you.'}
                </CardDescription>
              </div>

              {/* Bulk Actions for Pending Requests */}
              {activeTab === 'PENDING' && counts.pending > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={isMutating}
                    onClick={() => setBulkActionTarget('approve_all')}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() => setBulkActionTarget('decline_all')}
                    className="rounded-xl border-rose-500/35 text-rose-400 hover:bg-rose-500/10 text-xs font-bold gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Decline All
                  </Button>
                </div>
              )}
            </div>

            {/* Search Filter Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === 'PENDING'
                    ? 'Search pending requests by name or @username...'
                    : activeTab === 'ACCEPTED'
                    ? 'Search approved followers by name or @username...'
                    : 'Search blocked accounts...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 rounded-xl bg-secondary/45 h-9 text-xs sm:text-sm"
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
          </CardHeader>

          {/* TAB CONTENT BODY */}
          <CardContent className="p-4 sm:p-5 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <FollowerRowSkeleton />
                <FollowerRowSkeleton />
                <FollowerRowSkeleton />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-dashed border-border/60 bg-secondary/10 space-y-2">
                {activeTab === 'PENDING' && <UserPlus className="h-10 w-10 mx-auto text-muted-foreground/40" />}
                {activeTab === 'ACCEPTED' && <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />}
                {activeTab === 'BLOCKED' && <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/40" />}
                <p className="font-bold text-sm text-foreground">
                  {debouncedQuery
                    ? `No results match "${debouncedQuery}"`
                    : activeTab === 'PENDING'
                    ? 'No pending follower requests'
                    : activeTab === 'ACCEPTED'
                    ? 'No approved followers yet'
                    : 'No blocked or restricted accounts'}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {activeTab === 'PENDING'
                    ? 'When someone requests to follow your account, they will appear here with mutual connections and timestamp.'
                    : activeTab === 'ACCEPTED'
                    ? 'Approved followers will show up here so you can search, manage, or remove them anytime.'
                    : 'Accounts you block from requests or your follower list will appear here.'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div
                      key={item.uid}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-secondary/20 hover:bg-secondary/35 border border-border/50 hover:border-indigo-500/35 transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Link href={`/profile/${item.handle}`} className="shrink-0">
                          <Avatar className="h-12 w-12 border-2 border-indigo-500/25 shadow-sm">
                            <AvatarImage src={item.avatarUrl} alt={item.name} />
                            <AvatarFallback className="bg-indigo-600 text-white font-bold">
                              {item.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </Link>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              href={`/profile/${item.handle}`}
                              className="font-bold text-sm text-foreground hover:text-indigo-400 transition-colors truncate"
                            >
                              {item.name}
                            </Link>
                            {item.isProfessional && (
                              <BadgeCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground truncate">@{item.handle}</span>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-muted-foreground">
                            {activeTab !== 'BLOCKED' && (
                              <span className="inline-flex items-center gap-1 font-medium text-indigo-300/90">
                                <Users className="h-3 w-3" />
                                {item.mutualCount}{' '}
                                {item.mutualCount === 1 ? 'mutual follower' : 'mutual followers'}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(item.requestedAtMs), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Row Actions by Tab */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {activeTab === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              disabled={Boolean(busyUids[item.uid]) || isMutating}
                              onClick={() => handleConfirmRequest(item)}
                              className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1"
                            >
                              {busyUids[item.uid] === 'confirm' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busyUids[item.uid]) || isMutating}
                              onClick={() => handleDeclineRequest(item)}
                              className="h-8 px-3 rounded-xl text-xs font-semibold"
                            >
                              {busyUids[item.uid] === 'decline' ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5 mr-1" />
                              )}
                              Decline
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Block User"
                              disabled={Boolean(busyUids[item.uid]) || isMutating}
                              onClick={() => setBlockTarget(item)}
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {activeTab === 'ACCEPTED' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRemoveTarget(item)}
                              className="h-8 px-3 rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold gap-1.5"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Block Follower"
                              onClick={() => setBlockTarget(item)}
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {activeTab === 'BLOCKED' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUnblockUser(item)}
                            className="h-8 px-3.5 rounded-xl text-xs font-bold"
                          >
                            Unblock
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Bar */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <span>
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of{' '}
                      {totalCount}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-8 px-2.5 rounded-xl text-xs"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                      </Button>
                      <span className="px-2 font-bold text-foreground">
                        {page} / {totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 px-2.5 rounded-xl text-xs"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Keep TabsContent slots registered cleanly for Radix accessibility */}
        <TabsContent value="PENDING" className="hidden" />
        <TabsContent value="ACCEPTED" className="hidden" />
        <TabsContent value="BLOCKED" className="hidden" />
      </Tabs>

      {/* ==================================================================== */}
      {/* MODAL 1: PRIVATE <-> PUBLIC ACCOUNT CONFIRMATION MODAL               */}
      {/* ==================================================================== */}
      <AlertDialog
        open={privateToggleTarget !== null}
        onOpenChange={(open) => !open && setPrivateToggleTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {privateToggleTarget ? (
                <>
                  <Lock className="h-5 w-5 text-purple-400" /> Switch to Private Account?
                </>
              ) : (
                <>
                  <Globe className="h-5 w-5 text-emerald-400" /> Switch to Public Account?
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs sm:text-sm">
              {privateToggleTarget ? (
                <span>
                  Only approved followers will be able to see your private posts and stories. All new
                  follow requests will be held in <strong>Pending Follower Requests</strong> for your
                  manual approval. Your current {counts.accepted} followers will not be affected.
                </span>
              ) : (
                <span>
                  Anyone on Lonkind will be able to follow your profile immediately without waiting
                  for approval.
                  {counts.pending > 0 && (
                    <>
                      {' '}
                      You currently have <strong>{counts.pending} pending follower requests</strong>.
                      Would you like to auto-approve all of them now?
                    </>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            {privateToggleTarget ? (
              <AlertDialogAction
                onClick={() => executePrivateToggle(true, false)}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
              >
                {isMutating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Make Account Private
              </AlertDialogAction>
            ) : (
              <>
                {counts.pending > 0 && (
                  <AlertDialogAction
                    onClick={() => executePrivateToggle(false, true)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Switch &amp; Auto-Approve ({counts.pending})
                  </AlertDialogAction>
                )}
                <AlertDialogAction
                  onClick={() => executePrivateToggle(false, false)}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {counts.pending > 0 ? 'Switch Only (Keep Pending)' : 'Switch to Public'}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================================================================== */}
      {/* MODAL 2: SILENT REMOVE FOLLOWER CONFIRMATION DIALOG                  */}
      {/* ==================================================================== */}
      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Lonkind will silently remove <strong>@{removeTarget?.handle}</strong> from your approved
              followers list. They will <strong>not</strong> be notified that they were removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && executeRemoveFollower(removeTarget)}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            >
              Remove Follower
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================================================================== */}
      {/* MODAL 3: BLOCK USER CONFIRMATION DIALOG                              */}
      {/* ==================================================================== */}
      <AlertDialog open={blockTarget !== null} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-400 flex items-center gap-2">
              <Ban className="h-5 w-5" /> Block @{blockTarget?.handle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{blockTarget?.name}</strong> will be removed from your followers/requests and
              will no longer be able to view your profile, send messages, or request to follow you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockTarget && executeBlockUser(blockTarget)}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Block Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================================================================== */}
      {/* MODAL 4: BULK APPROVE ALL / DECLINE ALL CONFIRMATION DIALOG          */}
      {/* ==================================================================== */}
      <AlertDialog
        open={bulkActionTarget !== null}
        onOpenChange={(open) => !open && setBulkActionTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionTarget === 'approve_all'
                ? `Approve all ${counts.pending} pending requests?`
                : `Decline all ${counts.pending} pending requests?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionTarget === 'approve_all'
                ? 'All currently pending users will immediately become approved followers and see your content.'
                : 'All pending follower requests will be permanently deleted silently. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkActionTarget && executeBulkAction(bulkActionTarget)}
              className={`rounded-xl font-bold text-white ${
                bulkActionTarget === 'approve_all'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {bulkActionTarget === 'approve_all' ? 'Confirm Approve All' : 'Confirm Decline All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
