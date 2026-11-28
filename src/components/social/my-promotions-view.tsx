'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  Eye,
  MousePointerClick,
  Clock,
  RefreshCw,
  Plus,
  Sparkles,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/firebase';
import { formatCtrPercent, type AdCampaign } from '@/lib/ads-schema';
import { AdCardSkeleton, EmptyState } from '@/components/ui/skeletons';
import { PromoteDialog } from './promote-dialog';
import type { CurrentUser } from './social-dashboard';

function formatRemainingDuration(expiresAt: string | null, status: string): string {
  if (status === 'pending_review' || status === 'pending_approval') {
    return 'Starts on approval';
  }
  if (status === 'rejected' || status === 'rejected_refund_needed') {
    return 'Ended (Refunded)';
  }
  if (status === 'completed') {
    return 'Completed';
  }
  if (!expiresAt) return 'Active';
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Completed';
  const totalHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hrs = totalHours % 24;
    return `${days}d ${hrs}h left`;
  }
  return `${totalHours}h left`;
}

function renderStatusBadge(camp: AdCampaign) {
  if (camp.status === 'active') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 text-[10px] font-bold gap-1">
        <CheckCircle2 className="h-3 w-3" /> Active
      </Badge>
    );
  }
  if (camp.status === 'pending_review' || camp.status === 'pending_approval') {
    return (
      <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/40 text-[10px] font-bold gap-1">
        <ShieldAlert className="h-3 w-3" /> Pending Approval
      </Badge>
    );
  }
  if (camp.status === 'rejected' || camp.status === 'rejected_refund_needed') {
    return (
      <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/40 text-[10px] font-bold gap-1">
        <XCircle className="h-3 w-3" /> Rejected / Refunded
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-bold">
      Completed
    </Badge>
  );
}

export function MyPromotionsView({ currentUser }: { currentUser: CurrentUser }) {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  const fetchMyCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/ads?scope=mine', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyCampaigns();
  }, [fetchMyCampaigns]);

  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.uniqueClicks || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-5">
      {/* Header & Quick Launch CTA */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Creator Tools &amp; Promotions
          </p>
          <h1 className="text-xl font-black tracking-tight">My Promotions</h1>
          <p className="text-xs text-muted-foreground">
            Boost your posts or live streams with Coins or Flutterwave Direct and track real IAB-validated views.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchMyCampaigns}
            disabled={isLoading}
            className="rounded-xl h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsPromoteOpen(true)}
            className="rounded-xl h-9 font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-black"
          >
            <Plus className="h-4 w-4" />
            Launch Promotion
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Megaphone className="h-3.5 w-3.5 text-emerald-500" /> Active
            </p>
            <p className="text-xl font-black mt-0.5">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Eye className="h-3.5 w-3.5 text-sky-500" /> Valid Views
            </p>
            <p className="text-xl font-black mt-0.5">{totalImpressions.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5 text-amber-500" /> Clicks
            </p>
            <p className="text-xl font-black mt-0.5">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="space-y-4">
          <AdCardSkeleton />
          <AdCardSkeleton />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6 text-amber-500" />}
          title="No Promotions Yet"
          description="Promote your live stream or any of your posts to reach more viewers across Lonkind's global feed."
          action={
            <Button
              type="button"
              onClick={() => setIsPromoteOpen(true)}
              className="rounded-xl font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Megaphone className="h-4 w-4" />
              Create Your First Promotion
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp) => (
            <Card key={camp.id} className="rounded-2xl border-border/70">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{camp.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {camp.budgetTier} •{' '}
                      {camp.paymentMethod === 'flutterwave'
                        ? `${camp.currencyPaid || 'USD'} ${Number(camp.amountPaid || 0).toLocaleString()} via Flutterwave`
                        : `${camp.coinsSpent.toLocaleString()} Coins`}
                    </p>
                  </div>
                  {renderStatusBadge(camp)}
                </div>

                {camp.rejectionReason && (
                  <p className="text-[11px] text-rose-500 bg-rose-500/10 rounded-lg px-2.5 py-1.5">
                    Reason: <strong>{camp.rejectionReason}</strong> — Your refund has been processed.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border/50 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5 text-sky-500" />
                    <strong className="text-foreground">{camp.impressions.toLocaleString()}</strong> /{' '}
                    {camp.targetImpressions.toLocaleString()} views
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MousePointerClick className="h-3.5 w-3.5 text-amber-500" />
                    <strong className="text-foreground">{camp.uniqueClicks.toLocaleString()}</strong> clicks (
                    {formatCtrPercent(camp.impressions, camp.uniqueClicks)})
                  </span>
                  <span className="inline-flex items-center gap-1 ml-auto">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRemainingDuration(camp.expiresAt, camp.status)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PromoteDialog
        open={isPromoteOpen}
        onOpenChange={setIsPromoteOpen}
        target={{
          targetType: 'live',
          title: `Watch ${currentUser.name} Live on Lonkind!`,
          description: `Follow @${currentUser.handle} and join the live broadcast on Lonkind.`,
          mediaUrl: currentUser.avatarUrl || '/og-banner.png',
          mediaType: 'image',
          publisherUid: currentUser.uid,
          publisherName: currentUser.name,
          publisherHandle: currentUser.handle,
          publisherAvatar: currentUser.avatarUrl || '',
          userCoins: currentUser.coins || 0,
        }}
        onPromoted={() => {
          fetchMyCampaigns();
        }}
      />
    </div>
  );
}
