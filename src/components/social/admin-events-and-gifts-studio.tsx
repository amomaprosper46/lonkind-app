'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Gift,
  Sparkles,
  Wand2,
  Upload,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Coins,
  Gem,
  Video,
  Award,
  Calendar,
  Users,
} from 'lucide-react';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';

const GIFT_PRESETS = [
  {
    id: 'lion',
    name: 'Golden Lion',
    emoji: '🦁',
    price: 10000,
    defaultPrompt:
      'A majestic male lion sculpted from gleaming 24K liquid metallic gold emerging from a golden portal, thick flowing golden mane, fierce glowing amber eyes, roaring powerfully with shockwaves and floating gold embers',
  },
  {
    id: 'crown',
    name: 'Royal Crown',
    emoji: '👑',
    price: 1000,
    defaultPrompt:
      'A luxurious royal sovereign crown crafted from polished 24K gold set with sparkling brilliant-cut diamonds and crimson rubies, floating and rotating gently with magical golden light rays and stardust',
  },
  {
    id: 'dragon',
    name: 'Golden Dragon',
    emoji: '🐉',
    price: 25000,
    defaultPrompt:
      'A colossal mythical imperial golden dragon coiling through the air, shimmering metallic gold scales, breathing radiant golden-amber fire and glowing embers',
  },
  {
    id: 'supercar',
    name: 'Supercar',
    emoji: '🏎️',
    price: 5000,
    defaultPrompt:
      'A futuristic luxury golden-and-neon-cyber hypercar drifting onto stage with glowing LED headlights, electric purple-and-gold nitro exhaust trails, and gullwing doors opening',
  },
  {
    id: 'rocket',
    name: 'Rocket Launch',
    emoji: '🚀',
    price: 2500,
    defaultPrompt:
      'A sleek orbital spacecraft igniting thrusters with dazzling golden-violet plasma flames, shockwave rings, and ascending into sparkling cosmic stars',
  },
  {
    id: 'universe',
    name: 'Lonkind Universe',
    emoji: '🌌',
    price: 50000,
    defaultPrompt:
      'A breathtaking cosmic galaxy explosion with swirling golden nebulae, ringed planets, shooting stars, and a glowing crystalline heart of the universe',
  },
  {
    id: 'rose',
    name: 'Rose',
    emoji: '🌹',
    price: 10,
    defaultPrompt:
      'A radiant ruby-red crystal rose blooming with golden sparkles and floating velvet petals',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '💎',
    price: 100,
    defaultPrompt:
      'A giant flawless brilliant-cut diamond rotating in mid-air with rainbow prism light refractions and sparkling stardust',
  },
];

export default function AdminEventsAndGiftsStudio({
  mode = 'all',
}: {
  mode?: 'events' | 'studio' | 'all';
}) {
  // 1. Event & Free Gift of the Day State
  const [eventActive, setEventActive] = useState(false);
  const [eventName, setEventName] = useState('Lonkind Creator Festival');
  const [eventBannerText, setEventBannerText] = useState(
    '🎁 Special Event Today! Send a Free Event Gift on any Live Stream!'
  );
  const [freeGiftId, setFreeGiftId] = useState('rose');
  const [freeGiftDailyLimit, setFreeGiftDailyLimit] = useState(1);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // 2. Grant Event Coins / Diamonds / Drop State
  const [grantTarget, setGrantTarget] = useState('');
  const [grantType, setGrantType] = useState<'coins' | 'diamonds'>('coins');
  const [grantAmount, setGrantAmount] = useState('500');
  const [grantReason, setGrantReason] = useState('Special Event Reward');
  const [broadcastToAll, setBroadcastToAll] = useState(false);
  const [isGranting, setIsGranting] = useState(false);

  // 3. User Permissions & Badges State
  const [permTarget, setPermTarget] = useState('');
  const [permVerified, setPermVerified] = useState(true);
  const [permAdmin, setPermAdmin] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState('Top Creator');
  const [isUpdatingPerm, setIsUpdatingPerm] = useState(false);

  // 4. AI Gift Video Studio State
  const [selectedGiftId, setSelectedGiftId] = useState('lion');
  const [aiPrompt, setAiPrompt] = useState(GIFT_PRESETS[0].defaultPrompt);
  const [aiEngine, setAiEngine] = useState<'veo2' | 'fal'>('veo2');
  const [previewVideoUrl, setPreviewVideoUrl] = useState('');
  const [giftOverrides, setGiftOverrides] = useState<Record<string, { videoUrl: string }>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/admin/platform-controls')
      .then((r) => r.json())
      .then((data) => {
        if (data?.events) {
          setEventActive(Boolean(data.events.eventActive));
          setEventName(data.events.eventName || 'Lonkind Creator Festival');
          setEventBannerText(
            data.events.eventBannerText ||
              '🎁 Special Event Today! Send a Free Event Gift on any Live Stream!'
          );
          setFreeGiftId(data.events.freeGiftId || 'rose');
          setFreeGiftDailyLimit(Number(data.events.freeGiftDailyLimit) || 1);
        }
        if (data?.giftOverrides) {
          setGiftOverrides(data.giftOverrides);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectGiftPreset = (giftId: string) => {
    setSelectedGiftId(giftId);
    const preset = GIFT_PRESETS.find((g) => g.id === giftId);
    if (preset) {
      setAiPrompt(preset.defaultPrompt);
    }
    const existingOverride = giftOverrides[giftId]?.videoUrl;
    setPreviewVideoUrl(existingOverride || '');
  };

  const callAdminApi = async (payload: Record<string, any>) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Please sign in to your Lonkind admin account.');
    const res = await fetch('/api/admin/platform-controls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Admin operation failed.');
    return data;
  };

  const handleSaveEventConfig = async () => {
    setIsSavingEvent(true);
    try {
      const data = await callAdminApi({
        action: 'set_event_config',
        eventActive,
        eventName,
        eventBannerText,
        freeGiftId,
        freeGiftDailyLimit,
      });
      toast({ title: '✅ Event Settings Saved', description: data.message });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleGrantReward = async () => {
    setIsGranting(true);
    try {
      const data = await callAdminApi({
        action: 'grant_event_reward',
        targetIdentifier: grantTarget,
        rewardType: grantType,
        amount: Number(grantAmount),
        reason: grantReason,
        broadcastToAll,
      });
      toast({ title: '🎁 Event Reward Sent!', description: data.message });
      if (!broadcastToAll) setGrantTarget('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Grant Failed', description: err.message });
    } finally {
      setIsGranting(false);
    }
  };

  const handleUpdateUserPermissions = async (includeBadge: boolean) => {
    setIsUpdatingPerm(true);
    try {
      const data = await callAdminApi({
        action: 'update_user_permissions',
        targetIdentifier: permTarget,
        isProfessional: permVerified,
        isAdmin: permAdmin,
        ...(includeBadge ? { badgeToToggle: selectedBadge } : {}),
      });
      toast({ title: '🛡️ User Permissions Updated', description: data.message });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsUpdatingPerm(false);
    }
  };

  const handleGenerateAiVideo = async () => {
    setIsGeneratingVideo(true);
    try {
      const data = await callAdminApi({
        action: 'generate_ai_gift_video',
        giftId: selectedGiftId,
        prompt: aiPrompt,
        engine: aiEngine,
      });
      if (data.videoUrl) {
        setPreviewVideoUrl(data.videoUrl);
        toast({
          title: '🎬 3D Gift Video Generated!',
          description: 'Preview your new gift animation on the right and click Publish to Live Catalog.',
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'AI Video Notice', description: err.message });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleUploadGiftVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVideo(true);
    try {
      const storageRef = ref(storage, `gifts/${selectedGiftId}_${Date.now()}_${file.name}`);
      const snap = await uploadBytes(storageRef, file, { contentType: file.type || 'video/mp4' });
      const downloadUrl = await getDownloadURL(snap.ref);
      setPreviewVideoUrl(downloadUrl);
      toast({
        title: '✅ Gift Video Uploaded to Firebase Storage!',
        description: 'Click "Publish to Live Gift Catalog" to activate it across all streams.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
    } finally {
      setIsUploadingVideo(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    }
  };

  const handlePublishGiftVideo = async () => {
    if (!previewVideoUrl.trim()) return;
    setIsSavingVideo(true);
    try {
      const data = await callAdminApi({
        action: 'save_gift_video',
        giftId: selectedGiftId,
        videoUrl: previewVideoUrl.trim(),
      });
      setGiftOverrides((prev) => ({
        ...prev,
        [selectedGiftId]: { videoUrl: previewVideoUrl.trim() },
      }));
      toast({ title: '🚀 Published to Live Gift Catalog!', description: data.message });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Publish Failed', description: err.message });
    } finally {
      setIsSavingVideo(false);
    }
  };

  return (
    <div className="space-y-6">
      {(mode === 'events' || mode === 'all') && (
        <>
          {/* SECTION 1: FREE GIFT OF THE DAY / EVENT SCHEDULER */}
          <Card className="border-indigo-500/30 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-950 border-b border-indigo-500/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Calendar className="h-5 w-5 text-amber-400" />
                    Free Gift &amp; Special Event Scheduler (Lonkind Admin)
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs mt-1">
                    Activate a special platform event on any day so users can send a designated Free Event Gift on Live Streams.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-xl border border-indigo-500/30">
                  <Label htmlFor="event-active-switch" className="text-xs font-bold text-white cursor-pointer">
                    {eventActive ? '🟢 EVENT LIVE' : '⚫ EVENT OFF'}
                  </Label>
                  <Switch
                    id="event-active-switch"
                    checked={eventActive}
                    onCheckedChange={setEventActive}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Event / Holiday Title</Label>
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Lonkind Weekend Festival"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Free Gift for This Event</Label>
                  <select
                    value={freeGiftId}
                    onChange={(e) => setFreeGiftId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {GIFT_PRESETS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.emoji} {g.name} (Normally {g.price.toLocaleString()} Coins → FREE for Event)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Free Sends Per User (Per Event)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={freeGiftDailyLimit}
                    onChange={(e) => setFreeGiftDailyLimit(Number(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Live Stream Event Announcement Banner</Label>
                <Input
                  value={eventBannerText}
                  onChange={(e) => setEventBannerText(e.target.value)}
                  placeholder="🎁 Special Event Today! Send your Free Event Gift on any Live Stream!"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveEventConfig}
                  disabled={isSavingEvent}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl gap-2"
                >
                  {isSavingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  Save Event &amp; Free Gift Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: GRANT EVENT COINS / DIAMONDS + USER PERMISSIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/60 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Coins className="h-5 w-5 text-amber-400" />
                  Event Coin / Diamond Drop &amp; User Grant
                </CardTitle>
                <CardDescription className="text-xs">
                  Send free event coins or diamonds to any user (@handle / email) or drop an event bonus to all users.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                  <div>
                    <p className="text-xs font-bold">Drop to All Registered Users (Global Event Drop)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Toggle ON to reward every user on Lonkind for a special holiday or milestone.
                    </p>
                  </div>
                  <Switch checked={broadcastToAll} onCheckedChange={setBroadcastToAll} />
                </div>

                {!broadcastToAll && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Recipient @handle, Email, or UID</Label>
                    <Input
                      value={grantTarget}
                      onChange={(e) => setGrantTarget(e.target.value)}
                      placeholder="e.g. @creator_handle or user@email.com"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Reward Type</Label>
                    <select
                      value={grantType}
                      onChange={(e) => setGrantType(e.target.value as 'coins' | 'diamonds')}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="coins">🪙 Coins (For Gifting)</option>
                      <option value="diamonds">💎 Diamonds (Creator Earnings)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Amount</Label>
                    <Input
                      type="number"
                      min={1}
                      value={grantAmount}
                      onChange={(e) => setGrantAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Event / Reason Note</Label>
                  <Input
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    placeholder="e.g. Lonkind Weekend Giveaway Winner"
                  />
                </div>

                <Button
                  onClick={handleGrantReward}
                  disabled={isGranting || (!broadcastToAll && !grantTarget.trim())}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl gap-2"
                >
                  {isGranting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {broadcastToAll
                    ? `Drop +${grantAmount} ${grantType.toUpperCase()} to ALL Users`
                    : `Send +${grantAmount} ${grantType.toUpperCase()} to User`}
                </Button>
              </CardContent>
            </Card>

            {/* User Permissions & Badges Card */}
            <Card className="border-border/60 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  Admin Permissions &amp; Creator Badges
                </CardTitle>
                <CardDescription className="text-xs">
                  Grant Verified Checkmarks, VIP Creator Badges, or Moderator/Admin privileges to any user.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target User (@handle, Email, or UID)</Label>
                  <Input
                    value={permTarget}
                    onChange={(e) => setPermTarget(e.target.value)}
                    placeholder="e.g. @lonkind or creator@email.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <Label className="text-xs font-semibold cursor-pointer">Verified Badge (✓)</Label>
                    <Switch checked={permVerified} onCheckedChange={setPermVerified} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <Label className="text-xs font-semibold cursor-pointer">Admin Role</Label>
                    <Switch checked={permAdmin} onCheckedChange={setPermAdmin} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Toggle Special Community Badge</Label>
                  <div className="flex gap-2">
                    <select
                      value={selectedBadge}
                      onChange={(e) => setSelectedBadge(e.target.value)}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="Top Creator">👑 Top Creator</option>
                      <option value="Whale">🐋 Whale Supporter</option>
                      <option value="Top Supporter">💖 Top Supporter</option>
                      <option value="Rising Star">⭐ Rising Star</option>
                    </select>
                    <Button
                      variant="outline"
                      disabled={isUpdatingPerm || !permTarget.trim()}
                      onClick={() => handleUpdateUserPermissions(true)}
                      className="rounded-xl font-bold gap-1.5"
                    >
                      <Award className="h-4 w-4 text-amber-400" />
                      Toggle Badge
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => handleUpdateUserPermissions(false)}
                  disabled={isUpdatingPerm || !permTarget.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-2"
                >
                  {isUpdatingPerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Save User Verification &amp; Role
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {(mode === 'studio' || mode === 'all') && (
        /* SECTION 3: AI GIFT VIDEO STUDIO */
        <Card className="border-purple-500/30 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-slate-950 border-b border-purple-500/20">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <Video className="h-6 w-6 text-purple-400" />
              AI 3D Gift Video Studio (Google Veo 2 / Kling / Custom MP4)
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              Generate real 3D CGI virtual gift videos on a pitch-black (#000000) transparent stage or upload custom MP4/WebM animations directly to Firebase Storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Gift Selector + Prompt + AI / Upload Controls */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                    1. Select Virtual Gift to Customize
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {GIFT_PRESETS.map((g) => {
                      const hasCustomVideo = Boolean(giftOverrides[g.id]?.videoUrl);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleSelectGiftPreset(g.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            selectedGiftId === g.id
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                              : 'bg-muted/30 border-border/60 hover:bg-muted/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">{g.emoji}</span>
                            {hasCustomVideo && (
                              <Badge className="bg-emerald-600 text-[9px] px-1.5 py-0">LIVE</Badge>
                            )}
                          </div>
                          <div className="mt-1.5">
                            <p className="text-xs font-bold truncate">{g.name}</p>
                            <p className="text-[10px] text-amber-400 font-semibold">
                              {g.price.toLocaleString()} Coins
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      2. 3D CGI Animation Prompt (Auto-Wrapped with Pure #000000 Black Alpha Stage)
                    </Label>
                    <select
                      value={aiEngine}
                      onChange={(e) => setAiEngine(e.target.value as 'veo2' | 'fal')}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs font-semibold"
                    >
                      <option value="veo2">Engine: Google Veo 2 (Gemini API)</option>
                      <option value="fal">Engine: Luma / Kling 3D (fal.ai)</option>
                    </select>
                  </div>
                  <Textarea
                    rows={3}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleGenerateAiVideo}
                    disabled={isGeneratingVideo || !aiPrompt.trim()}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl gap-2"
                  >
                    {isGeneratingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {isGeneratingVideo ? 'Generating 3D Video...' : 'Generate 3D Video with AI'}
                  </Button>

                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={handleUploadGiftVideoFile}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploadingVideo}
                    onClick={() => videoFileInputRef.current?.click()}
                    className="rounded-xl font-bold gap-2 border-indigo-500/40 text-indigo-300"
                  >
                    {isUploadingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload MP4/WebM
                  </Button>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <Label className="text-xs font-semibold">
                    Or Paste Direct Gift Video URL (MP4 / WebM)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={previewVideoUrl}
                      onChange={(e) => setPreviewVideoUrl(e.target.value)}
                      placeholder="https://firebasestorage.googleapis.com/.../lion.mp4"
                      className="text-xs"
                    />
                    <Button
                      onClick={handlePublishGiftVideo}
                      disabled={isSavingVideo || !previewVideoUrl.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-1.5 shrink-0"
                    >
                      {isSavingVideo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Publish to Live Catalog
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Stage Screen-Blend Transparency Preview */}
              <div className="lg:col-span-5 flex flex-col">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Live Stream Stage Transparency Preview (mix-blend-screen)
                </Label>
                <div className="relative flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-indigo-500/30 bg-gradient-to-b from-slate-900 via-indigo-950/60 to-slate-950 flex items-center justify-center">
                  <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-slate-300">
                    Simulated Live Camera Feed
                  </div>
                  {previewVideoUrl ? (
                    <video
                      key={previewVideoUrl}
                      src={previewVideoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full max-h-[320px] object-contain mix-blend-screen pointer-events-none"
                    />
                  ) : (
                    <div className="text-center p-6 text-muted-foreground space-y-2">
                      <Video className="h-10 w-10 mx-auto opacity-40" />
                      <p className="text-xs font-semibold">
                        Generate or upload a video for{' '}
                        <span className="text-white font-bold">
                          {GIFT_PRESETS.find((g) => g.id === selectedGiftId)?.name}
                        </span>{' '}
                        to preview it on stage.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
