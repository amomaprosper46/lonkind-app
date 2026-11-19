'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  addDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { ensurePushTokenForUser } from '@/lib/fcm';
import { compressImage } from '@/lib/image-compression';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Play,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { StreamCategoryId } from './pre-live-studio';

export interface ScheduledStreamDoc {
  id: string;
  hostId: string;
  hostName: string;
  hostHandle?: string;
  hostAvatar?: string;
  title: string;
  category: StreamCategoryId | string;
  coverUrl?: string | null;
  scheduledFor: any; // Firestore Timestamp | string | number
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';
  subscribersCount: number;
  streamId?: string;
  createdAt?: any;
}

export const SCHEDULE_CATEGORY_META: Record<string, { label: string; emoji: string; accent: string }> = {
  chat: { label: 'Just Chatting', emoji: '💬', accent: 'from-indigo-500 to-blue-500' },
  music: { label: 'Music', emoji: '🎵', accent: 'from-fuchsia-500 to-pink-500' },
  gaming: { label: 'Gaming', emoji: '🎮', accent: 'from-emerald-500 to-teal-500' },
  creative: { label: 'Q&A', emoji: '💡', accent: 'from-amber-500 to-orange-500' },
  lifestyle: { label: 'IRL', emoji: '🌍', accent: 'from-cyan-500 to-sky-500' },
};

export function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

export function formatCountdown(targetMs: number, nowMs: number): { label: string; isSoon: boolean; isReadyNow: boolean } {
  const diff = targetMs - nowMs;
  if (diff <= 0) {
    return { label: 'Starting now!', isSoon: true, isReadyNow: true };
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return { label: `Starts in ${days}d ${hours}h`, isSoon: false, isReadyNow: false };
  }
  if (hours > 0) {
    return { label: `Starts in ${hours}h ${minutes}m`, isSoon: hours < 1, isReadyNow: false };
  }
  if (minutes >= 10) {
    return { label: `Starts in ${minutes}m`, isSoon: true, isReadyNow: minutes <= 15 };
  }
  if (minutes > 0) {
    return { label: `Starts in ${minutes}m ${seconds}s`, isSoon: true, isReadyNow: true };
  }
  return { label: `Starts in ${seconds}s`, isSoon: true, isReadyNow: true };
}

export function formatScheduledDateShort(targetMs: number): string {
  if (!targetMs) return '';
  try {
    const d = new Date(targetMs);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

interface ScheduleStreamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostUid: string;
  hostName: string;
  hostHandle?: string;
  hostAvatar?: string;
  onScheduled?: (schedule: ScheduledStreamDoc) => void;
}

export function ScheduleStreamModal({
  open,
  onOpenChange,
  hostUid,
  hostName,
  hostHandle,
  hostAvatar,
  onScheduled,
}: ScheduleStreamModalProps) {
  const defaultDate = useMemo(() => new Date(Date.now() + 60 * 60 * 1000), [open]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<StreamCategoryId>('chat');
  const [scheduledForStr, setScheduledForStr] = useState(() => toLocalDateTimeInputValue(defaultDate));
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setScheduledForStr(toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    }
  }, [open]);

  const applyPreset = (offsetHours: number, fixedHour?: number) => {
    const d = new Date();
    if (fixedHour !== undefined) {
      d.setHours(fixedHour, 0, 0, 0);
      if (d.getTime() <= Date.now() + 10 * 60 * 1000) {
        d.setDate(d.getDate() + 1);
      }
    } else {
      d.setTime(Date.now() + offsetHours * 60 * 60 * 1000);
      d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    }
    setScheduledForStr(toLocalDateTimeInputValue(d));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1280, 0.82);
      setCoverBlob(compressed);
      setCoverPreview(URL.createObjectURL(compressed));
    } catch {
      setCoverBlob(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostUid) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast({ variant: 'destructive', title: 'Add a Stream Title', description: 'Give your audience a reason to tap Remind Me.' });
      return;
    }

    const scheduledDate = new Date(scheduledForStr);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() - 60_000) {
      toast({
        variant: 'destructive',
        title: 'Pick a future date & time',
        description: 'Choose a scheduled start time in the future.',
      });
      return;
    }

    setIsSaving(true);
    try {
      let uploadedCoverUrl: string | null = null;
      if (coverBlob) {
        const storageRef = ref(storage, `stream_thumbnails/${hostUid}/scheduled_${Date.now()}.jpg`);
        await uploadBytes(storageRef, coverBlob);
        uploadedCoverUrl = await getDownloadURL(storageRef);
      }

      const payload = {
        hostId: hostUid,
        hostName: hostName || 'Lonkind Creator',
        hostHandle: hostHandle || hostName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator',
        hostAvatar: hostAvatar || '',
        title: cleanTitle,
        category,
        coverUrl: uploadedCoverUrl,
        scheduledFor: Timestamp.fromDate(scheduledDate),
        status: 'UPCOMING' as const,
        subscribersCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'scheduled_streams'), payload);

      toast({
        title: '📅 Stream Scheduled!',
        description: `"${cleanTitle}" is now live on Upcoming Lives — followers can tap Remind Me!`,
      });

      setTitle('');
      setCoverPreview(null);
      setCoverBlob(null);
      onOpenChange(false);

      if (onScheduled) {
        onScheduled({
          id: docRef.id,
          ...payload,
        });
      }
    } catch (err: any) {
      console.error('Schedule stream failed:', err);
      toast({
        variant: 'destructive',
        title: 'Could not schedule stream',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-950/95 backdrop-blur-2xl border border-white/15 text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
              <CalendarClock className="h-4 w-4 text-white" />
            </span>
            Schedule an Upcoming Live
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Announce your broadcast early so followers can tap <strong className="text-white">Remind Me</strong> and get instant push + in-app alerts when you go live.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Stream Title
            </label>
            <Input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Late-Night Live Q&A + Acoustic Jam 🎸"
              className="h-11 rounded-xl bg-zinc-900/90 border-white/15 text-sm font-semibold text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SCHEDULE_CATEGORY_META).map(([id, meta]) => {
                const selected = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id as StreamCategoryId)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selected
                        ? `bg-gradient-to-r ${meta.accent} text-white border-transparent shadow-md`
                        : 'bg-zinc-900/80 border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Scheduled Date &amp; Time
            </label>
            <Input
              type="datetime-local"
              value={scheduledForStr}
              min={toLocalDateTimeInputValue(new Date())}
              onChange={(e) => setScheduledForStr(e.target.value)}
              className="h-11 rounded-xl bg-zinc-900/90 border-white/15 text-sm font-semibold text-white [color-scheme:dark]"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset(1)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-300"
              >
                +1 Hour
              </button>
              <button
                type="button"
                onClick={() => applyPreset(3)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-300"
              >
                +3 Hours
              </button>
              <button
                type="button"
                onClick={() => applyPreset(0, 20)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-300"
              >
                Tonight 8:00 PM
              </button>
              <button
                type="button"
                onClick={() => applyPreset(24)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-300"
              >
                Tomorrow
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Cover Image (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {coverPreview ? (
              <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-white/15">
                <img src={coverPreview} alt="Stream cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setCoverPreview(null);
                    setCoverBlob(null);
                  }}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 rounded-2xl border border-dashed border-white/20 bg-zinc-900/60 hover:bg-zinc-900 hover:border-indigo-400/50 transition-all flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300"
              >
                <Upload className="h-4 w-4 text-indigo-400" />
                <span>Upload Cover Artwork</span>
              </button>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:opacity-95 text-white shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Schedule Stream
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface UpcomingLivesBannerProps {
  currentUser?: {
    uid: string;
    name?: string;
    handle?: string;
    avatarUrl?: string;
  } | null;
  /** When set, shows only this creator's scheduled streams (for Creator Profile pages). */
  hostFilterUid?: string;
  /** If true and hostFilterUid matches currentUser, displays a compact CTA card to schedule a new stream even when empty. */
  showEmptyForCreator?: boolean;
  /** Called when the creator clicks "Start Scheduled Live" on their own upcoming card. */
  onStartScheduledLive?: (event: ScheduledStreamDoc) => void;
  /** Called when a viewer clicks "Join Live" on a card that has transitioned to LIVE. */
  onWatchLive?: (hostUid: string) => void;
  /** Optional custom callback to open the Schedule modal or Pre-Live Studio. */
  onScheduleNew?: () => void;
  className?: string;
}

export default function UpcomingLivesBanner({
  currentUser,
  hostFilterUid,
  showEmptyForCreator = false,
  onStartScheduledLive,
  onWatchLive,
  onScheduleNew,
  className = '',
}: UpcomingLivesBannerProps) {
  const [events, setEvents] = useState<ScheduledStreamDoc[]>([]);
  const [subscribedMap, setSubscribedMap] = useState<Record<string, boolean>>({});
  const [optimisticCountDelta, setOptimisticCountDelta] = useState<Record<string, number>>({});
  const [busyReminderIds, setBusyReminderIds] = useState<Record<string, boolean>>({});
  const [busyCancelIds, setBusyCancelIds] = useState<Record<string, boolean>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const isViewingOwnProfile = Boolean(hostFilterUid && currentUser?.uid && hostFilterUid === currentUser.uid);

  // Live countdown ticker (1s precision when any stream is < 10m away, otherwise 15s)
  useEffect(() => {
    const hasImminent = events.some((ev) => {
      const diff = toMillis(ev.scheduledFor) - Date.now();
      return ev.status === 'UPCOMING' && diff > -60_000 && diff < 10 * 60 * 1000;
    });
    const intervalMs = hasImminent ? 1000 : 15000;
    const timer = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [events]);

  // Real-time listener on `scheduled_streams`
  useEffect(() => {
    const colRef = collection(db, 'scheduled_streams');
    const q = hostFilterUid
      ? query(colRef, where('hostId', '==', hostFilterUid))
      : query(colRef, where('status', 'in', ['UPCOMING', 'LIVE']));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const list: ScheduledStreamDoc[] = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduledStreamDoc, 'id'>) }))
          .filter((ev) => {
            if (ev.status !== 'UPCOMING' && ev.status !== 'LIVE') return false;
            const targetMs = toMillis(ev.scheduledFor);
            // Keep UPCOMING streams up to 2 hours past scheduled time (in case creator starts slightly late)
            if (ev.status === 'UPCOMING' && targetMs > 0 && now - targetMs > 2 * 60 * 60 * 1000) {
              return false;
            }
            // Keep LIVE streams up to 12 hours
            if (ev.status === 'LIVE' && targetMs > 0 && now - targetMs > 12 * 60 * 60 * 1000) {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            // LIVE streams first, then soonest UPCOMING
            if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
            if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
            return toMillis(a.scheduledFor) - toMillis(b.scheduledFor);
          });

        setEvents(list);
      },
      (err) => {
        console.warn('[UpcomingLivesBanner] Snapshot notice:', err);
      }
    );

    return () => unsub();
  }, [hostFilterUid]);

  // Real-time listeners for current user's reminder state per visible scheduled stream
  const eventIdsKey = useMemo(() => events.map((e) => e.id).join(','), [events]);

  useEffect(() => {
    if (!currentUser?.uid || events.length === 0) return;

    const unsubs = events.map((ev) => {
      const remRef = doc(db, 'scheduled_streams', ev.id, 'reminders', currentUser.uid);
      return onSnapshot(
        remRef,
        (snap) => {
          setSubscribedMap((prev) => ({ ...prev, [ev.id]: snap.exists() }));
          setOptimisticCountDelta((prev) => {
            if (!(ev.id in prev)) return prev;
            const next = { ...prev };
            delete next[ev.id];
            return next;
          });
        },
        () => {}
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUser?.uid, eventIdsKey]);

  const handleToggleReminder = async (event: ScheduledStreamDoc) => {
    if (!currentUser?.uid) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to set a reminder for upcoming Lonkind Lives.',
      });
      return;
    }

    if (busyReminderIds[event.id]) return;

    const currentlySubscribed = Boolean(subscribedMap[event.id]);
    const nextSubscribed = !currentlySubscribed;

    // 1. Optimistic UI update immediately
    setSubscribedMap((prev) => ({ ...prev, [event.id]: nextSubscribed }));
    setOptimisticCountDelta((prev) => ({
      ...prev,
      [event.id]: (prev[event.id] || 0) + (nextSubscribed ? 1 : -1),
    }));
    setBusyReminderIds((prev) => ({ ...prev, [event.id]: true }));

    try {
      let fcmToken: string | null = null;
      let pushPermission: NotificationPermission | 'unsupported' = 'unsupported';

      if (nextSubscribed) {
        // Trigger clean browser permission prompt if push notifications aren't enabled yet
        const pushRes = await ensurePushTokenForUser(currentUser.uid);
        fcmToken = pushRes.token;
        pushPermission = pushRes.permission;
      }

      const scheduleRef = doc(db, 'scheduled_streams', event.id);
      const reminderRef = doc(db, 'scheduled_streams', event.id, 'reminders', currentUser.uid);

      await runTransaction(db, async (tx) => {
        const [schedSnap, remSnap] = await Promise.all([tx.get(scheduleRef), tx.get(reminderRef)]);
        if (!schedSnap.exists()) {
          throw new Error('This scheduled stream is no longer available.');
        }

        const currentCount = Math.max(0, Number(schedSnap.data()?.subscribersCount || 0));

        if (nextSubscribed) {
          tx.set(reminderRef, {
            userId: currentUser.uid,
            username: currentUser.handle || currentUser.name || 'viewer',
            displayName: currentUser.name || 'Viewer',
            avatarUrl: currentUser.avatarUrl || '',
            fcmToken: fcmToken || null,
            createdAt: serverTimestamp(),
          });
          if (!remSnap.exists()) {
            tx.update(scheduleRef, {
              subscribersCount: increment(1),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          if (remSnap.exists()) {
            tx.delete(reminderRef);
            tx.update(scheduleRef, {
              subscribersCount: currentCount > 0 ? increment(-1) : 0,
              updatedAt: serverTimestamp(),
            });
          }
        }
      });

      if (nextSubscribed) {
        toast({
          title: '🔔 Reminder Set!',
          description:
            pushPermission === 'granted'
              ? `You'll get a push & in-app alert the moment ${event.hostName} goes live.`
              : `In-app reminder saved! Enable browser notifications anytime for instant lock-screen alerts.`,
        });
      } else {
        toast({
          title: 'Reminder removed',
          description: `You won't be notified for "${event.title}".`,
        });
      }
    } catch (err: any) {
      // Revert optimistic UI on failure
      setSubscribedMap((prev) => ({ ...prev, [event.id]: currentlySubscribed }));
      setOptimisticCountDelta((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
      console.error('Toggle reminder failed:', err);
      toast({
        variant: 'destructive',
        title: 'Could not update reminder',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setBusyReminderIds((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  const handleCancelScheduled = async (event: ScheduledStreamDoc) => {
    if (!currentUser?.uid || event.hostId !== currentUser.uid) return;
    setBusyCancelIds((prev) => ({ ...prev, [event.id]: true }));
    try {
      await deleteDoc(doc(db, 'scheduled_streams', event.id));
      toast({
        title: 'Scheduled live cancelled',
        description: `"${event.title}" has been removed from Upcoming Lives.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Could not cancel event',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setBusyCancelIds((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  const openScheduler = () => {
    if (onScheduleNew) {
      onScheduleNew();
    } else {
      setIsScheduleModalOpen(true);
    }
  };

  if (events.length === 0) {
    if (!showEmptyForCreator || !isViewingOwnProfile) return null;

    return (
      <>
        <div
          className={`rounded-2xl bg-gradient-to-r from-slate-950/90 via-indigo-950/50 to-slate-950/90 backdrop-blur-xl border border-indigo-500/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <CalendarClock className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Plan Your Next Live Stream</h3>
              <p className="text-xs text-slate-400">
                Schedule an upcoming broadcast so your followers can tap <span className="text-indigo-300 font-semibold">Remind Me</span>.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={openScheduler}
            className="rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:opacity-95 text-white shadow-md shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Schedule a Live
          </Button>
        </div>

        {currentUser && (
          <ScheduleStreamModal
            open={isScheduleModalOpen}
            onOpenChange={setIsScheduleModalOpen}
            hostUid={currentUser.uid}
            hostName={currentUser.name || 'Creator'}
            hostHandle={currentUser.handle}
            hostAvatar={currentUser.avatarUrl}
          />
        )}
      </>
    );
  }

  return (
    <>
      <section
        className={`rounded-2xl bg-gradient-to-br from-slate-950/95 via-indigo-950/40 to-slate-950/95 backdrop-blur-xl border border-white/10 p-4 shadow-xl ${className}`}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-tight truncate">
                  {hostFilterUid ? 'Upcoming Lives' : 'Upcoming Lives on Lonkind'}
                </h3>
                <Badge className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold px-2 py-0">
                  {events.length}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Tap Remind Me to get instant push alerts the second a creator goes live
              </p>
            </div>
          </div>

          {currentUser && (
            <Button
              size="sm"
              variant="outline"
              onClick={openScheduler}
              className="h-8 px-3 rounded-xl text-[11px] font-bold bg-white/5 hover:bg-indigo-600/30 border-white/15 hover:border-indigo-400/50 text-white shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Schedule Live</span>
              <span className="sm:hidden">Schedule</span>
            </Button>
          )}
        </div>

        {/* Horizontal Scrollable Cards Row */}
        <div className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
          {events.map((event) => {
            const targetMs = toMillis(event.scheduledFor);
            const countdown = formatCountdown(targetMs, nowMs);
            const isLiveNow = event.status === 'LIVE';
            const isHost = Boolean(currentUser?.uid && event.hostId === currentUser.uid);
            const isSubscribed = Boolean(subscribedMap[event.id]);
            const displayCount = Math.max(
              0,
              Number(event.subscribersCount || 0) + (optimisticCountDelta[event.id] || 0)
            );
            const categoryMeta = SCHEDULE_CATEGORY_META[event.category] || {
              label: event.category || 'Live',
              emoji: '✨',
              accent: 'from-indigo-500 to-purple-500',
            };

            return (
              <article
                key={event.id}
                className="snap-start shrink-0 w-[278px] sm:w-[300px] rounded-2xl overflow-hidden bg-zinc-950/90 border border-white/12 hover:border-indigo-400/45 transition-all duration-300 shadow-lg hover:shadow-indigo-500/15 flex flex-col group"
              >
                {/* Cover Artwork / Dark Glassmorphic Header */}
                <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-950/80 to-slate-950">
                  {event.coverUrl ? (
                    <img
                      src={event.coverUrl}
                      alt={event.title}
                      className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(129,140,248,0.35),_transparent_65%),radial-gradient(ellipse_at_bottom_left,_rgba(236,72,153,0.25),_transparent_60%)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-black/25" />

                  {/* Top Left Countdown / LIVE Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    {isLiveNow ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        LIVE NOW
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md border text-[10px] font-extrabold shadow-md ${
                          countdown.isSoon
                            ? 'bg-amber-500/25 border-amber-400/50 text-amber-200'
                            : 'bg-black/60 border-white/20 text-indigo-200'
                        }`}
                      >
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{countdown.label}</span>
                      </span>
                    )}
                  </div>

                  {/* Top Right Category Pill (+ Host Cancel Button) */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-zinc-200">
                      {categoryMeta.emoji} {categoryMeta.label}
                    </span>
                    {isHost && !isLiveNow && (
                      <button
                        type="button"
                        disabled={busyCancelIds[event.id]}
                        onClick={() => handleCancelScheduled(event)}
                        title="Cancel scheduled live"
                        className="h-6 w-6 rounded-full bg-black/65 hover:bg-rose-600/90 border border-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
                      >
                        {busyCancelIds[event.id] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Bottom Left Host Info */}
                  <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2">
                    <Link
                      href={event.hostHandle ? `/profile/${event.hostHandle}` : '#'}
                      className="flex items-center gap-2 min-w-0 group/host"
                    >
                      <Avatar className="h-7 w-7 border border-white/30 shadow-md shrink-0">
                        <AvatarImage src={event.hostAvatar} alt={event.hostName} />
                        <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-bold">
                          {event.hostName?.charAt(0) || 'L'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white group-hover/host:text-indigo-300 truncate leading-tight">
                          {event.hostName}
                        </p>
                        {event.hostHandle && (
                          <p className="text-[10px] text-zinc-300/80 truncate leading-tight">
                            @{event.hostHandle}
                          </p>
                        )}
                      </div>
                    </Link>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-200 shrink-0">
                      <Users className="h-2.5 w-2.5 text-indigo-300" />
                      {displayCount}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[13px] font-extrabold text-white line-clamp-2 leading-snug">
                      {event.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
                      <span className="truncate">{formatScheduledDateShort(targetMs)}</span>
                    </p>
                  </div>

                  {/* Action Footer */}
                  <div>
                    {isLiveNow ? (
                      <Button
                        size="sm"
                        onClick={() => onWatchLive?.(event.hostId)}
                        className="w-full h-9 rounded-xl font-black text-xs bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-500/20"
                      >
                        <Radio className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                        Join Live Now
                      </Button>
                    ) : isHost ? (
                      <Button
                        size="sm"
                        onClick={() => onStartScheduledLive?.(event)}
                        className="w-full h-9 rounded-xl font-black text-xs text-white shadow-lg shadow-rose-500/20"
                        style={{
                          background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #6366f1 100%)',
                        }}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                        Start Scheduled Live
                        {displayCount > 0 ? ` (${displayCount})` : ''}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        disabled={busyReminderIds[event.id]}
                        onClick={() => handleToggleReminder(event)}
                        className={`w-full h-9 rounded-xl font-bold text-xs transition-all border ${
                          isSubscribed
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/50 text-emerald-300 shadow-sm'
                            : 'bg-indigo-600/25 hover:bg-indigo-600/40 border-indigo-400/40 text-white shadow-sm'
                        }`}
                      >
                        {busyReminderIds[event.id] ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : isSubscribed ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                        ) : (
                          <BellRing className="h-3.5 w-3.5 mr-1.5 text-indigo-300" />
                        )}
                        <span>{isSubscribed ? 'Reminder Set ✓' : 'Remind Me'}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {currentUser && (
        <ScheduleStreamModal
          open={isScheduleModalOpen}
          onOpenChange={setIsScheduleModalOpen}
          hostUid={currentUser.uid}
          hostName={currentUser.name || 'Creator'}
          hostHandle={currentUser.handle}
          hostAvatar={currentUser.avatarUrl}
        />
      )}
    </>
  );
}
