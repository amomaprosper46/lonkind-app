'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, BadgeCheck, Megaphone, Radio, Wifi, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { loadNetworkSettingsSafe } from '@/lib/network-settings';
import type { AdCampaign } from '@/lib/ads-schema';
import { cn } from '@/lib/utils';

interface SponsoredAdCardProps {
  campaign: AdCampaign;
  viewerUid?: string;
  variant?: 'feed' | 'live_banner';
  isPreview?: boolean;
}

export function SponsoredAdCard({
  campaign,
  viewerUid,
  variant = 'feed',
  isPreview = false,
}: SponsoredAdCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const impressionTrackedRef = useRef(false);
  const [dataSaverActive, setDataSaverActive] = useState(false);
  const [mediaLoadedInSaver, setMediaLoadedInSaver] = useState(false);

  useEffect(() => {
    const net = loadNetworkSettingsSafe();
    setDataSaverActive(Boolean(net.dataSaverMode));
  }, []);

  // Track 1 impression when 50%+ of card enters viewport
  useEffect(() => {
    if (isPreview || !campaign.id || impressionTrackedRef.current) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !impressionTrackedRef.current) {
          impressionTrackedRef.current = true;
          fetch('/api/ads/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: campaign.id,
              event: 'impression',
              viewerId: viewerUid || 'guest',
            }),
          }).catch(() => {});
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [campaign.id, isPreview, viewerUid]);

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

  const mediaSrc =
    dataSaverActive && !mediaLoadedInSaver
      ? campaign.thumbnailUrl || campaign.mediaUrl
      : campaign.mediaUrl;

  if (variant === 'live_banner') {
    return (
      <div
        ref={cardRef}
        className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-950 via-indigo-950/50 to-slate-950 p-3.5 sm:p-4 text-white shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          <Button
            type="button"
            size="sm"
            onClick={handleCtaClick}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs gap-1.5 shrink-0 w-full sm:w-auto"
          >
            {campaign.targetType === 'live' ? (
              <Radio className="h-3.5 w-3.5" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            {campaign.ctaLabel || 'Learn More'}
          </Button>
        </div>
      </div>
    );
  }

  return (
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-10 w-10 border border-border shrink-0">
              <AvatarImage src={campaign.publisherAvatar} alt={campaign.publisherName} />
              <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                {campaign.publisherName?.charAt(0) || 'L'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
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
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Megaphone className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">Sponsored</span>
                {campaign.targetType === 'live' && (
                  <>
                    <span>•</span>
                    <span className="text-rose-500 font-semibold">Live Broadcast</span>
                  </>
                )}
              </div>
            </div>
          </div>
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

        {/* Media (Respects Data Saver Mode) */}
        {mediaSrc && (
          <div className="relative rounded-xl overflow-hidden border border-border/60 bg-black/5">
            {dataSaverActive && !mediaLoadedInSaver ? (
              <button
                type="button"
                onClick={() => setMediaLoadedInSaver(true)}
                className="w-full relative group block text-left"
              >
                <img
                  src={mediaSrc}
                  alt={campaign.title}
                  loading="lazy"
                  className="w-full max-h-60 object-cover blur-[1px] opacity-85 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1.5 text-white p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 bg-black/75 border border-white/20 px-3 py-1 rounded-full text-xs font-bold">
                    <Wifi className="h-3.5 w-3.5 text-amber-400" />
                    Data Saver Mode — Tap to load full {campaign.mediaType}
                  </span>
                </div>
              </button>
            ) : campaign.mediaType === 'video' ? (
              <video
                src={mediaSrc}
                poster={campaign.thumbnailUrl || undefined}
                controls
                playsInline
                muted
                preload="metadata"
                className="w-full max-h-80 object-cover bg-black"
              />
            ) : (
              <img
                src={mediaSrc}
                alt={campaign.title}
                loading="lazy"
                className="w-full max-h-80 object-cover"
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
  );
}
