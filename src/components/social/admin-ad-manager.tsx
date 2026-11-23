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
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import {
  AD_CTA_OPTIONS,
  formatCtrPercent,
  OFFICIAL_BRAND_PROFILE,
  type AdCampaign,
} from '@/lib/ads-schema';
import { SponsoredAdCard } from './sponsored-ad-card';

export function AdminAdManager() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for creating/editing official @lonkind campaigns
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('/og-banner.png');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [ctaLabel, setCtaLabel] = useState<string>('Learn More');
  const [destinationUrl, setDestinationUrl] = useState('https://lonkind.com/about');
  const [placement, setPlacement] = useState<'all' | 'feed' | 'live'>('all');
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

  const startEdit = (camp: AdCampaign) => {
    setEditingId(camp.id);
    setTitle(camp.title);
    setDescription(camp.description);
    setMediaUrl(camp.mediaUrl);
    setMediaType(camp.mediaType);
    setCtaLabel(camp.ctaLabel);
    setDestinationUrl(camp.destinationUrl);
    setPlacement(camp.placement);
    setDurationHours(String(camp.durationHours));
    setTargetImpressions(String(camp.targetImpressions));
    setBudgetTier(camp.budgetTier);
  };

  // Aggregate real-time analytics
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.uniqueClicks || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === 'active').length;

  const livePreview: AdCampaign = {
    id: 'admin-preview',
    kind: 'brand_ad',
    status: 'active',
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
      {/* Real-Time Analytics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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
              <Eye className="h-3.5 w-3.5 text-sky-500" /> Total Impressions
            </p>
            <p className="text-2xl font-black mt-1">{totalImpressions.toLocaleString()}</p>
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

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Budget / Tier Label</Label>
                <Input
                  value={budgetTier}
                  onChange={(e) => setBudgetTier(e.target.value)}
                  placeholder="Official Brand / Partner Tier"
                />
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
            Live Sponsored Preview (@lonkind)
          </p>
          <SponsoredAdCard campaign={livePreview} variant="feed" isPreview />
          <SponsoredAdCard campaign={livePreview} variant="live_banner" isPreview />
        </div>
      </div>

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
                            : 'border-slate-500/40 text-muted-foreground text-[10px]'
                        }
                      >
                        {camp.status.toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {camp.isOfficialBrand ? '@lonkind Official' : `@${camp.publisherHandle} (${camp.coinsSpent} Coins)`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {camp.budgetTier} • CTA: {camp.ctaLabel} • Placement: {camp.placement}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      <span>
                        <strong>{camp.impressions.toLocaleString()}</strong> /{' '}
                        {camp.targetImpressions.toLocaleString()} impressions
                      </span>
                      <span>
                        <strong>{camp.uniqueClicks.toLocaleString()}</strong> unique clicks
                      </span>
                      <span>
                        CTR: <strong>{formatCtrPercent(camp.impressions, camp.uniqueClicks)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
