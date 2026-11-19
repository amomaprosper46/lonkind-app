'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Gift,
  X,
  Wallet,
  Sparkles,
  Flame,
  Target,
  Heart,
  Coins,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Loader2,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface StreamGoalDoc {
  title: string;
  type: 'LIKES' | 'COINS';
  currentAmount: number;
  targetAmount: number;
}

export interface StreamGiftCatalogItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  isHighValue?: boolean;
  accent: string;
}

export const STREAM_COMBO_GIFTS: StreamGiftCatalogItem[] = [
  { id: 'rose', name: 'Rose', emoji: '🌹', price: 10, accent: 'from-rose-500/25 to-pink-500/20 border-rose-400/35' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', price: 100, accent: 'from-cyan-500/25 to-blue-500/20 border-cyan-400/35' },
  { id: 'crown', name: 'Royal Crown', emoji: '👑', price: 1000, isHighValue: true, accent: 'from-amber-500/25 to-yellow-500/20 border-amber-400/45' },
  { id: 'car', name: 'Supercar', emoji: '🏎️', price: 5000, isHighValue: true, accent: 'from-indigo-500/25 to-purple-500/20 border-indigo-400/45' },
  { id: 'yacht', name: 'Luxury Yacht', emoji: '🛥️', price: 30000, isHighValue: true, accent: 'from-sky-500/30 to-indigo-500/25 border-sky-400/50' },
  { id: 'phoenix', name: 'Fire Phoenix', emoji: '🦅', price: 40000, isHighValue: true, accent: 'from-orange-500/30 to-red-600/25 border-orange-400/55' },
];

export interface StreamGiftEventDoc {
  id: string;
  senderUid: string;
  senderName: string;
  senderHandle: string;
  senderAvatar?: string;
  giftId: string;
  giftName: string;
  giftEmoji: string;
  price: number;
  comboCount: number;
  isHighValue?: boolean;
  createdAtMs?: number;
}

// ============================================================================
// 1. REAL-TIME ANIMATED COMBO GIFT BANNER OVERLAY (ALL VIEWERS)
// ============================================================================
export function ComboGiftBannerOverlay({
  streamId,
  onHighValueGiftReceived,
}: {
  streamId: string;
  onHighValueGiftReceived?: (giftEvent: StreamGiftEventDoc) => void;
}) {
  const [banners, setBanners] = useState<StreamGiftEventDoc[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());
  const highValueCbRef = useRef(onHighValueGiftReceived);
  highValueCbRef.current = onHighValueGiftReceived;

  useEffect(() => {
    if (!streamId) return;
    mountedAtRef.current = Date.now();
    seenIdsRef.current.clear();

    const q = query(
      collection(db, 'streams', streamId, 'gifts'),
      orderBy('createdAt', 'desc'),
      limit(6)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const d = change.doc;
          if (seenIdsRef.current.has(d.id)) return;
          seenIdsRef.current.add(d.id);

          const data = d.data() as Omit<StreamGiftEventDoc, 'id'>;
          const eventTime = data.createdAtMs || Date.now();
          // Skip historical gifts from before joining the live room
          if (eventTime < mountedAtRef.current - 5000) return;

          const eventObj: StreamGiftEventDoc = { id: d.id, ...data };

          // Merge combo banner if same sender + same gift is already visible
          setBanners((prev) => {
            const existingIdx = prev.findIndex(
              (b) => b.senderUid === eventObj.senderUid && b.giftId === eventObj.giftId
            );
            if (existingIdx >= 0) {
              const next = [...prev];
              next[existingIdx] = eventObj;
              return next;
            }
            return [eventObj, ...prev].slice(0, 3);
          });

          // Celebratory burst for high-value gifts
          if (eventObj.isHighValue || eventObj.price >= 1000) {
            try {
              confetti({
                particleCount: eventObj.price >= 5000 ? 75 : 35,
                spread: 70,
                origin: { y: 0.65 },
                colors: ['#fbbf24', '#f43f5e', '#a855f7', '#38bdf8'],
              });
            } catch {
              // Ignore confetti errors
            }
            highValueCbRef.current?.(eventObj);
          }

          // Auto-dismiss banner after 4.2s of inactivity on that event ID
          window.setTimeout(() => {
            setBanners((prev) => prev.filter((b) => b.id !== eventObj.id));
          }, 4200);
        });
      },
      () => {}
    );

    return () => unsub();
  }, [streamId]);

  if (banners.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-32 left-3 sm:left-4 z-35 flex flex-col gap-2 max-w-[320px]">
      <AnimatePresence>
        {banners.map((b) => (
          <motion.div
            key={`${b.senderUid}_${b.giftId}`}
            initial={{ opacity: 0, x: -45, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className={`flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full backdrop-blur-xl border shadow-2xl ${
              b.isHighValue
                ? 'bg-gradient-to-r from-amber-500/90 via-rose-600/85 to-purple-700/85 border-amber-300/70 shadow-amber-500/35'
                : 'bg-gradient-to-r from-zinc-950/90 via-indigo-950/85 to-purple-950/85 border-indigo-400/50 shadow-indigo-500/25'
            }`}
          >
            <Avatar className="h-9 w-9 border-2 border-white/60 shrink-0">
              <AvatarImage src={b.senderAvatar} alt={b.senderName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                {b.senderName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">@{b.senderHandle || b.senderName}</p>
              <p className="text-[11px] font-semibold text-amber-100 truncate">
                sent <strong>{b.giftName}</strong> {b.giftEmoji}
              </p>
            </div>

            <motion.div
              key={b.comboCount}
              initial={{ scale: 1.55, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              className="flex items-center gap-0.5 bg-amber-400 text-black font-black text-sm px-2.5 py-0.5 rounded-full shadow-lg shrink-0"
            >
              <Flame className="h-3.5 w-3.5 fill-rose-600 text-rose-600" />
              <span>x{b.comboCount}</span>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// 2. DARK-MODE GLASSMORPHIC COMBO VIRTUAL GIFTS DRAWER
// ============================================================================
export function ComboGiftDrawer({
  isOpen,
  onClose,
  streamId,
  hostUid,
  userCoins,
  isGuest,
  onRequireAuth,
  onBalanceUpdated,
  onGiftSentLocal,
}: {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  hostUid: string;
  userCoins: number;
  isGuest?: boolean;
  onRequireAuth?: () => void;
  onBalanceUpdated?: (newCoins: number) => void;
  onGiftSentLocal?: (gift: StreamGiftCatalogItem, comboCount: number) => void;
}) {
  const [sendingGiftId, setSendingGiftId] = useState<string | null>(null);
  const [insufficientGift, setInsufficientGift] = useState<StreamGiftCatalogItem | null>(null);
  const [comboState, setComboState] = useState<{ giftId: string; count: number; expiresAt: number } | null>(null);
  const comboTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleTapGift = async (gift: StreamGiftCatalogItem) => {
    if (isGuest || !auth?.currentUser) {
      toast({ title: 'Sign In to Send Gifts', description: 'Create your Lonkind account to send gifts!' });
      onRequireAuth?.();
      return;
    }

    // Immediate client-side wallet balance check -> clean prompt linking to /settings/wallet
    if (userCoins < gift.price) {
      setInsufficientGift(gift);
      return;
    }

    setInsufficientGift(null);

    // 3-Second Combo Multiplier calculation (same gift tapped within 3000ms)
    const now = Date.now();
    const isSameCombo =
      comboState && comboState.giftId === gift.id && now < comboState.expiresAt;
    const nextCombo = isSameCombo ? comboState.count + 1 : 1;

    setComboState({ giftId: gift.id, count: nextCombo, expiresAt: now + 3000 });
    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => {
      setComboState(null);
    }, 3000);

    setSendingGiftId(gift.id);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/streams/send-gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          streamId,
          hostUid,
          giftId: gift.id,
          giftName: gift.name,
          giftEmoji: gift.emoji,
          price: gift.price,
          comboCount: nextCombo,
        }),
      });

      const data = await res.json();
      if (res.status === 402 || data.insufficientFunds) {
        setInsufficientGift(gift);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not send gift');
      }

      if (typeof data.remainingCoins === 'number') {
        onBalanceUpdated?.(data.remainingCoins);
      }
      onGiftSentLocal?.(gift, nextCombo);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gift Failed',
        description: err?.message || 'Could not complete gift transaction.',
      });
    } finally {
      setSendingGiftId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-zinc-950/95 backdrop-blur-xl border border-white/15 p-5 shadow-2xl space-y-4"
      >
        {/* Drawer Header + Live Wallet Balance */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 to-pink-600 flex items-center justify-center shadow">
              <Gift className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">Send Virtual Gift</h3>
              <p className="text-[11px] text-zinc-400">Tap repeatedly within 3s for Combo Multipliers!</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/wallet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-xs font-extrabold text-amber-300 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>{userCoins.toLocaleString()}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Insufficient Funds Prompt -> Links Directly to /settings/wallet */}
        <AnimatePresence>
          {insufficientGift && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl bg-rose-950/50 border border-rose-500/45 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-rose-200">Insufficient Wallet Balance</p>
                  <p className="text-rose-200/80 mt-0.5">
                    <strong>{insufficientGift.name}</strong> costs{' '}
                    <strong>{insufficientGift.price.toLocaleString()} Coins</strong>, and you currently have{' '}
                    <strong>{userCoins.toLocaleString()} Coins</strong>.
                  </p>
                </div>
              </div>
              <Button
                asChild
                size="sm"
                className="rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shrink-0 gap-1"
              >
                <Link href="/settings/wallet">
                  Top Up Wallet <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 6 Virtual Gift Cards Grid */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {STREAM_COMBO_GIFTS.map((gift) => {
            const activeCombo =
              comboState && comboState.giftId === gift.id ? comboState.count : 0;
            const isBusy = sendingGiftId === gift.id;
            const canAfford = userCoins >= gift.price;

            return (
              <motion.button
                key={gift.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                disabled={Boolean(sendingGiftId)}
                onClick={() => handleTapGift(gift)}
                className={`relative flex flex-col items-center p-3 rounded-2xl bg-gradient-to-b border transition-all text-center ${
                  activeCombo > 0
                    ? 'from-amber-500/30 to-rose-600/25 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                    : gift.accent
                } ${!canAfford ? 'opacity-70' : 'hover:scale-[1.03]'}`}
              >
                {activeCombo > 0 && (
                  <motion.span
                    key={activeCombo}
                    initial={{ scale: 1.4 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-1.5 z-10 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black shadow-lg"
                  >
                    {activeCombo}x COMBO
                  </motion.span>
                )}

                {gift.isHighValue && activeCombo === 0 && (
                  <span className="absolute -top-2 left-1.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wider">
                    3D FX
                  </span>
                )}

                <span className="text-3xl sm:text-4xl mb-1.5 drop-shadow">
                  {isBusy ? <Loader2 className="h-8 w-8 animate-spin text-amber-300" /> : gift.emoji}
                </span>
                <span className="text-xs font-extrabold text-white truncate w-full">{gift.name}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-300">
                  <Coins className="h-3 w-3" />
                  {gift.price.toLocaleString()}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Footer Wallet Top-Up Strip */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <span className="text-zinc-400">
            Wallet: <strong className="text-amber-300">{userCoins.toLocaleString()} Coins</strong>
          </span>
          <Link
            href="/settings/wallet"
            className="text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1"
          >
            Recharge Coins <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// 3. REAL-TIME LIVE STREAM GOALS PROGRESS BAR (`streams/{streamId}.streamGoal`)
// ============================================================================
export function LiveStreamGoalBar({
  streamId,
  isHost,
  onEditGoalClick,
}: {
  streamId: string;
  isHost: boolean;
  onEditGoalClick?: () => void;
}) {
  const [goal, setGoal] = useState<StreamGoalDoc | null>(null);
  const celebratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!streamId) return;
    const unsub = onSnapshot(
      doc(db, 'streams', streamId),
      (snap) => {
        if (!snap.exists()) return;
        const g = snap.data()?.streamGoal as StreamGoalDoc | null | undefined;
        if (g && g.title && g.targetAmount > 0) {
          setGoal(g);
          const goalKey = `${g.title}_${g.targetAmount}_${g.type}`;
          if (g.currentAmount >= g.targetAmount && celebratedRef.current !== goalKey) {
            celebratedRef.current = goalKey;
            try {
              confetti({
                particleCount: 90,
                spread: 80,
                origin: { y: 0.25 },
                colors: ['#34d399', '#fbbf24', '#f43f5e', '#818cf8'],
              });
            } catch {
              // Ignore confetti errors
            }
          }
        } else {
          setGoal(null);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [streamId]);

  if (!goal) return null;

  const current = Math.max(0, Number(goal.currentAmount || 0));
  const target = Math.max(1, Number(goal.targetAmount || 1));
  const pct = Math.min(100, Math.round((current / target) * 100));
  const isCompleted = current >= target;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-16 right-3 sm:right-5 z-30 w-56 sm:w-64 rounded-2xl backdrop-blur-xl border p-3 shadow-2xl pointer-events-auto transition-all ${
        isCompleted
          ? 'bg-emerald-950/85 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
          : 'bg-zinc-950/80 border-white/15 shadow-black/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {goal.type === 'LIKES' ? (
            <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400 shrink-0" />
          ) : (
            <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
          <span className="text-[11px] font-extrabold text-white truncate">{goal.title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isCompleted ? (
            <Badge className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0 gap-0.5">
              <CheckCircle2 className="h-2.5 w-2.5" /> 100%!
            </Badge>
          ) : (
            <span className="text-[10px] font-mono font-black text-indigo-300">{pct}%</span>
          )}
          {isHost && onEditGoalClick && (
            <button
              type="button"
              onClick={onEditGoalClick}
              title="Edit Live Goal"
              className="p-0.5 text-zinc-400 hover:text-white rounded"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Glowing Animated Progress Track */}
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className={`h-full rounded-full ${
            isCompleted
              ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500'
              : goal.type === 'LIKES'
              ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400'
              : 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500'
          }`}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold">
        <span className={isCompleted ? 'text-emerald-300 font-bold' : 'text-zinc-300'}>
          {isCompleted ? '🎉 Goal Unlocked!' : `${current.toLocaleString()} / ${target.toLocaleString()}`}
        </span>
        <span className="text-zinc-400 uppercase tracking-wider text-[9px]">
          {goal.type === 'LIKES' ? 'Likes' : 'Coins'}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// 4. HOST "SET / EDIT LIVE STREAM GOAL" MODAL (DURING STREAM)
// ============================================================================
export function EditStreamGoalModal({
  isOpen,
  onClose,
  streamId,
  hostUid,
}: {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  hostUid: string;
}) {
  const [title, setTitle] = useState('Sing a custom song 🎵');
  const [type, setType] = useState<'LIKES' | 'COINS'>('COINS');
  const [targetAmount, setTargetAmount] = useState<string>('1000');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const numTarget = Math.max(10, parseInt(targetAmount, 10) || 100);
    if (!cleanTitle) return;

    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'streams', streamId),
        {
          id: streamId,
          hostUid,
          streamGoal: {
            title: cleanTitle,
            type,
            currentAmount: 0,
            targetAmount: numTarget,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({
        title: '🎯 Live Stream Goal Active!',
        description: `${cleanTitle} — Target: ${numTarget.toLocaleString()} ${type === 'LIKES' ? 'Likes' : 'Coins'}`,
      });
      onClose();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save stream goal.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearGoal = async () => {
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'streams', streamId),
        { streamGoal: null, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast({ title: 'Stream Goal Cleared' });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-3xl bg-zinc-950 border border-white/15 p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-400" />
            <h3 className="font-extrabold text-sm text-white">Set Live Stream Goal</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-zinc-400">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Goal Title</label>
            <Input
              value={title}
              maxLength={50}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sing a custom song or Unlock Q&A"
              className="h-10 rounded-xl bg-zinc-900 border-white/15 text-white text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Target Type</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setType('COINS')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  type === 'COINS'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <Coins className="h-4 w-4" /> COINS (Gifts)
              </button>
              <button
                type="button"
                onClick={() => setType('LIKES')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  type === 'LIKES'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <Heart className="h-4 w-4" /> LIKES (Hearts)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Target Number</label>
            <Input
              type="number"
              min={10}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="h-10 rounded-xl bg-zinc-900 border-white/15 text-white text-sm font-mono"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(type === 'LIKES' ? [100, 500, 1000, 5000] : [500, 1000, 5000, 10000]).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTargetAmount(String(n))}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-zinc-300"
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={handleClearGoal}
              className="text-xs text-rose-400 hover:bg-rose-500/10 gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove Goal
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white font-bold text-xs px-5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Save Goal
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
