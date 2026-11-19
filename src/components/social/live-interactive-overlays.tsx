'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  runTransaction,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Plus,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  Heart,
  Flame,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface LivePollOption {
  id: string;
  text: string;
}

export interface LivePollDoc {
  id: string;
  question: string;
  options: LivePollOption[];
  votes: Record<string, number>;
  voters: Record<string, string>; // userId -> optionId (enforces 1 vote per authenticated userId)
  totalVotes: number;
  createdBy: string;
  durationSec: number;
  expiresAtMs: number;
  status: 'active' | 'ended';
}

// ============================================================================
// 1. HOST "CREATE 30-SECOND LIVE POLL" MODAL
// ============================================================================
export function CreateLivePollModal({
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
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 4) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeOption = (idx: number, val: string) => {
    setOptions((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleLaunchPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = question.trim();
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);

    if (cleanQ.length < 3) {
      toast({ variant: 'destructive', title: 'Enter a Poll Question', description: 'Please type a short question for your viewers.' });
      return;
    }
    if (cleanOpts.length < 2) {
      toast({ variant: 'destructive', title: 'Add At Least 2 Options', description: 'Polls need between 2 and 4 options.' });
      return;
    }

    setIsCreating(true);
    try {
      const optionObjs: LivePollOption[] = cleanOpts.map((text, idx) => ({
        id: `opt_${idx + 1}`,
        text,
      }));
      const initialVotes: Record<string, number> = {};
      optionObjs.forEach((o) => {
        initialVotes[o.id] = 0;
      });

      const durationSec = 30;
      const expiresAtMs = Date.now() + durationSec * 1000;

      // Ensure parent stream doc exists and create poll inside `streams/{streamId}/polls`
      await setDoc(doc(db, 'streams', streamId), { id: streamId, hostUid, updatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(db, 'streams', streamId, 'polls'), {
        question: cleanQ,
        options: optionObjs,
        votes: initialVotes,
        voters: {},
        totalVotes: 0,
        createdBy: hostUid,
        durationSec,
        expiresAtMs,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      toast({
        title: '📊 30-Second Live Poll Started!',
        description: 'Viewers can now vote in real time.',
      });
      setQuestion('');
      setOptions(['', '']);
      onClose();
    } catch (err) {
      console.error('[CreateLivePollModal] Error:', err);
      toast({ variant: 'destructive', title: 'Could Not Start Poll', description: 'Please try again.' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="w-full max-w-md rounded-3xl bg-zinc-950 border border-white/15 p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Launch 30s Live Poll</h3>
              <p className="text-[11px] text-zinc-400">Ask your viewers and watch live results roll in</p>
            </div>
          </div>
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

        <form onSubmit={handleLaunchPoll} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Poll Question</label>
            <Input
              value={question}
              maxLength={90}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What should we do next?"
              className="h-11 rounded-xl bg-zinc-900 border-white/15 text-white text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300">Options (2–4)</label>
              {options.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    maxLength={40}
                    onChange={(e) => handleChangeOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="h-10 rounded-xl bg-zinc-900 border-white/15 text-white text-xs"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      className="h-9 w-9 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-xs text-zinc-400">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs px-5 gap-1.5"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
              Start 30s Poll
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================================================
// 2. FLOATING REAL-TIME INTERACTIVE POLL CARD (ALL VIEWERS & HOST)
// ============================================================================
export function LivePollOverlay({
  streamId,
  currentUserId,
  isHost,
  isGuest,
  onRequireAuth,
}: {
  streamId: string;
  currentUserId: string;
  isHost: boolean;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}) {
  const [activePoll, setActivePoll] = useState<LivePollDoc | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [dismissedPollId, setDismissedPollId] = useState<string | null>(null);

  // Subscribe to the latest poll in `streams/{streamId}/polls`
  useEffect(() => {
    if (!streamId) return;
    const pollsQ = query(
      collection(db, 'streams', streamId, 'polls'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(
      pollsQ,
      (snap) => {
        if (snap.empty) {
          setActivePoll(null);
          return;
        }
        const d = snap.docs[0];
        const data = d.data() as Omit<LivePollDoc, 'id'>;
        const poll: LivePollDoc = { id: d.id, ...data };
        // Keep visible while active or within 8 seconds after expiry so viewers see final results
        const now = Date.now();
        if (poll.status === 'ended' && now > (poll.expiresAtMs || 0) + 8000) {
          setActivePoll(null);
          return;
        }
        if (now > (poll.expiresAtMs || 0) + 12000) {
          setActivePoll(null);
          return;
        }
        setActivePoll(poll);
      },
      (err) => {
        console.warn('[LivePollOverlay] listener warning:', err);
      }
    );
    return () => unsub();
  }, [streamId]);

  // 1-second countdown ticker
  useEffect(() => {
    if (!activePoll) return;
    const updateTick = () => {
      const remaining = Math.max(0, Math.ceil((activePoll.expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    updateTick();
    const timer = window.setInterval(updateTick, 500);
    return () => window.clearInterval(timer);
  }, [activePoll]);

  const handleVote = async (optionId: string) => {
    if (!activePoll) return;
    if (isGuest || !currentUserId) {
      toast({ title: 'Sign In to Vote', description: 'Sign in to participate in live polls!' });
      onRequireAuth?.();
      return;
    }
    if (secondsLeft <= 0 || activePoll.status === 'ended') {
      toast({ title: 'Poll Ended', description: 'Voting has closed for this poll.' });
      return;
    }
    if (activePoll.voters?.[currentUserId]) {
      toast({ title: 'Already Voted', description: 'You can only cast 1 vote per poll.' });
      return;
    }

    setVotingOptionId(optionId);
    const pollRef = doc(db, 'streams', streamId, 'polls', activePoll.id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(pollRef);
        if (!snap.exists()) return;
        const data = snap.data() as LivePollDoc;
        if (data.status === 'ended' || Date.now() > data.expiresAtMs) return;
        if (data.voters && data.voters[currentUserId]) return;

        tx.update(pollRef, {
          [`votes.${optionId}`]: increment(1),
          totalVotes: increment(1),
          [`voters.${currentUserId}`]: optionId,
        });
      });
    } catch (err) {
      console.error('[LivePollOverlay] vote error:', err);
      toast({ variant: 'destructive', title: 'Vote Failed', description: 'Could not register your vote.' });
    } finally {
      setVotingOptionId(null);
    }
  };

  const handleClosePoll = async () => {
    if (!activePoll) return;
    if (isHost && activePoll.status === 'active') {
      await updateDoc(doc(db, 'streams', streamId, 'polls', activePoll.id), {
        status: 'ended',
        expiresAtMs: Date.now(),
      }).catch(() => {});
    }
    setDismissedPollId(activePoll.id);
  };

  if (!activePoll || dismissedPollId === activePoll.id) return null;

  const myVote = currentUserId ? activePoll.voters?.[currentUserId] : undefined;
  const isClosed = secondsLeft <= 0 || activePoll.status === 'ended';
  const showResults = Boolean(myVote) || isClosed || isHost;
  const totalVotes = Math.max(0, activePoll.totalVotes || 0);

  return (
    <AnimatePresence>
      <motion.div
        key={activePoll.id}
        initial={{ opacity: 0, y: -16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.95 }}
        className="absolute top-20 left-3 sm:left-4 z-30 w-[calc(100%-24px)] max-w-[300px] rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-indigo-400/35 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] pointer-events-auto"
      >
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-indigo-600 text-white text-[9px] font-black uppercase px-2 py-0.5 gap-1">
              <BarChart3 className="h-3 w-3" />
              Live Poll
            </Badge>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                isClosed
                  ? 'bg-zinc-800 text-zinc-400'
                  : secondsLeft <= 7
                  ? 'bg-rose-500/25 text-rose-300 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              <Clock className="h-2.5 w-2.5" />
              {isClosed ? 'Ended' : `${secondsLeft}s`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClosePoll}
            title={isHost ? 'End & Dismiss Poll' : 'Dismiss Poll'}
            className="text-zinc-400 hover:text-white p-0.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm font-extrabold text-white leading-snug mb-3">
          {activePoll.question}
        </p>

        <div className="space-y-2">
          {activePoll.options.map((opt) => {
            const count = activePoll.votes?.[opt.id] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isSelected = myVote === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                disabled={Boolean(myVote) || isClosed || votingOptionId !== null}
                onClick={() => handleVote(opt.id)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-500/20'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 disabled:hover:bg-white/5'
                }`}
              >
                {/* Animated Percentage Fill Bar */}
                {showResults && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                    className={`absolute inset-y-0 left-0 pointer-events-none ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-600/55 to-purple-500/45'
                        : 'bg-white/10'
                    }`}
                  />
                )}

                <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5 truncate">
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-300 shrink-0" />}
                    <span className="truncate">{opt.text}</span>
                  </span>
                  {showResults && (
                    <span className="font-mono font-black text-[11px] text-indigo-200 shrink-0">
                      {pct}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
          <span>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
          <span>
            {myVote ? 'Vote recorded ✓' : isClosed ? 'Final results' : 'Tap an option to vote'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// 3. FLOATING HEART & REACTION ANIMATIONS + THROTTLED `likesCount` WRITER
// ============================================================================
interface FloatingHeartParticle {
  id: string;
  emoji: string;
  driftX: number;
  rotate: number;
  scale: number;
}

const REACTION_EMOJIS = ['❤️', '💖', '🔥', '💜', '✨', '❤️'];

export function FloatingHeartsController({
  streamId,
  initialLikesCount = 0,
}: {
  streamId: string;
  initialLikesCount?: number;
}) {
  const [likesCount, setLikesCount] = useState<number>(initialLikesCount);
  const [particles, setParticles] = useState<FloatingHeartParticle[]>([]);
  const pendingDeltaRef = useRef<number>(0);
  const flushTimerRef = useRef<number | null>(null);

  // Real-time listener on `streams/{streamId}` for global `likesCount` and active LIKES goal
  const activeGoalTypeRef = useRef<'LIKES' | 'COINS' | null>(null);
  useEffect(() => {
    if (!streamId) return;
    const unsub = onSnapshot(
      doc(db, 'streams', streamId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const serverLikes = data?.likesCount;
          if (typeof serverLikes === 'number') {
            setLikesCount((prev) => Math.max(prev, serverLikes));
          }
          activeGoalTypeRef.current = data?.streamGoal?.type || null;
        }
      },
      () => {}
    );
    return () => unsub();
  }, [streamId]);

  // Flush batched taps to Firestore `streams/{streamId}.likesCount` (and `streamGoal.currentAmount` if type === 'LIKES')
  const flushLikesBatch = useCallback(() => {
    const delta = pendingDeltaRef.current;
    if (delta <= 0 || !streamId) return;
    pendingDeltaRef.current = 0;
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const patch: Record<string, any> = {
      likesCount: increment(delta),
      updatedAt: serverTimestamp(),
    };
    if (activeGoalTypeRef.current === 'LIKES') {
      patch['streamGoal.currentAmount'] = increment(delta);
    }
    updateDoc(doc(db, 'streams', streamId), patch).catch(() => {
      setDoc(
        doc(db, 'streams', streamId),
        { likesCount: increment(delta), updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    });
  }, [streamId]);

  // Flush remaining buffered taps on unmount
  useEffect(() => {
    return () => {
      flushLikesBatch();
    };
  }, [flushLikesBatch]);

  const handleTapHeart = (customEmoji?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const emoji =
      customEmoji || REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
    const particle: FloatingHeartParticle = {
      id,
      emoji,
      driftX: (Math.random() - 0.5) * 68,
      rotate: (Math.random() - 0.5) * 36,
      scale: 0.85 + Math.random() * 0.55,
    };

    // Cap active DOM particles for smooth 60fps mobile performance
    setParticles((prev) => [...prev.slice(-24), particle]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1850);

    // Optimistic UI increment + 2.5s throttled batch write to Firestore
    setLikesCount((c) => c + 1);
    pendingDeltaRef.current += 1;
    if (!flushTimerRef.current) {
      flushTimerRef.current = window.setTimeout(flushLikesBatch, 2500);
    }
  };

  const formattedLikes =
    likesCount >= 1_000_000
      ? `${(likesCount / 1_000_000).toFixed(1)}M`
      : likesCount >= 1_000
      ? `${(likesCount / 1_000).toFixed(1)}K`
      : likesCount.toString();

  return (
    <>
      {/* Right-Edge Rising Floating Hearts & Reactions Layer */}
      <div className="pointer-events-none fixed bottom-24 right-4 sm:right-6 z-30 w-24 h-72 overflow-visible">
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.4, rotate: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: -240 - Math.random() * 60,
                x: [0, p.driftX * 0.5, p.driftX],
                scale: [0.5, p.scale * 1.15, p.scale * 0.9],
                rotate: p.rotate,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.75, ease: 'easeOut' }}
              className="absolute bottom-2 right-3 text-3xl select-none drop-shadow-[0_4px_12px_rgba(244,63,94,0.55)]"
            >
              {p.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom-Right Floating Heart / Reaction Tap Stack */}
      <div className="fixed bottom-4 right-3 sm:right-5 z-30 flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="hidden sm:flex items-center gap-1 bg-zinc-950/75 backdrop-blur-md border border-white/15 rounded-full px-2 py-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleTapHeart('🔥')}
            title="Send Fire"
            className="hover:scale-125 active:scale-90 transition-transform text-sm px-1"
          >
            <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          </button>
          <button
            type="button"
            onClick={() => handleTapHeart('✨')}
            title="Send Sparkle"
            className="hover:scale-125 active:scale-90 transition-transform text-sm px-1"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          </button>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.84 }}
          whileHover={{ scale: 1.07 }}
          onClick={() => handleTapHeart('❤️')}
          aria-label="Send floating heart reaction"
          className="relative h-12 w-12 rounded-full bg-gradient-to-tr from-rose-600 via-pink-500 to-rose-400 text-white shadow-[0_0_25px_rgba(244,63,94,0.55)] border-2 border-white/25 flex items-center justify-center"
        >
          <Heart className="h-6 w-6 fill-white text-white" />
          {likesCount > 0 && (
            <span className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-zinc-950/90 border border-rose-400/50 text-[10px] font-black text-rose-300 shadow">
              {formattedLikes}
            </span>
          )}
        </motion.button>
      </div>
    </>
  );
}
