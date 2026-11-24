'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  BadgeCheck,
  Megaphone,
  Radio,
  Wifi,
  Play,
  MoreHorizontal,
  EyeOff,
  Info,
  Flag,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { loadNetworkSettingsSafe } from '@/lib/network-settings';
import {
  markAdHiddenLocally,
  recordLocalAdImpression,
} from '@/lib/ad-frequency';
import { attachAdViewabilityGuard } from '@/lib/ad-viewability-guard';
import type { AdCampaign } from '@/lib/ads-schema';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SponsoredAdCardProps {
  campaign: AdCampaign;
  viewerUid?: string;
  variant?: 'feed' | 'live_banner';
  isPreview?: boolean;
  onHidden?: (campaignId: string) => void;
}

export function SponsoredAdCard({
  campaign,
  viewerUid,
  variant = 'feed',
  isPreview = false,
  onHidden,
}: SponsoredAdCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const impressionTrackedRef = useRef(false);

  const [isHidden, setIsHidden] = useState(false);
  const [showWhyDialog, setShowWhyDialog] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [dataSaverActive, setDataSaverActive] = useState(false);
  const [allowAutoPlayVideo, setAllowAutoPlayVideo] = useState(true);
  const [mediaLoadedInSaver, setMediaLoadedInSaver] = useState(false);

  // Respect user's Data Saver Mode & Auto-Play Videos network settings
  useEffect(() => {
    const net = loadNetworkSettingsSafe();
    setDataSaverActive(Boolean(net.dataSaverMode));
    if (net.dataSaverMode || net.autoPlayVideos === 'never') {
      setAllowAutoPlayVideo(false);
    } else if (net.autoPlayVideos === 'wifi_only') {
      const conn = (navigator as any)?.connection;
      const isCellular = String(conn?.type || '').toLowerCase() === 'cellular';
      setAllowAutoPlayVideo(!isCellular);
    } else {
      setAllowAutoPlayVideo(true);
    }
  }, []);

  // IAB Anti-Ad Fraud Viewability Guard: >= 50% visible for >= 1.5 continuous seconds in active tab
  useEffect(() => {
    if (isHidden) return;
    const el = cardRef.current;
    if (!el) return;

    return attachAdViewabilityGuard({
      element: el,
      onQualifiedImpression: () => {
        if (isPreview || !campaign.id || impressionTrackedRef.current) return;
        impressionTrackedRef.current = true;
        recordLocalAdImpression(campaign.id);
        fetch('/api/ads/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: campaign.id,
            event: 'impression',
            viewerId: viewerUid || 'guest',
          }),
        }).catch(() => {});
      },
      onVisibilityChange: (isVisible) => {
        const vid = videoRef.current;
        if (vid && campaign.mediaType === 'video') {
          if (isVisible && allowAutoPlayVideo && (!dataSaverActive || mediaLoadedInSaver)) {
            vid.muted = true;
            vid.play().catch(() => {});
          } else {
            vid.pause();
          }
        }
      },
    });
  }, [
    allowAutoPlayVideo,
    campaign.id,
    campaign.mediaType,
    dataSaverActive,
    isHidden,
    isPreview,
    mediaLoadedInSaver,
    viewerUid,
  ]);

  if (isHidden) return null;

  const handleCtaClick = () => {
    if (isPreview) return;
    fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        event: 'click',
        viewerId: viewerUid || 'guest',
      }),
    }).catch(() => {});

    const dest = campaign.destinationUrl || '/';
    if (dest.startsWith('https://')) {
      window.open(dest, '_blank', 'noopener,noreferrer');
    } else if (dest.startsWith('/')) {
      window.location.href = dest;
    }
  };

  const handleHideAd = () => {
    if (isPreview) return;
    setIsHidden(true);
    markAdHiddenLocally(campaign.id);
    onHidden?.(campaign.id);
    fetch('/api/ads/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        userId: viewerUid || 'guest',
        action: 'hide',
      }),
    }).catch(() => {});
    toast({
      title: 'Ad Hidden',
      description: 'You will not see this sponsored card again.',
    });
  };

  const handleReportAd = () => {
    if (isPreview) return;
    setIsHidden(true);
    markAdHiddenLocally(campaign.id);
    onHidden?.(campaign.id);
    fetch('/api/ads/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        userId: viewerUid || 'guest',
        action: 'report',
        reason: 'Reported by user from feed/discovery menu',
      }),
    }).catch(() => {});
    toast({
      title: 'Ad Reported',
      description: 'Thank you. This ad has been hidden and sent to Lonkind Admin review.',
    });
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const nextMuted = !isMuted;
    vid.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && vid.paused) {
      vid.play().catch(() => {});
    }
  };

  const mediaSrc =
    dataSaverActive && !mediaLoadedInSaver
      ? campaign.thumbnailUrl || campaign.mediaUrl
      : campaign.mediaUrl;

  const controlsMenu = !isPreview && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Ad options"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        <DropdownMenuItem onClick={handleHideAd} className="gap-2 text-xs cursor-pointer">
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          Hide this ad
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowWhyDialog(true)} className="gap-2 text-xs cursor-pointer">
          <Info className="h-3.5 w-3.5 text-sky-500" />
          Why am I seeing this ad?
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleReportAd}
          className="gap-2 text-xs text-rose-500 focus:text-rose-500 cursor-pointer"
        >
          <Flag className="h-3.5 w-3.5" />
          Report ad
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const whyDialog = (
    <Dialog open={showWhyDialog} onOpenChange={setShowWhyDialog}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-500" />
            Why am I seeing this ad?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed pt-1">
            This is a responsible sponsored campaign on Lonkind (
            {campaign.isOfficialBrand
              ? 'published by the verified @lonkind brand account'
              : `promoted by @${campaign.publisherHandle} and reviewed by Lonkind Safety`}
            ).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            • Targeted to eligible adult members ({campaign.targetAudience || '18+'}).
          </p>
          <p>
            • Frequency capped at most 2 views per 24 hours, never interrupting live streams or
            blocking your screen.
          </p>
          <p>
            • You can hide or report any ad anytime using the three-dot menu.
          </p>
        </div>
        <Button type="button" onClick={() => setShowWhyDialog(false)} className="w-full rounded-xl">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );

  if (variant === 'live_banner') {
    return (
      <>
        <div
          ref={cardRef}
          className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-950 via-indigo-950/50 to-slate-950 p-3.5 sm:p-4 text-white shadow-sm"
        >
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar className="h-10 w-10 border border-white/20 shrink-0">
                <AvatarImage src={campaign.publisherAvatar} alt={campaign.publisherName} />
                <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                  {campaign.publisherName?.charAt(0) || 'L'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-extrabold text-white truncate">
                    {campaign.publisherName}
                  </span>
                  {campaign.isOfficialBrand && (
                    <Badge className="bg-sky-500/20 text-sky-200 border border-sky-400/40 text-[9px] px-1.5 py-0 gap-0.5">
                      <BadgeCheck className="h-2.5 w-2.5" /> Official Partner
                    </Badge>
                  )}
                  <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[9px] px-1.5 py-0">
                    Sponsored
                  </Badge>
                </div>
                <p className="text-sm font-bold text-white truncate mt-0.5">{campaign.title}</p>
                {campaign.description && (
                  <p className="text-xs text-slate-300 line-clamp-1">{campaign.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={handleCtaClick}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs gap-1.5 shrink-0"
              >
                {campaign.targetType === 'live' ? (
                  <Radio className="h-3.5 w-3.5" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                {campaign.ctaLabel || 'Learn More'}
              </Button>
              {controlsMenu}
            </div>
          </div>
        </div>
        {whyDialog}
      </>
    );
  }

  return (
    <>
      <Card
        ref={cardRef}
        className={cn(
          'rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md',
          campaign.isOfficialBrand
            ? 'border-sky-500/35 bg-card'
            : 'border-amber-500/30 bg-card'
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Avatar className="h-10 w-10 border border-border shrink-0">
                <AvatarImage src={campaign.publisherAvatar} alt={campaign.publisherName} />
                <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                  {campaign.publisherName?.charAt(0) || 'L'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-sm text-foreground truncate">
                    {campaign.publisherName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    @{campaign.publisherHandle}
                  </span>
                  {campaign.isOfficialBrand && (
                    <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[10px] font-bold px-1.5 py-0 gap-0.5">
                      <BadgeCheck className="h-3 w-3" /> Official Partner
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0 gap-1"
                  >
                    <Megaphone className="h-2.5 w-2.5 shrink-0" />
                    Sponsored
                  </Badge>
                  {campaign.targetAudience === '21+' && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      21+
                    </Badge>
                  )}
                  {campaign.targetType === 'live' && (
                    <span className="text-rose-500 font-semibold">• Live Broadcast</span>
                  )}
                </div>
              </div>
            </div>

            {controlsMenu}
          </div>

          {/* Copy */}
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-foreground leading-snug">
              {campaign.title}
            </h3>
            {campaign.description && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {campaign.description}
              </p>
            )}
          </div>

          {/* Fixed Aspect-Ratio Media Container (Prevents CLS / Scroll Jump) */}
          {mediaSrc && (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/60 bg-black/10">
              {dataSaverActive && !mediaLoadedInSaver ? (
                <button
                  type="button"
                  onClick={() => setMediaLoadedInSaver(true)}
                  className="w-full h-full relative group block text-left"
                >
                  <img
                    src={mediaSrc}
                    alt={campaign.title}
                    loading="lazy"
                    className="w-full h-full object-cover blur-[1px] opacity-85 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1.5 text-white p-3 text-center">
                    <span className="inline-flex items-center gap-1.5 bg-black/75 border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold">
                      <Wifi className="h-3.5 w-3.5 text-amber-400" />
                      Data Saver Mode — Tap to load {campaign.mediaType}
                    </span>
                  </div>
                </button>
              ) : campaign.mediaType === 'video' ? (
                <>
                  <video
                    ref={videoRef}
                    src={mediaSrc}
                    poster={campaign.thumbnailUrl || undefined}
                    playsInline
                    muted={isMuted}
                    loop
                    preload="metadata"
                    className="w-full h-full object-cover bg-black"
                  />
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute ad video' : 'Mute ad video'}
                    className="absolute bottom-2.5 right-2.5 h-8 px-2.5 rounded-full bg-black/75 hover:bg-black/90 border border-white/20 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5" />
                        <span>Tap to unmute</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Sound on</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <img
                  src={mediaSrc}
                  alt={campaign.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              )}
              {campaign.mediaType === 'video' && dataSaverActive && !mediaLoadedInSaver && (
                <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Play className="h-2.5 w-2.5" /> Video
                </span>
              )}
            </div>
          )}

          {/* CTA Footer */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-muted-foreground truncate">
              {campaign.destinationUrl.startsWith('https://')
                ? campaign.destinationUrl.replace(/^https:\/\//, '').split('/')[0]
                : 'lonkind.com'}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={handleCtaClick}
              className="rounded-xl font-bold gap-1.5 shrink-0"
            >
              {campaign.targetType === 'live' ? (
                <Radio className="h-3.5 w-3.5" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              {campaign.ctaLabel || 'Learn More'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {whyDialog}
    </>
  );
}
