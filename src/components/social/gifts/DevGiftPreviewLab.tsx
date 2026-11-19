'use client';

import React, { useCallback, useRef, useState } from 'react';
import KingLionGift from './KingLionGift';
import RoyalCrownSvgGift, { RoyalCrownSvgPreview } from './RoyalCrownSvgGift';
import GiftTakeoverEngine from './GiftTakeoverEngine';
import UniverseGift from './UniverseGift';
import Phoenix3DGift from './Phoenix3DGift';
import { useGiftQueueManager } from '@/lib/gift-queue-manager';
import { GIFT_CATALOG } from '@/components/social/live-stream-view';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  RotateCcw,
  Trash2,
  Layers,
  Smartphone,
  Monitor,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

type PreviewGiftId = 'lion' | 'crown' | 'yacht' | 'phoenix' | 'car' | 'rocket' | 'universe';

interface TelemetryEntry {
  runId: string;
  giftId: PreviewGiftId;
  giftName: string;
  senderName: string;
  combo: number;
  source: 'direct' | 'queue';
  startedAtMs: number;
  completedAtMs?: number;
  durationMs?: number;
  onCompleteCount: number;
}

const PRESET_SENDERS = [
  {
    name: 'King_Amoma',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=KingAmoma',
  },
  {
    name: 'Queen_Zara',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=QueenZara',
  },
  {
    name: 'VIP_Emperor',
    avatar: '',
  },
];

export default function DevGiftPreviewLab() {
  return <DevGiftPreviewLabInner />;
}

function DevGiftPreviewLabInner() {
  const [senderName, setSenderName] = useState<string>('Lonkind');
  const [senderAvatar, setSenderAvatar] = useState<string>(
    'https://api.dicebear.com/7.x/avataaars/svg?seed=KingAmoma'
  );
  const [comboCount, setComboCount] = useState<number>(5);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'ios' | 'android'>('desktop');
  const [customVideoUrl, setCustomVideoUrl] = useState<string>('');

  // Direct standalone preview state
  const [directGift, setDirectGift] = useState<{
    runId: string;
    giftId: PreviewGiftId;
    senderName: string;
    senderAvatar?: string;
    combo: number;
    videoUrl?: string;
  } | null>(null);
  const [lastTriggeredGiftId, setLastTriggeredGiftId] = useState<PreviewGiftId>('lion');

  // Telemetry log to prove onComplete fires strictly once per run
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [duplicateGuardStatus, setDuplicateGuardStatus] = useState<string>(
    'Active — SuperGiftOverlay is automatically suppressed while [data-live-gift-stage="active"] is mounted.'
  );

  // Real Gift Queue Manager hook (isolated room ID, zero Firebase/API calls)
  const {
    activeGift: queuedActiveGift,
    queuedGifts,
    enqueueGift,
    completeActiveGift,
    resetGiftQueue: clearQueue,
  } = useGiftQueueManager('dev-preview-sandbox-room');

  const queueRunStartRef = useRef<Record<string, number>>({});

  const GIFT_LABELS: Record<PreviewGiftId, { name: string; icon: string; price: number }> = {
    lion: { name: 'Golden Lion (Cloudflare)', icon: '🦁', price: 20000 },
    yacht: { name: 'Luxury Yacht', icon: '🛥️', price: 30000 },
    phoenix: { name: 'Fire Phoenix', icon: '🦅', price: 40000 },
    car: { name: 'Neon Supercar', icon: '🏎️', price: 5000 },
    rocket: { name: 'Space Rocket', icon: '🚀', price: 10000 },
    crown: { name: 'Royal Crown', icon: '👑', price: 2500 },
    universe: { name: 'Universe', icon: '🌌', price: 50000 },
  };

  // Trigger a direct standalone animation
  const triggerDirectGift = useCallback(
    (giftId: PreviewGiftId) => {
      clearQueue();
      const runId = `direct-${giftId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const giftName = GIFT_LABELS[giftId]?.name || giftId;
      const now = performance.now();

      setLastTriggeredGiftId(giftId);
      setDirectGift({
        runId,
        giftId,
        senderName: senderName.trim() || 'Lonkind',
        senderAvatar: senderAvatar.trim() || undefined,
        combo: Math.max(1, comboCount),
        videoUrl: customVideoUrl.trim() || undefined,
      });

      setTelemetry((prev) => [
        {
          runId,
          giftId,
          giftName,
          senderName: senderName.trim() || 'Lonkind',
          combo: Math.max(1, comboCount),
          source: 'direct',
          startedAtMs: now,
          onCompleteCount: 0,
        },
        ...prev.slice(0, 14),
      ]);
    },
    [clearQueue, comboCount, customVideoUrl, senderAvatar, senderName]
  );

  // Replay current or last triggered animation from 0.0s
  const handleReplay = useCallback(() => {
    const targetGiftId =
      directGift?.giftId ||
      ((queuedActiveGift?.giftId as PreviewGiftId) || lastTriggeredGiftId);
    triggerDirectGift(targetGiftId);
  }, [directGift, lastTriggeredGiftId, queuedActiveGift, triggerDirectGift]);

  // Reset stage and queue
  const handleResetAll = useCallback(() => {
    setDirectGift(null);
    clearQueue();
  }, [clearQueue]);

  // Direct onComplete handler with strict call-count tracking
  const handleDirectComplete = useCallback((runId: string) => {
    const completedAt = performance.now();
    setTelemetry((prev) =>
      prev.map((entry) =>
        entry.runId === runId
          ? {
              ...entry,
              completedAtMs: completedAt,
              durationMs: Math.round(completedAt - entry.startedAtMs),
              onCompleteCount: entry.onCompleteCount + 1,
            }
          : entry
      )
    );
    setDirectGift((current) => (current?.runId === runId ? null : current));
  }, []);

  // Enqueue gift into real useGiftQueueManager
  const handleEnqueueGift = useCallback(
    (giftId: PreviewGiftId, customSender?: string, customCombo?: number) => {
      setDirectGift(null);
      const catalogItem = GIFT_CATALOG.find((g) => g.id === giftId) || {
        id: giftId,
        name: GIFT_LABELS[giftId]?.name || giftId,
        icon: GIFT_LABELS[giftId]?.icon || '🎁',
        price: GIFT_LABELS[giftId]?.price || 10000,
        color: 'from-amber-500 to-yellow-500',
        isSuper: true,
        videoUrl: customVideoUrl.trim() || '',
      };

      const effectiveSender = customSender || senderName.trim() || 'Lonkind';
      const effectiveCombo = customCombo ?? Math.max(1, comboCount);

      const item = enqueueGift({
        roomId: 'dev-preview-sandbox-room',
        gift: catalogItem,
        senderId: `dev-${effectiveSender}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        senderName: effectiveSender,
        senderAvatar: senderAvatar.trim() || undefined,
        quantity: effectiveCombo,
      });

      const now = performance.now();
      queueRunStartRef.current[item.queueId] = now;

      setTelemetry((prev) => {
        if (prev.some((e) => e.runId === item.queueId)) {
          return prev.map((e) =>
            e.runId === item.queueId ? { ...e, combo: item.combo } : e
          );
        }
        return [
          {
            runId: item.queueId,
            giftId,
            giftName: catalogItem.name,
            senderName: item.displaySenderLabel,
            combo: item.combo,
            source: 'queue',
            startedAtMs: now,
            onCompleteCount: 0,
          },
          ...prev.slice(0, 14),
        ];
      });
    },
    [comboCount, customVideoUrl, enqueueGift, senderAvatar, senderName]
  );

  // Enqueue a 3-gift sequence to test automatic queue advancement
  const handleEnqueueSequence = useCallback(() => {
    setDirectGift(null);
    clearQueue();
    window.setTimeout(() => {
      handleEnqueueGift('lion', 'Lonkind_Lion', 2);
      handleEnqueueGift('yacht', 'Lonkind_Yacht', 5);
      handleEnqueueGift('phoenix', 'Lonkind_Phoenix', 10);
    }, 30);
  }, [clearQueue, handleEnqueueGift]);

  // Queue onComplete wrapper to record telemetry before advancing queue
  const handleQueueItemComplete = useCallback(
    (queueId: string) => {
      const completedAt = performance.now();
      setTelemetry((prev) =>
        prev.map((entry) =>
          entry.runId === queueId
            ? {
                ...entry,
                completedAtMs: completedAt,
                durationMs: Math.round(
                  completedAt - (queueRunStartRef.current[queueId] || entry.startedAtMs)
                ),
                onCompleteCount: entry.onCompleteCount + 1,
              }
            : entry
        )
      );
      completeActiveGift();
    },
    [completeActiveGift]
  );

  // Test duplicate-playback guard against SuperGiftOverlay
  const handleTestSuperGiftCollision = useCallback(() => {
    triggerDirectGift('lion');
    window.dispatchEvent(
      new CustomEvent('super-gift', {
        detail: {
          label: 'Golden Lion',
          emoji: '🦁',
          coins: 20000,
          senderName: senderName || 'Collision_Tester',
          recipientName: 'Host',
        },
      })
    );
    const hasStageMarker = Boolean(
      document.querySelector('[data-live-gift-stage="active"]')
    );
    setDuplicateGuardStatus(
      hasStageMarker
        ? 'PASS — Dispatched window "super-gift" event while stage marker [data-live-gift-stage="active"] was mounted. SuperGiftOverlay ignored the duplicate event; only 1 animation played.'
        : 'WARN — Stage marker not found.'
    );
  }, [senderName, triggerDirectGift]);

  const frameSizeClasses =
    viewportMode === 'ios'
      ? 'w-[390px] h-[720px] rounded-[42px] border-4 border-slate-700'
      : viewportMode === 'android'
      ? 'w-[412px] h-[740px] rounded-[36px] border-4 border-slate-700'
      : 'w-full h-[680px] rounded-3xl border border-white/15';

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      {/* Stage Marker so SuperGiftOverlay knows a live gift stage is mounted */}
      <div data-live-gift-stage="active" className="hidden" aria-hidden="true" />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-amber-400/30 rounded-2xl p-4 shadow-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[11px] font-black uppercase tracking-wider">
                DEV ONLY SANDBOX
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
                Zero Coin Deduction • Zero Firebase Writes
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Virtual Gifts Visual Testing System (Golden Lion 🦁 & Royal Crown 👑)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Unavailable in production builds (`NODE_ENV === &apos;production&apos;` returns 404).
            </p>
          </div>

          {/* Viewport Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-white/10 self-start">
            <button
              type="button"
              onClick={() => setViewportMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewportMode === 'desktop'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewportMode('ios')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewportMode === 'ios'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              iOS (390px)
            </button>
            <button
              type="button"
              onClick={() => setViewportMode('android')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewportMode === 'android'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Android (412px)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls, Customizer, Queue & Telemetry */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Independent Trigger, Replay & Reset Controls */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" />
                1. Trigger Any Gift on Stage (Zero Coin Cost)
              </h2>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => triggerDirectGift('lion')}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-500 text-black font-black text-xs shadow-lg hover:brightness-110 active:scale-95 transition"
                >
                  <span>🦁</span>
                  <span>Cloudflare Lion</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDirectGift('yacht')}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white font-black text-xs shadow-lg hover:brightness-110 active:scale-95 transition"
                >
                  <span>🛥️</span>
                  <span>Luxury Yacht (Veo)</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDirectGift('phoenix')}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-400 text-white font-black text-xs shadow-lg hover:brightness-110 active:scale-95 transition"
                >
                  <span>🦅</span>
                  <span>Fire Phoenix (Veo)</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDirectGift('crown')}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black font-black text-xs shadow-lg hover:brightness-110 active:scale-95 transition"
                >
                  <span>👑</span>
                  <span>Royal Crown</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDirectGift('car')}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white font-bold text-xs shadow hover:brightness-110 active:scale-95 transition"
                >
                  <span>🏎️</span>
                  <span>Neon Supercar</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDirectGift('universe')}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-bold text-xs shadow hover:brightness-110 active:scale-95 transition"
                >
                  <span>🌌</span>
                  <span>Universe</span>
                </button>
              </div>

              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Optional Custom Video URL / Cloudflare ID to Test:
                </label>
                <input
                  type="text"
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                  placeholder="Paste any .mp4, .webm, .m3u8, or Cloudflare Video ID..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleReplay}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs transition active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Replay Animation</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetAll}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 font-bold text-xs transition active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reset / Clear Stage</span>
                </button>
              </div>
            </div>

            {/* 2. Sender Name, Avatar & Combo Count Customizer */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                2. Sender Name, Avatar & Combo Count
              </h2>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_SENDERS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setSenderName(preset.name);
                      setSenderAvatar(preset.avatar);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      senderName === preset.name
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    @{preset.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Enter sender username"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Sender Avatar URL (leave blank to test initial fallback)
                  </label>
                  <input
                    type="text"
                    value={senderAvatar}
                    onChange={(e) => setSenderAvatar(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Combo Count (`x{comboCount}`)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 3, 5, 10, 99].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setComboCount(c)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black border transition ${
                          comboCount === c
                            ? 'bg-amber-400 text-black border-amber-400'
                            : 'bg-slate-950 text-slate-300 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        x{c}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={comboCount}
                      onChange={(e) => setComboCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs font-bold text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Gift Queue Advancement Tester */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  3. Gift Queue Advancement Test (`useGiftQueueManager`)
                </h2>
                <span className="text-[11px] font-bold text-slate-400">
                  Waiting: {queuedGifts.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleEnqueueGift('lion')}
                  className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-bold text-xs transition"
                >
                  + Enqueue Golden Lion
                </button>
                <button
                  type="button"
                  onClick={() => handleEnqueueGift('crown')}
                  className="py-2 px-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/40 text-yellow-200 font-bold text-xs transition"
                >
                  + Enqueue Royal Crown
                </button>
              </div>

              <button
                type="button"
                onClick={handleEnqueueSequence}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-200 font-extrabold text-xs transition"
              >
                Enqueue 3-Gift Queue Burst (Lion x2 → Crown x5 → Lion x10)
              </button>

              <div className="rounded-xl bg-slate-950 border border-white/10 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Active Stage Item:</span>
                  <span className="font-bold text-emerald-400">
                    {queuedActiveGift
                      ? `${queuedActiveGift.giftName} (${queuedActiveGift.displaySenderLabel} x${queuedActiveGift.combo})`
                      : directGift
                      ? `Direct: ${directGift.giftId === 'lion' ? 'Golden Lion' : 'Royal Crown'} (x${directGift.combo})`
                      : 'Idle'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Next in Queue:</span>
                  <span className="font-bold text-amber-300">
                    {queuedGifts.length > 0
                      ? queuedGifts.map((q) => `${q.giftName} x${q.combo}`).join(' → ')
                      : 'Empty'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Duplicate-Playback Guard & Gift Drawer Preview Cards */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                4. Stage vs. SuperGiftOverlay Guard & Drawer Previews
              </h2>

              <button
                type="button"
                onClick={handleTestSuperGiftCollision}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-bold text-xs transition"
              >
                Test Duplicate Guard (Dispatch `super-gift` While Stage Active)
              </button>
              <p className="text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-white/10">
                {duplicateGuardStatus}
              </p>

              {/* Drawer Preview Cards */}
              <div className="pt-1">
                <p className="text-[11px] font-bold text-slate-400 mb-2">
                  Gift Drawer Preview Cards (Click to test):
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => triggerDirectGift('lion')}
                    className="flex flex-col items-center p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition group relative"
                  >
                    <span className="font-bold text-white text-xs mb-1">🦁 Lion (CF)</span>
                    <Badge className="bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border-none">
                      L 20,000
                    </Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerDirectGift('yacht')}
                    className="flex flex-col items-center p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-cyan-400/50 transition group relative"
                  >
                    <span className="font-bold text-white text-xs mb-1">🛥️ Yacht</span>
                    <Badge className="bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border-none">
                      L 30,000
                    </Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerDirectGift('phoenix')}
                    className="flex flex-col items-center p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-orange-400/50 transition group relative"
                  >
                    <span className="font-bold text-white text-xs mb-1">🦅 Phoenix</span>
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border-none">
                      L 40,000
                    </Badge>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Simulated Live Stream Stage + Telemetry Log */}
          <div className="lg:col-span-7 flex flex-col items-center space-y-4">
            {/* Simulated Live Stream Camera Stage */}
            <div
              className={`relative overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950/60 to-slate-950 shadow-2xl flex flex-col justify-between p-4 transition-all ${frameSizeClasses}`}
            >
              {/* Simulated Top Live Stream HUD */}
              <div className="flex items-center justify-between z-10 pointer-events-none">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-extrabold text-white">LIVE STAGE PREVIEW</span>
                  <span className="text-[11px] text-slate-300">({viewportMode.toUpperCase()})</span>
                </div>

                {queuedGifts.length > 0 && (
                  <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-black">
                    QUEUE: +{queuedGifts.length} NEXT
                  </div>
                )}
              </div>

              {/* Center Placeholder Info When Idle */}
              {!directGift && !queuedActiveGift && (
                <div className="my-auto text-center max-w-sm mx-auto space-y-2 pointer-events-none">
                  <p className="text-sm font-extrabold text-white/90">
                    Stage Ready — Click any Gift on the left (Lion 🦁, Yacht 🛥️, Phoenix 🦅, Crown 👑)
                  </p>
                  <p className="text-xs text-slate-400">
                    Test how each animation looks over the live stream stage before publishing to the live site!
                  </p>
                </div>
              )}

              {/* Simulated Bottom Chat Preview */}
              <div className="space-y-1.5 z-10 pointer-events-none">
                <div className="inline-block bg-black/45 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] text-slate-300 border border-white/10">
                  💬 <strong className="text-amber-300">@{senderName || 'Lonkind'}</strong> joined the preview room
                </div>
              </div>

              {/* Direct Standalone Animation Render */}
              {directGift?.giftId === 'lion' && (
                <KingLionGift
                  key={directGift.runId}
                  senderName={directGift.senderName}
                  senderAvatar={directGift.senderAvatar}
                  combo={directGift.combo}
                  cloudflareVideoIdOrUrl={directGift.videoUrl}
                  onComplete={() => handleDirectComplete(directGift.runId)}
                />
              )}

              {directGift?.giftId === 'crown' && (
                <RoyalCrownSvgGift
                  key={directGift.runId}
                  senderName={directGift.senderName}
                  senderAvatar={directGift.senderAvatar}
                  combo={directGift.combo}
                  onComplete={() => handleDirectComplete(directGift.runId)}
                />
              )}

              {directGift?.giftId === 'universe' && (
                <UniverseGift
                  key={directGift.runId}
                  senderName={directGift.senderName}
                  senderAvatar={directGift.senderAvatar}
                  combo={directGift.combo}
                  onComplete={() => handleDirectComplete(directGift.runId)}
                />
              )}

              {directGift?.giftId === 'phoenix' && (
                <Phoenix3DGift
                  key={directGift.runId}
                  senderName={directGift.senderName}
                  senderAvatar={directGift.senderAvatar}
                  combo={directGift.combo}
                  onComplete={() => handleDirectComplete(directGift.runId)}
                />
              )}

              {directGift &&
                directGift.giftId !== 'lion' &&
                directGift.giftId !== 'crown' &&
                directGift.giftId !== 'universe' &&
                directGift.giftId !== 'phoenix' && (
                  <GiftTakeoverEngine
                    key={directGift.runId}
                    event={{
                      id: directGift.runId,
                      giftId: directGift.giftId,
                      giftName: GIFT_LABELS[directGift.giftId]?.name || directGift.giftId,
                      price: GIFT_LABELS[directGift.giftId]?.price || 30000,
                      senderName: directGift.senderName,
                      senderAvatar: directGift.senderAvatar,
                      combo: directGift.combo,
                      videoUrl:
                        directGift.videoUrl ||
                        (directGift.giftId === 'yacht'
                          ? '/gifts/yacht_veo.mp4'
                          : undefined),
                    }}
                    onComplete={() => handleDirectComplete(directGift.runId)}
                  />
                )}

              {/* Queued Stage Animation Render (from useGiftQueueManager) */}
              {!directGift && queuedActiveGift?.giftId === 'lion' && (
                <KingLionGift
                  key={queuedActiveGift.queueId}
                  senderName={queuedActiveGift.displaySenderLabel}
                  senderAvatar={queuedActiveGift.senderAvatar}
                  combo={queuedActiveGift.combo}
                  onComplete={() => handleQueueItemComplete(queuedActiveGift.queueId)}
                />
              )}

              {!directGift && queuedActiveGift?.giftId === 'crown' && (
                <RoyalCrownSvgGift
                  key={queuedActiveGift.queueId}
                  senderName={queuedActiveGift.displaySenderLabel}
                  senderAvatar={queuedActiveGift.senderAvatar}
                  combo={queuedActiveGift.combo}
                  onComplete={() => handleQueueItemComplete(queuedActiveGift.queueId)}
                />
              )}

              {!directGift && queuedActiveGift?.giftId === 'phoenix' && (
                <Phoenix3DGift
                  key={queuedActiveGift.queueId}
                  senderName={queuedActiveGift.displaySenderLabel}
                  senderAvatar={queuedActiveGift.senderAvatar}
                  combo={queuedActiveGift.combo}
                  onComplete={() => handleQueueItemComplete(queuedActiveGift.queueId)}
                />
              )}

              {!directGift &&
                queuedActiveGift &&
                queuedActiveGift.giftId !== 'lion' &&
                queuedActiveGift.giftId !== 'crown' &&
                queuedActiveGift.giftId !== 'phoenix' && (
                  <GiftTakeoverEngine
                    key={queuedActiveGift.queueId}
                    event={{
                      id: queuedActiveGift.queueId,
                      giftId: queuedActiveGift.giftId,
                      giftName: queuedActiveGift.giftName,
                      price: queuedActiveGift.price,
                      senderName: queuedActiveGift.displaySenderLabel,
                      senderAvatar: queuedActiveGift.senderAvatar,
                      combo: queuedActiveGift.combo,
                      videoUrl:
                        queuedActiveGift.videoUrl ||
                        (queuedActiveGift.giftId === 'yacht'
                          ? '/gifts/yacht_veo.mp4'
                          : queuedActiveGift.giftId === 'phoenix'
                          ? '/gifts/phoenix_veo.mp4'
                          : undefined),
                    }}
                    onComplete={() => handleQueueItemComplete(queuedActiveGift.queueId)}
                  />
                )}
            </div>

            {/* 5. onComplete Single-Fire Telemetry Log */}
            <div className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  5. `onComplete` Single-Fire Verification Log
                </h2>
                <button
                  type="button"
                  onClick={() => setTelemetry([])}
                  className="text-[11px] text-slate-400 hover:text-white font-semibold"
                >
                  Clear Log
                </button>
              </div>

              {telemetry.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No runs recorded yet. Trigger an animation above to verify `onComplete` call count and timing.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {telemetry.map((entry) => (
                    <div
                      key={entry.runId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span>{entry.giftId === 'lion' ? '🦁' : '👑'}</span>
                        <span className="font-bold text-white">{entry.giftName}</span>
                        <span className="text-slate-400">
                          ({entry.senderName} • x{entry.combo} • {entry.source})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.durationMs !== undefined && (
                          <span className="text-[11px] text-slate-400">
                            {(entry.durationMs / 1000).toFixed(2)}s
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                            entry.onCompleteCount === 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                              : entry.onCompleteCount === 1
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                          }`}
                        >
                          {entry.onCompleteCount === 0
                            ? 'PLAYING (0 calls)'
                            : entry.onCompleteCount === 1
                            ? 'PASS: onComplete = 1'
                            : `ERROR: onComplete = ${entry.onCompleteCount}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
