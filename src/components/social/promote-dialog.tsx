'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Coins,
  Megaphone,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import {
  PROMO_PACKAGE_LIST,
  PROMO_PACKAGES,
  type AdCampaign,
  type PromoPackageId,
} from '@/lib/ads-schema';
import { SponsoredAdCard } from './sponsored-ad-card';
import { cn } from '@/lib/utils';

export interface PromoteTarget {
  targetType: 'post' | 'live';
  targetPostId?: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  publisherUid: string;
  publisherName: string;
  publisherHandle: string;
  publisherAvatar: string;
  userCoins: number;
}

interface PromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: PromoteTarget | null;
  onPromoted?: (campaignId: string, remainingCoins: number) => void;
}

export function PromoteDialog({
  open,
  onOpenChange,
  target,
  onPromoted,
}: PromoteDialogProps) {
  const [selectedPkgId, setSelectedPkgId] = useState<PromoPackageId>('starter');
  const [headline, setHeadline] = useState(target?.title || '');
  const [ctaLabel, setCtaLabel] = useState(
    target?.targetType === 'live' ? 'Join Live' : 'View Post'
  );
  const [isLaunching, setIsLaunching] = useState(false);
  const [insufficientError, setInsufficientError] = useState<{
    required: number;
    current: number;
  } | null>(null);

  React.useEffect(() => {
    if (open && target) {
      setHeadline(target.title || (target.targetType === 'live' ? 'Join my Live Broadcast!' : 'Check out my post'));
      setCtaLabel(target.targetType === 'live' ? 'Join Live' : 'View Post');
      setInsufficientError(null);
    }
  }, [open, target]);

  if (!target) return null;

  const selectedPkg = PROMO_PACKAGES[selectedPkgId];
  const currentCoins = Math.floor(Number(target.userCoins || 0));
  const lacksCoins = currentCoins < selectedPkg.coins;

  const previewCampaign: AdCampaign = {
    id: 'preview',
    kind: 'user_promote',
    status: 'active',
    publisherUid: target.publisherUid,
    publisherName: target.publisherName,
    publisherHandle: target.publisherHandle,
    publisherAvatar: target.publisherAvatar,
    isOfficialBrand: false,
    title: headline.trim() || target.title || 'Sponsored Promotion',
    description: target.description || '',
    mediaUrl: target.mediaUrl || '',
    thumbnailUrl: target.mediaUrl || '',
    mediaType: target.mediaType || 'image',
    ctaLabel,
    destinationUrl: target.targetType === 'live' ? `/live/live_${target.publisherUid}` : '/',
    targetType: target.targetType,
    targetPostId: target.targetPostId || null,
    targetHostUid: target.targetType === 'live' ? target.publisherUid : null,
    placement: target.targetType === 'live' ? 'all' : 'feed',
    packageId: selectedPkg.id,
    budgetTier: selectedPkg.name,
    coinsSpent: selectedPkg.coins,
    targetImpressions: selectedPkg.targetImpressions,
    durationHours: selectedPkg.durationHours,
    impressions: 0,
    uniqueClicks: 0,
    createdAt: new Date().toISOString(),
    expiresAt: null,
  };

  const handleLaunch = async () => {
    if (lacksCoins) {
      setInsufficientError({ required: selectedPkg.coins, current: currentCoins });
      return;
    }

    setIsLaunching(true);
    setInsufficientError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Sign In Required',
          description: 'Please sign in again to launch your promotion.',
        });
        return;
      }

      const res = await fetch('/api/ads/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          targetType: target.targetType,
          targetPostId: target.targetPostId,
          title: headline.trim() || target.title,
          description: target.description,
          mediaUrl: target.mediaUrl || '',
          mediaType: target.mediaType || 'image',
          ctaLabel,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.status === 402 || data?.code === 'INSUFFICIENT_COINS') {
        setInsufficientError({
          required: data?.requiredCoins ?? selectedPkg.coins,
          current: data?.currentCoins ?? currentCoins,
        });
        return;
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Could not launch promotion.');
      }

      toast({
        title: '🚀 Promotion Live!',
        description: `Your ${selectedPkg.name} campaign is active (${selectedPkg.coins.toLocaleString()} Coins spent).`,
      });
      onPromoted?.(data.campaignId, data.remainingCoins);
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Promotion Not Launched',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <Megaphone className="h-5 w-5 text-amber-500" />
            Promote {target.targetType === 'live' ? 'Live Stream' : 'Post'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Reach more viewers across Lonkind using your Coin balance. Ad spend is recorded
            separately from creator payouts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Wallet Balance Bar */}
          <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Available Coin Balance</span>
            <span className="font-extrabold text-amber-500 flex items-center gap-1.5 text-sm">
              <Coins className="h-4 w-4" />
              {currentCoins.toLocaleString()} Coins
            </span>
          </div>

          {/* Promotion Packages */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Choose Promotion Package
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PROMO_PACKAGE_LIST.map((pkg) => {
                const active = selectedPkgId === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setSelectedPkgId(pkg.id);
                      setInsufficientError(null);
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all flex flex-col gap-1',
                      active
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border/70 hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold text-foreground">{pkg.name}</span>
                      {pkg.badge && (
                        <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] px-1.5 py-0">
                          {pkg.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-black text-amber-500 flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" />
                      {pkg.coins.toLocaleString()} Coins
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {pkg.durationLabel} • {pkg.targetImpressions.toLocaleString()} views
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Headline & CTA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Promotion Headline</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={120}
                placeholder="Catchy headline for your sponsored card"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Button Text</Label>
              <Input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                maxLength={30}
                placeholder="Join Live / View Post"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Live Sponsored Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              2. Sponsored Card Preview
            </Label>
            <SponsoredAdCard campaign={previewCampaign} variant="feed" isPreview />
          </div>

          {/* Insufficient Coins Friendly Prompt */}
          {(lacksCoins || insufficientError) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground">Not enough Coins for {selectedPkg.name}</p>
                  <p className="text-muted-foreground">
                    You need{' '}
                    <strong>{(insufficientError?.required ?? selectedPkg.coins).toLocaleString()} Coins</strong>{' '}
                    (currently{' '}
                    <strong>{(insufficientError?.current ?? currentCoins).toLocaleString()} Coins</strong>).
                  </p>
                </div>
              </div>
              <Link href="/settings/wallet" onClick={() => onOpenChange(false)}>
                <Button size="sm" className="rounded-xl gap-1.5 font-bold shrink-0 w-full sm:w-auto">
                  <Wallet className="h-3.5 w-3.5" />
                  Top Up Coins
                </Button>
              </Link>
            </div>
          )}

          {/* Launch Button */}
          <Button
            type="button"
            onClick={handleLaunch}
            disabled={isLaunching || lacksCoins || !headline.trim()}
            className="w-full h-11 rounded-xl font-bold gap-2"
          >
            {isLaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isLaunching
              ? 'Launching Campaign...'
              : `Launch ${selectedPkg.name} (${selectedPkg.coins.toLocaleString()} Coins)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
