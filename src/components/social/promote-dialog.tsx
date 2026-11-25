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
  CreditCard,
  Megaphone,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import {
  AD_CURRENCY_RATES_FROM_NGN,
  getPromoPackagePrice,
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
  const [paymentMethod, setPaymentMethod] = useState<'coins' | 'flutterwave'>('coins');
  const [currency, setCurrency] = useState<string>('USD');
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
  const lacksCoins = paymentMethod === 'coins' && currentCoins < selectedPkg.coins;
  const currencyMeta = AD_CURRENCY_RATES_FROM_NGN[currency] || AD_CURRENCY_RATES_FROM_NGN.NGN;
  const selectedFiatPrice = getPromoPackagePrice(selectedPkg, currency);

  const previewCampaign: AdCampaign = {
    id: 'preview',
    kind: 'user_promote',
    status: 'active',
    targetAudience: '18+',
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
    if (paymentMethod === 'coins' && lacksCoins) {
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

      if (paymentMethod === 'flutterwave') {
        const res = await fetch('/api/ads/flutterwave/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            packageId: selectedPkg.id,
            currency,
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
        if (!res.ok || !data?.paymentLink) {
          throw new Error(data?.error || 'Could not initialize Flutterwave ad payment.');
        }

        toast({
          title: 'Redirecting to Flutterwave...',
          description: 'Complete your Card, Bank Transfer, USSD, or Mobile Money payment to submit your ad for approval.',
        });
        window.location.href = data.paymentLink;
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
        title: '✅ Promotion Submitted for Review!',
        description: `Your ${selectedPkg.name} campaign (${selectedPkg.coins.toLocaleString()} Coins) is pending safety approval and will go live once approved (auto-refunded if rejected).`,
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
            Reach more viewers across Lonkind using Coins or direct Flutterwave payment (Card, Bank
            Transfer, USSD, Mobile Money). Ad payments are strictly isolated from creator gift wallets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payment Method
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('coins');
                  setInsufficientError(null);
                }}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-all flex items-center gap-2',
                  paymentMethod === 'coins'
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                    : 'border-border/70 hover:bg-muted/40'
                )}
              >
                <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-foreground">Pay with Coins</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Balance: {currentCoins.toLocaleString()} Coins
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('flutterwave');
                  setInsufficientError(null);
                }}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-all flex items-center gap-2',
                  paymentMethod === 'flutterwave'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                    : 'border-border/70 hover:bg-muted/40'
                )}
              >
                <CreditCard className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-foreground">Flutterwave Direct</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Card • Bank • USSD • MoMo
                  </p>
                </div>
              </button>
            </div>

            {paymentMethod === 'flutterwave' && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Billing Currency</span>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-8 w-28 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AD_CURRENCY_RATES_FROM_NGN).map(([code, meta]) => (
                      <SelectItem key={code} value={code}>
                        {code} ({meta.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Promotion Packages */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Choose Promotion Package
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PROMO_PACKAGE_LIST.map((pkg) => {
                const active = selectedPkgId === pkg.id;
                const pkgFiat = getPromoPackagePrice(pkg, currency);
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
                    {paymentMethod === 'flutterwave' ? (
                      <p className="text-sm font-black text-emerald-500 flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        {currencyMeta.symbol}
                        {pkgFiat.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-sm font-black text-amber-500 flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        {pkg.coins.toLocaleString()} Coins
                      </p>
                    )}
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
          {paymentMethod === 'coins' && (lacksCoins || insufficientError) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground">Not enough Coins for {selectedPkg.name}</p>
                  <p className="text-muted-foreground">
                    You need{' '}
                    <strong>{(insufficientError?.required ?? selectedPkg.coins).toLocaleString()} Coins</strong>{' '}
                    (currently{' '}
                    <strong>{(insufficientError?.current ?? currentCoins).toLocaleString()} Coins</strong>),
                    or switch to <strong>Flutterwave Direct</strong> above.
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
            ) : paymentMethod === 'flutterwave' ? (
              <CreditCard className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isLaunching
              ? paymentMethod === 'flutterwave'
                ? 'Connecting to Flutterwave...'
                : 'Launching Campaign...'
              : paymentMethod === 'flutterwave'
              ? `Pay ${currencyMeta.symbol}${selectedFiatPrice.toLocaleString()} via Flutterwave`
              : `Launch ${selectedPkg.name} (${selectedPkg.coins.toLocaleString()} Coins)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
