'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  Pause,
  Play,
  Trash2,
  Edit3,
  BarChart3,
  Eye,
  MousePointerClick,
  Percent,
  BadgeCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Flag,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import {
  AD_CTA_OPTIONS,
  AD_CURRENCY_RATES_FROM_NGN,
  AD_REJECTION_REASONS,
  formatCtrPercent,
  OFFICIAL_BRAND_PROFILE,
  type AdCampaign,
  type AdRevenueLedgerEntry,
} from '@/lib/ads-schema';
import { SponsoredAdCard } from './sponsored-ad-card';

export function AdminAdManager() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [directAdRevenueByCurrency, setDirectAdRevenueByCurrency] = useState<Record<string, number>>({});
  const [revenueLedger, setRevenueLedger] = useState<AdRevenueLedgerEntry[]>([]);
  const [reports, setReports] = useState<
    { id: string; campaignId: string; campaignTitle: string; publisherHandle: string; reason: string; createdAt: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rejectReasonsById, setRejectReasonsById] = useState<Record<string, string>>({});

  // Form state for creating/editing official @lonkind campaigns
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('/og-banner.png');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [ctaLabel, setCtaLabel] = useState<string>('Learn More');
  const [destinationUrl, setDestinationUrl] = useState('https://lonkind.com/about');
  const [placement, setPlacement] = useState<'all' | 'feed' | 'live'>('all');
  const [targetAudience, setTargetAudience] = useState<'18+' | '21+'>('18+');
  const [durationHours, setDurationHours] = useState('168');
  const [targetImpressions, setTargetImpressions] = useState('25000');
  const [budgetTier, setBudgetTier] = useState('Official Brand');

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Super-admin token missing.');
      const res = await fetch('/api/ads?scope=admin', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load ad campaigns.');
      setCampaigns(data.campaigns || []);
      setReports(data.reports || []);
      setDirectAdRevenueByCurrency(data.directAdRevenueByCurrency || {});
      setRevenueLedger(data.revenueLedger || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Ad Manager Error', description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setMediaUrl('/og-banner.png');
    setMediaType('image');
    setCtaLabel('Learn More');
    setDestinationUrl('https://lonkind.com/about');
    setPlacement('all');
    setTargetAudience('18+');
    setDurationHours('168');
    setTargetImpressions('25000');
    setBudgetTier('Official Brand');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Super-admin session required.');

      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: editingId ? 'update' : 'create',
          id: editingId || undefined,
          title,
          description,
          mediaUrl,
          thumbnailUrl: mediaUrl,
          mediaType,
          ctaLabel,
          destinationUrl,
          placement,
          targetAudience,
          durationHours: Number(durationHours) || 168,
          targetImpressions: Number(targetImpressions) || 25000,
          budgetTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save campaign.');

      toast({
        title: editingId ? 'Campaign Updated' : '🎉 Official @lonkind Ad Published!',
        description: editingId
          ? 'Your changes are live.'
          : 'Your sponsored campaign is now active across Lonkind.',
      });
      resetForm();
      await fetchCampaigns();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (camp: AdCampaign) => {
    setBusyId(camp.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const nextStatus = camp.status === 'active' ? 'paused' : 'active';
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'toggle_status', id: camp.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Could not update status');
      setCampaigns((prev) =>
        prev.map((c) => (c.id === camp.id ? { ...c, status: nextStatus } : c))
      );
      toast({ title: nextStatus === 'active' ? 'Campaign Resumed' : 'Campaign Paused' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (camp: AdCampaign) => {
    setBusyId(camp.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', id: camp.id }),
      });
      if (!res.ok) throw new Error('Could not delete campaign');
      setCampaigns((prev) => prev.filter((c) => c.id !== camp.id));
      toast({ title: 'Campaign Deleted' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleApprovePromotion = async (camp: AdCampaign) => {
    setBusyId(camp.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/ads/${encodeURIComponent(camp.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not approve promotion');
      setCampaigns((prev) => prev.map((c) => (c.id === camp.id ? { ...c, status: 'active' } : c)));
      toast({
        title: '✅ Approved & Live!',
        description: `Creator @${camp.publisherHandle} has been notified that their promotion is live.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Approve Failed', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectPromotion = async (camp: AdCampaign) => {
    const reason = rejectReasonsById[camp.id] || AD_REJECTION_REASONS[0];
    setBusyId(camp.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/ads/${encodeURIComponent(camp.id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not reject promotion');
      if (data?.refundMode === 'flutterwave_auto') {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === camp.id
              ? {
                  ...c,
                  status: 'rejected',
                  paymentStatus: 'refunded',
                  refundStatus: 'refunded',
                  flutterwaveRefundId: data.flutterwaveRefundId || null,
                  refundId: data.flutterwaveRefundId || null,
                  rejectionReason: reason,
                  refundErrorMessage: null,
                }
              : c
          )
        );
        toast({
          title: '✅ Rejected & Refunded via Flutterwave',
          description: `Full refund of ${data.currency || camp.currencyPaid || 'NGN'} ${Number(data.amountRefunded ?? camp.amountPaid ?? 0).toLocaleString()} processed automatically (Refund ID: ${data.flutterwaveRefundId || 'Confirmed'}).`,
        });
        await fetchCampaigns();
      } else if (data?.refundMode === 'flutterwave_manual_required') {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === camp.id
              ? {
                  ...c,
                  status: 'rejected_refund_needed',
                  paymentStatus: 'refund_needed',
                  refundStatus: 'manual_refund_required',
                  rejectionReason: reason,
                  refundErrorMessage: data.flutterwaveMessage || null,
                }
              : c
          )
        );
        toast({
          title: '⚠️ Rejected — Manual Flutterwave Refund Required',
          description: `${data.flutterwaveMessage || 'Payment channel requires manual refund in Flutterwave dashboard.'} (TX ID: ${data.flutterwaveTransactionId || camp.flutterwaveTransactionId || 'N/A'})`,
        });
        await fetchCampaigns();
      } else {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === camp.id
              ? {
                  ...c,
                  status: 'rejected',
                  refundStatus: 'refunded',
                  rejectionReason: reason,
                  refundId: data?.refundId || null,
                }
              : c
          )
        );
        toast({
          title: '🚫 Rejected & 100% Coins Refunded',
          description: `${(data?.coinsRefunded ?? camp.coinsSpent).toLocaleString()} Coins atomically refunded to @${camp.publisherHandle} (${reason}).`,
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Reject Failed', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkRefundedManually = async (camp: AdCampaign) => {
    setBusyId(camp.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/ads/${encodeURIComponent(camp.id)}/mark-refunded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not mark refund as settled manually.');
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === camp.id
            ? {
                ...c,
                status: 'rejected',
                paymentStatus: 'refunded',
                refundStatus: 'refunded_manually',
                flutterwaveRefundId: data?.flutterwaveRefundId || c.flutterwaveRefundId,
                refundErrorMessage: null,
              }
            : c
        )
      );
      toast({
        title: '✅ Marked Refunded Manually',
        description: `Negative ad_refund ledger entry recorded and @${camp.publisherHandle} notified.`,
      });
      await fetchCampaigns();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    setBusyId(reportId);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'dismiss_report', reportId }),
      });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast({ title: 'Report Marked Reviewed' });
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (camp: AdCampaign) => {
    setEditingId(camp.id);
    setTitle(camp.title);
    setDescription(camp.description);
    setMediaUrl(camp.mediaUrl);
    setMediaType(camp.mediaType);
    setCtaLabel(camp.ctaLabel);
    setDestinationUrl(camp.destinationUrl);
    setPlacement(camp.placement);
    setTargetAudience(camp.targetAudience === '21+' ? '21+' : '18+');
    setDurationHours(String(camp.durationHours));
    setTargetImpressions(String(camp.targetImpressions));
    setBudgetTier(camp.budgetTier);
  };

  // Aggregate real-time analytics
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalBlockedViews = campaigns.reduce((sum, c) => sum + (c.blockedInvalidViews || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.uniqueClicks || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === 'active').length;
  const revenueEntries = Object.entries(directAdRevenueByCurrency).filter(([, amt]) => amt > 0);
  const formattedDirectRevenue =
    revenueEntries.length === 0
      ? '₦0'
      : revenueEntries
          .map(([curr, amt]) => {
            const sym = AD_CURRENCY_RATES_FROM_NGN[curr]?.symbol || `${curr} `;
            return `${sym}${amt.toLocaleString()}`;
          })
          .join(' • ');
  const pendingPromotions = campaigns.filter(
    (c) => c.status === 'pending_review' || c.status === 'pending_approval'
  );
  const pendingQueueBadge = pendingPromotions.length + reports.length;

  const livePreview: AdCampaign = {
    id: 'admin-preview',
    kind: 'brand_ad',
    status: 'active',
    targetAudience,
    publisherUid: OFFICIAL_BRAND_PROFILE.uid,
    publisherName: OFFICIAL_BRAND_PROFILE.name,
    publisherHandle: OFFICIAL_BRAND_PROFILE.handle,
    publisherAvatar: OFFICIAL_BRAND_PROFILE.avatarUrl,
    isOfficialBrand: true,
    title: title.trim() || 'Official Lonkind Brand Campaign Title',
    description: description.trim() || 'Preview how your @lonkind sponsored ad appears in the feed.',
    mediaUrl: mediaUrl.trim(),
    thumbnailUrl: mediaUrl.trim(),
    mediaType,
    ctaLabel,
    destinationUrl,
    targetType: 'external',
    placement,
    packageId: 'brand_campaign',
    budgetTier,
    coinsSpent: 0,
    targetImpressions: Number(targetImpressions) || 25000,
    durationHours: Number(durationHours) || 168,
    impressions: 0,
    uniqueClicks: 0,
    createdAt: new Date().toISOString(),
    expiresAt: null,
  };

  return (
    <div className="space-y-6">
      {/* Real-Time Analytics & Anti-Ad Fraud Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        <Card className="rounded-2xl border-emerald-500/35 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Direct Ad Revenue (Flutterwave)
            </p>
            <p className="text-xl sm:text-2xl font-black mt-1 text-emerald-500 truncate">
              {formattedDirectRevenue}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Isolated in ad_revenue_ledger (separate from Coin Store)
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-sky-500/30 bg-sky-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-sky-500" /> Validated Impressions (IAB)
            </p>
            <p className="text-2xl font-black mt-1">{totalImpressions.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              ≥50% visible for 1.5s • 1h deduped
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-rose-500" /> Blocked Invalid / Duplicate Views
            </p>
            <p className="text-2xl font-black mt-1 text-rose-500">
              {totalBlockedViews.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Filtered bots, self-views, duplicates &amp; bursts
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5 text-emerald-500" /> Active Campaigns
            </p>
            <p className="text-2xl font-black mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5 text-amber-500" /> Unique Clicks
            </p>
            <p className="text-2xl font-black mt-1">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-purple-500" /> Average CTR
            </p>
            <p className="text-2xl font-black mt-1">
              {formatCtrPercent(totalImpressions, totalClicks)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dedicated Ad Manager Sub-Tabs: Pending Approvals | Publish @lonkind Brand Ad | All Campaigns | Revenue & Ledger */}
      <Tabs defaultValue={pendingQueueBadge > 0 ? 'pending' : 'brand'} className="space-y-5">
        <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4 rounded-xl h-auto p-1">
          <TabsTrigger value="pending" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Pending Approvals
            {pendingQueueBadge > 0 && (
              <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0 ml-1">
                {pendingQueueBadge}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
            <BadgeCheck className="h-4 w-4 text-sky-500" />
            @lonkind Brand Ad
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            All Campaigns ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
            <CreditCard className="h-4 w-4 text-emerald-500" />
            Revenue &amp; Ledger ({revenueLedger.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PENDING APPROVALS & REPORTED ADS QUEUE */}
        <TabsContent value="pending" className="space-y-5">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  User Promotion Approval Queue ({pendingPromotions.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Review creator promotions before they appear in public feeds. Rejecting atomically
                  refunds 100% of spent coins (`type: ad_refund`).
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={isLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {pendingPromotions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  All caught up! No user promotions waiting for approval right now.
                </div>
              ) : (
                pendingPromotions.map((camp) => (
                  <div
                    key={camp.id}
                    className="rounded-2xl border border-amber-500/35 bg-muted/15 p-4 space-y-4"
                  >
                    {/* Creator Identity, Verified Age & Account Standing */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-foreground">
                            {camp.publisherName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            @{camp.publisherHandle}
                          </span>
                          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px]">
                            {camp.publisherVerifiedAge
                              ? `Verified Age: ${camp.publisherVerifiedAge} (18+)`
                              : 'Verified Adult (18+)'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Standing: {camp.publisherAccountStanding || 'Good Standing'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Package: <strong>{camp.budgetTier}</strong> (
                          {camp.paymentMethod === 'flutterwave'
                            ? `${camp.currencyPaid || 'NGN'} ${Number(camp.amountPaid || 0).toLocaleString()} via Flutterwave • TX ID: ${camp.flutterwaveTransactionId || 'Verified'}`
                            : `${camp.coinsSpent.toLocaleString()} Coins`}
                          ) • Duration: <strong>{camp.durationHours}h</strong> • Target:{' '}
                          <strong>{camp.targetImpressions.toLocaleString()} views</strong> • Link:{' '}
                          <code className="text-[11px]">{camp.destinationUrl}</code>
                        </p>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/40 text-[10px] font-bold">
                        PENDING REVIEW
                      </Badge>
                    </div>

                    {/* Full Live Preview of the Ad Card */}
                    <SponsoredAdCard campaign={camp} variant="feed" isPreview />

                    {/* One-Click Admin Moderation Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <Button
                        type="button"
                        onClick={() => handleApprovePromotion(camp)}
                        disabled={busyId === camp.id}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
                      >
                        {busyId === camp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve &amp; Go Live
                      </Button>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Select
                          value={rejectReasonsById[camp.id] || AD_REJECTION_REASONS[0]}
                          onValueChange={(val) =>
                            setRejectReasonsById((prev) => ({ ...prev, [camp.id]: val }))
                          }
                        >
                          <SelectTrigger className="h-9 w-full sm:w-48 text-xs rounded-xl">
                            <SelectValue placeholder="Rejection reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {AD_REJECTION_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRejectPromotion(camp)}
                          disabled={busyId === camp.id || camp.refundStatus === 'refund_processing'}
                          className="rounded-xl text-rose-500 border-rose-500/40 hover:bg-rose-500/10 font-bold gap-1.5 shrink-0"
                        >
                          {busyId === camp.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {camp.paymentMethod === 'flutterwave'
                            ? 'Reject & Refund (Flutterwave)'
                            : 'Reject & Refund Coins'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Reported Ads Review Queue */}
          {reports.length > 0 && (
            <Card className="rounded-2xl border-rose-500/40 bg-rose-500/5">
              <CardHeader>
                <CardTitle className="text-base font-extrabold flex items-center gap-2 text-rose-500">
                  <Flag className="h-4 w-4" />
                  Reported Ads Review Queue ({reports.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Ads flagged by Lonkind users via the Responsible Ads menu.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-border/70 bg-background p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-foreground">
                        {rep.campaignTitle}{' '}
                        <span className="text-muted-foreground">(@{rep.publisherHandle})</span>
                      </p>
                      <p className="text-muted-foreground">Reason: {rep.reason}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === rep.id}
                      onClick={() => handleDismissReport(rep.id)}
                      className="rounded-xl h-8 text-xs shrink-0"
                    >
                      Mark Reviewed
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: CREATE / EDIT OFFICIAL @LONKIND BRAND AD (INSTANT PUBLISH) */}
        <TabsContent value="brand">
      {/* Create / Edit Official @lonkind Brand Campaign */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-sky-500" />
                  {editingId ? 'Edit Sponsored Campaign' : 'Publish @lonkind Brand Ad'}
                </CardTitle>
                <CardDescription className="text-xs">
                  Published under the verified <strong>@lonkind</strong> brand profile (Official Partner).
                </CardDescription>
              </div>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ad Title</Label>
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Go Live & Earn Diamonds on Lonkind"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short, compelling campaign copy..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Image / Video Banner URL</Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="/og-banner.png or https://..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Media Type</Label>
                  <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'image' | 'video')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Call-to-Action Button</Label>
                  <Select value={ctaLabel} onValueChange={setCtaLabel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AD_CTA_OPTIONS.map((cta) => (
                        <SelectItem key={cta} value={cta}>
                          {cta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Destination URL</Label>
                  <Input
                    required
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://lonkind.com/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Placement</Label>
                  <Select value={placement} onValueChange={(v) => setPlacement(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Feed &amp; Live</SelectItem>
                      <SelectItem value="feed">Main Feed</SelectItem>
                      <SelectItem value="live">Live Discovery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Duration (hrs)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Target Views</Label>
                  <Input
                    type="number"
                    min="100"
                    value={targetImpressions}
                    onChange={(e) => setTargetImpressions(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Target Audience (Age Safety)</Label>
                  <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as '18+' | '21+')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18+">All Eligible Users (18+)</SelectItem>
                      <SelectItem value="21+">21+ Restricted Categories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Budget / Tier Label</Label>
                  <Input
                    value={budgetTier}
                    onChange={(e) => setBudgetTier(e.target.value)}
                    placeholder="Official Brand / Partner Tier"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full rounded-xl font-bold gap-2" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Save Campaign Changes' : 'Publish Official @lonkind Ad'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Ad Preview */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Live Sponsored Preview (@lonkind — Instant Active Publish)
          </p>
          <SponsoredAdCard campaign={livePreview} variant="feed" isPreview />
          <SponsoredAdCard campaign={livePreview} variant="live_banner" isPreview />
        </div>
      </div>
        </TabsContent>

        {/* TAB 3: ALL CAMPAIGNS & REAL-TIME ANALYTICS */}
        <TabsContent value="all">
      {/* All Campaigns Table / List */}
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              All Sponsored &amp; Promoted Campaigns
            </CardTitle>
            <CardDescription className="text-xs">
              Manage official @lonkind brand ads and creator-promoted posts/lives in real time.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No campaigns yet. Publish your first official @lonkind ad above!
            </p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="rounded-xl border border-border/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{camp.title}</span>
                      <Badge
                        variant="outline"
                        className={
                          camp.status === 'active'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-[10px]'
                            : camp.status === 'paused'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px]'
                            : camp.status === 'rejected_refund_needed'
                            ? 'border-rose-500/50 bg-rose-500/15 text-rose-500 text-[10px] font-bold'
                            : 'border-slate-500/40 text-muted-foreground text-[10px]'
                        }
                      >
                        {camp.status === 'rejected_refund_needed'
                          ? 'REJECTED — REFUND NEEDED'
                          : camp.status.toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {camp.isOfficialBrand
                          ? '@lonkind Official'
                          : camp.paymentMethod === 'flutterwave'
                          ? `@${camp.publisherHandle} (${camp.currencyPaid || 'NGN'} ${Number(camp.amountPaid || 0).toLocaleString()} FLW)`
                          : `@${camp.publisherHandle} (${camp.coinsSpent} Coins)`}
                      </Badge>
                    </div>
                    {camp.refundStatus === 'refunded' || camp.refundStatus === 'refunded_manually' ? (
                      <p className="text-[11px] font-semibold text-emerald-500">
                        {camp.refundStatus === 'refunded_manually' ? 'Refunded Manually' : 'Refunded'}
                        {camp.flutterwaveRefundId ? (
                          <>
                            {' '}• Refund ID:{' '}
                            <code className="bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {camp.flutterwaveRefundId}
                            </code>
                          </>
                        ) : null}
                        {camp.rejectionReason ? ` • Reason: ${camp.rejectionReason}` : ''}
                      </p>
                    ) : null}
                    {(camp.status === 'rejected_refund_needed' ||
                      camp.refundStatus === 'manual_refund_required') && (
                      <div className="rounded-lg border border-rose-500/35 bg-rose-500/5 p-2.5 text-[11px] space-y-1.5 mt-1">
                        <p className="font-bold text-rose-500">
                          Manual Refund Needed • TX ID:{' '}
                          <code className="bg-rose-500/10 px-1.5 py-0.5 rounded">
                            {camp.flutterwaveTransactionId || 'N/A'}
                          </code>
                          {camp.flutterwaveTxRef ? ` • Ref: ${camp.flutterwaveTxRef}` : ''}
                        </p>
                        {camp.refundErrorMessage && (
                          <p className="text-muted-foreground">
                            Flutterwave message: <em>{camp.refundErrorMessage}</em>
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === camp.id}
                          onClick={() => handleMarkRefundedManually(camp)}
                          className="h-7 rounded-lg text-[11px] border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 font-bold gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Mark Refunded Manually
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {camp.budgetTier} • CTA: {camp.ctaLabel} • Placement: {camp.placement}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      <span>
                        <strong>{camp.impressions.toLocaleString()}</strong> /{' '}
                        {camp.targetImpressions.toLocaleString()} valid views
                      </span>
                      <span>
                        <strong>{camp.uniqueClicks.toLocaleString()}</strong> unique clicks
                      </span>
                      <span>
                        CTR: <strong>{formatCtrPercent(camp.impressions, camp.uniqueClicks)}</strong>
                      </span>
                      {(camp.blockedInvalidViews || 0) > 0 && (
                        <span className="text-rose-500">
                          <strong>{(camp.blockedInvalidViews || 0).toLocaleString()}</strong> blocked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(camp.status === 'pending_review' || camp.status === 'pending_approval') ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprovePromotion(camp)}
                          disabled={busyId === camp.id}
                          className="rounded-xl h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectPromotion(camp)}
                          disabled={busyId === camp.id}
                          className="rounded-xl h-8 px-3 text-xs text-rose-500 border-rose-500/40 hover:bg-rose-500/10 font-bold gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject &amp; Refund
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(camp)}
                          disabled={busyId === camp.id}
                          className="rounded-xl h-8 px-2.5 text-xs gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(camp)}
                          disabled={busyId === camp.id}
                          className="rounded-xl h-8 px-2.5 text-xs gap-1"
                        >
                          {camp.status === 'active' ? (
                            <>
                              <Pause className="h-3.5 w-3.5" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" /> Resume
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(camp)}
                      disabled={busyId === camp.id}
                      className="rounded-xl h-8 px-2.5 text-xs text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* TAB 4: AD REVENUE & REFUND LEDGER (FLUTTERWAVE ISOLATED LEDGER) */}
        <TabsContent value="ledger">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  Ad Revenue &amp; Refund Ledger (`ad_revenue_ledger`)
                </CardTitle>
                <CardDescription className="text-xs">
                  Strictly isolated from Coin Store purchases and Creator Gift Payouts. Every
                  automated or manual Flutterwave refund logs a negative `ad_refund` entry.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={isLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {revenueLedger.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No direct Flutterwave ad transactions recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {revenueLedger.map((entry) => {
                    const isRefundRow = entry.type === 'ad_refund' || entry.amount < 0;
                    const sym =
                      AD_CURRENCY_RATES_FROM_NGN[entry.currency]?.symbol || `${entry.currency} `;
                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-black text-sm ${
                                isRefundRow ? 'text-rose-500' : 'text-emerald-500'
                              }`}
                            >
                              {isRefundRow ? '-' : '+'}
                              {sym}
                              {Math.abs(entry.amount).toLocaleString()} {entry.currency}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {isRefundRow ? 'AD REFUND' : 'DIRECT AD REVENUE'}
                            </Badge>
                            {entry.refundStatus === 'refunded' && (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 text-[10px]">
                                Refunded
                              </Badge>
                            )}
                            {entry.refundStatus === 'refunded_manually' && (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 text-[10px]">
                                Refunded Manually
                              </Badge>
                            )}
                            {entry.refundStatus === 'manual_refund_required' && (
                              <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/40 text-[10px]">
                                Manual Refund Needed
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground break-all">
                            @{entry.payerHandle || 'advertiser'} • TX ID:{' '}
                            <code>{entry.transactionId}</code> • Ref: <code>{entry.txRef}</code>
                            {entry.flutterwaveRefundId ? (
                              <>
                                {' '}• Refund ID: <code>{entry.flutterwaveRefundId}</code>
                              </>
                            ) : null}
                          </p>
                          {entry.reason && (
                            <p className="text-[11px] text-muted-foreground">
                              Reason: {entry.reason}
                            </p>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
