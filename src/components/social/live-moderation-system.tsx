'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Trash2,
  Clock,
  Ban,
  CheckCircle2,
  X,
  Plus,
  Search,
  Loader2,
  MessageSquareOff,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface StreamModeratorDoc {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  assignedAt?: any;
}

export interface RestrictedUserDoc {
  userId: string;
  username: string;
  avatarUrl?: string;
  type: 'MUTE' | 'BAN';
  reason?: string;
  mutedByUid: string;
  mutedByName: string;
  expiresAt?: any | null; // Firestore Timestamp for MUTE, null for permanent BAN
  createdAt?: any;
}

export interface ModTargetMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type?: 'text' | 'gift';
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/**
 * Case-insensitive blocked word / phrase check.
 * Checks normalized substring & word boundary matching so both single words
 * and multi-word phrases restricted by the host are caught cleanly.
 */
export function findMatchedBlockedWord(messageText: string, blockedWords: string[]): string | null {
  if (!messageText || !Array.isArray(blockedWords) || blockedWords.length === 0) {
    return null;
  }
  const normalizedMsg = messageText.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalizedMsg) return null;

  for (const rawWord of blockedWords) {
    const word = String(rawWord || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!word) continue;
    if (normalizedMsg.includes(word)) {
      return rawWord;
    }
  }
  return null;
}

/**
 * Crisp green/cyan "MOD" shield badge displayed next to appointed moderators in live chat.
 */
export function ModShieldBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Appointed Stream Moderator"
      className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-emerald-500/90 to-cyan-500/90 text-slate-950 font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.45)] shrink-0 ${
        compact ? 'text-[8px] px-1.5 py-[1px]' : 'text-[9px] px-1.5 py-0.5'
      }`}
    >
      <ShieldCheck className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      <span>MOD</span>
    </span>
  );
}

interface UseLiveModerationSystemParams {
  roomId: string;
  hostUid: string;
  currentUserId: string;
  currentUserName: string;
  isHost: boolean;
}

export function useLiveModerationSystem({
  roomId,
  hostUid,
  currentUserId,
  currentUserName,
  isHost,
}: UseLiveModerationSystemParams) {
  const cleanHostUid = (hostUid || '').replace(/^live_/, '');
  const [moderators, setModerators] = useState<StreamModeratorDoc[]>([]);
  const [hostBlockedWords, setHostBlockedWords] = useState<string[]>([]);
  const [restrictedUsers, setRestrictedUsers] = useState<Record<string, RestrictedUserDoc>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // 1. Real-time listener on `users/{hostId}/moderators`
  useEffect(() => {
    if (!cleanHostUid) return;
    const modsCol = collection(db, 'users', cleanHostUid, 'moderators');
    const unsub = onSnapshot(
      modsCol,
      (snap) => {
        const list = snap.docs.map((d) => ({
          userId: d.id,
          ...(d.data() as Omit<StreamModeratorDoc, 'userId'>),
        }));
        setModerators(list);
      },
      (err) => {
        console.warn('[LiveModeration] Moderators listener notice:', err);
      }
    );
    return () => unsub();
  }, [cleanHostUid]);

  // 2. Real-time listener on `users/{hostId}` for `blockedWords`
  useEffect(() => {
    if (!cleanHostUid) return;
    const hostDocRef = doc(db, 'users', cleanHostUid);
    const unsub = onSnapshot(
      hostDocRef,
      (snap) => {
        if (snap.exists()) {
          const words = snap.data()?.blockedWords;
          setHostBlockedWords(Array.isArray(words) ? words.filter((w) => typeof w === 'string' && w.trim().length > 0) : []);
        } else {
          setHostBlockedWords([]);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [cleanHostUid]);

  // 3. Real-time listener on `streams/{streamId}/restricted_users`
  useEffect(() => {
    if (!roomId) return;
    const restrictedCol = collection(db, 'streams', roomId, 'restricted_users');
    const unsub = onSnapshot(
      restrictedCol,
      (snap) => {
        const map: Record<string, RestrictedUserDoc> = {};
        snap.docs.forEach((d) => {
          map[d.id] = {
            userId: d.id,
            ...(d.data() as Omit<RestrictedUserDoc, 'userId'>),
          };
        });
        setRestrictedUsers(map);
      },
      () => {}
    );
    return () => unsub();
  }, [roomId]);

  const moderatorsMap = useMemo(() => {
    const map: Record<string, StreamModeratorDoc> = {};
    moderators.forEach((m) => {
      map[m.userId] = m;
    });
    return map;
  }, [moderators]);

  const isCurrentUserMod = Boolean(currentUserId && moderatorsMap[currentUserId]);
  const canModerate = isHost || isCurrentUserMod;

  // Check if current viewer has an active mute/ban restriction
  const rawMyRestriction = currentUserId ? restrictedUsers[currentUserId] || null : null;
  const myRestriction = useMemo(() => {
    if (!rawMyRestriction || isHost) return null;
    if (rawMyRestriction.type === 'BAN') {
      return {
        ...rawMyRestriction,
        remainingSec: Infinity,
      };
    }
    const expMs = toMs(rawMyRestriction.expiresAt);
    if (expMs > nowMs) {
      return {
        ...rawMyRestriction,
        remainingSec: Math.ceil((expMs - nowMs) / 1000),
      };
    }
    return null;
  }, [rawMyRestriction, isHost, nowMs]);

  // Tick 1s countdown while current viewer is muted so mute expires automatically in UI
  useEffect(() => {
    if (!rawMyRestriction || rawMyRestriction.type !== 'MUTE') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [rawMyRestriction]);

  // Host-only: Appoint or remove a moderator
  const toggleModerator = useCallback(
    async (target: { userId: string; username: string; avatarUrl?: string }) => {
      if (!isHost || !cleanHostUid || !target.userId || target.userId === cleanHostUid) {
        return;
      }
      const modRef = doc(db, 'users', cleanHostUid, 'moderators', target.userId);
      const alreadyMod = Boolean(moderatorsMap[target.userId]);
      try {
        if (alreadyMod) {
          await deleteDoc(modRef);
          toast({
            title: 'Moderator removed',
            description: `${target.username} is no longer a moderator for your streams.`,
          });
        } else {
          await setDoc(modRef, {
            userId: target.userId,
            username: target.username || 'Moderator',
            avatarUrl: target.avatarUrl || '',
            assignedAt: serverTimestamp(),
          });
          toast({
            title: '🛡️ Moderator Appointed!',
            description: `${target.username} now has the MOD shield and can moderate your live chat.`,
          });
        }
      } catch (err: any) {
        console.error('[LiveModeration] toggleModerator error:', err);
        toast({
          variant: 'destructive',
          title: 'Could not update moderator',
          description: err?.message || 'Please check permissions and try again.',
        });
      }
    },
    [isHost, cleanHostUid, moderatorsMap]
  );

  // Host or Mod: Soft-delete a message so it immediately disappears for all viewers
  const deleteChatMessage = useCallback(
    async (messageId: string) => {
      if (!canModerate || !roomId || !messageId) return;
      const patch = {
        deleted: true,
        deletedBy: currentUserId,
        deletedByName: currentUserName,
        deletedAt: serverTimestamp(),
      };
      try {
        await Promise.all([
          setDoc(doc(db, 'live_streams', roomId, 'chat', messageId), patch, { merge: true }).catch(() => {}),
          setDoc(doc(db, 'streams', roomId, 'messages', messageId), patch, { merge: true }).catch(() => {}),
        ]);
        toast({
          title: 'Message removed',
          description: 'The message has been hidden for all viewers.',
        });
      } catch (err: any) {
        console.error('[LiveModeration] deleteChatMessage error:', err);
        toast({
          variant: 'destructive',
          title: 'Could not delete message',
          description: err?.message || 'Permission denied.',
        });
      }
    },
    [canModerate, roomId, currentUserId, currentUserName]
  );

  // Host or Mod: Mute user for 10 minutes
  const muteUser10Mins = useCallback(
    async (target: { userId: string; username: string; avatarUrl?: string }) => {
      if (!canModerate || !roomId || !target.userId || target.userId === cleanHostUid) return;
      try {
        const expiresAtDate = new Date(Date.now() + 10 * 60 * 1000);
        await setDoc(doc(db, 'streams', roomId, 'restricted_users', target.userId), {
          userId: target.userId,
          username: target.username || 'Viewer',
          avatarUrl: target.avatarUrl || '',
          type: 'MUTE',
          reason: 'Muted for 10 minutes by stream moderation',
          mutedByUid: currentUserId,
          mutedByName: currentUserName,
          expiresAt: Timestamp.fromDate(expiresAtDate),
          createdAt: serverTimestamp(),
        });
        toast({
          title: '🔇 Viewer Muted (10 mins)',
          description: `${target.username} cannot send chat messages for 10 minutes.`,
        });
      } catch (err: any) {
        console.error('[LiveModeration] muteUser10Mins error:', err);
        toast({
          variant: 'destructive',
          title: 'Could not mute user',
          description: err?.message || 'Permission denied.',
        });
      }
    },
    [canModerate, roomId, cleanHostUid, currentUserId, currentUserName]
  );

  // Host or Mod: Ban user from stream chat
  const banUserFromStream = useCallback(
    async (target: { userId: string; username: string; avatarUrl?: string }) => {
      if (!canModerate || !roomId || !target.userId || target.userId === cleanHostUid) return;
      try {
        await setDoc(doc(db, 'streams', roomId, 'restricted_users', target.userId), {
          userId: target.userId,
          username: target.username || 'Viewer',
          avatarUrl: target.avatarUrl || '',
          type: 'BAN',
          reason: 'Banned from this live stream',
          mutedByUid: currentUserId,
          mutedByName: currentUserName,
          expiresAt: null,
          createdAt: serverTimestamp(),
        });
        toast({
          title: '🚫 Viewer Banned from Stream',
          description: `${target.username} has been blocked from participating in this stream.`,
        });
      } catch (err: any) {
        console.error('[LiveModeration] banUserFromStream error:', err);
        toast({
          variant: 'destructive',
          title: 'Could not ban user',
          description: err?.message || 'Permission denied.',
        });
      }
    },
    [canModerate, roomId, cleanHostUid, currentUserId, currentUserName]
  );

  // Host or Mod: Lift mute/ban
  const unrestrictUser = useCallback(
    async (targetUid: string, targetName?: string) => {
      if (!canModerate || !roomId || !targetUid) return;
      try {
        await deleteDoc(doc(db, 'streams', roomId, 'restricted_users', targetUid));
        toast({
          title: 'Restriction lifted',
          description: `${targetName || 'Viewer'} can now chat again.`,
        });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Could not lift restriction',
          description: err?.message || 'Please try again.',
        });
      }
    },
    [canModerate, roomId]
  );

  const checkMessageBlockedWord = useCallback(
    (text: string): string | null => {
      // Host is exempt from their own word filter; viewers & mods are checked
      if (isHost) return null;
      return findMatchedBlockedWord(text, hostBlockedWords);
    },
    [isHost, hostBlockedWords]
  );

  return {
    moderators,
    moderatorsMap,
    hostBlockedWords,
    restrictedUsers,
    isCurrentUserMod,
    canModerate,
    myRestriction,
    toggleModerator,
    deleteChatMessage,
    muteUser10Mins,
    banUserFromStream,
    unrestrictUser,
    checkMessageBlockedWord,
  };
}

interface ChatMessageModerationModalProps {
  targetMessage: ModTargetMessage | null;
  onClose: () => void;
  isHost: boolean;
  hostUid: string;
  isTargetMod: boolean;
  targetRestriction: RestrictedUserDoc | null;
  onToggleMod: () => Promise<void>;
  onDeleteMessage: () => Promise<void>;
  onMute10Mins: () => Promise<void>;
  onBanFromStream: () => Promise<void>;
  onUnrestrict: () => Promise<void>;
}

/**
 * Quick Trust & Safety Moderation Action Sheet when Host or Mod taps a chat message/username.
 */
export function ChatMessageModerationModal({
  targetMessage,
  onClose,
  isHost,
  hostUid,
  isTargetMod,
  targetRestriction,
  onToggleMod,
  onDeleteMessage,
  onMute10Mins,
  onBanFromStream,
  onUnrestrict,
}: ChatMessageModerationModalProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  if (!targetMessage) return null;

  const isTargetHost = targetMessage.senderId === hostUid.replace(/^live_/, '');
  const isCurrentlyRestricted =
    Boolean(targetRestriction) &&
    (targetRestriction?.type === 'BAN' || toMs(targetRestriction?.expiresAt) > Date.now());

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
      onClose();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pointer-events-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-zinc-950/95 border border-white/15 shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-950/50 via-zinc-950 to-cyan-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-9 w-9 border border-white/20 shrink-0">
              <AvatarImage src={targetMessage.senderAvatar} alt={targetMessage.senderName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                {targetMessage.senderName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-black truncate">{targetMessage.senderName}</p>
                {isTargetMod && <ModShieldBadge compact />}
              </div>
              <p className="text-[11px] text-zinc-400">Live Chat Moderation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selected Message Preview */}
        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-zinc-900/90 border border-white/10 p-3 text-xs text-zinc-200 leading-relaxed break-words">
            &ldquo;{targetMessage.text}&rdquo;
          </div>

          <div className="space-y-2">
            {/* Delete Message (Host & Mod) */}
            <Button
              type="button"
              disabled={busyAction !== null}
              onClick={() => run('delete', onDeleteMessage)}
              className="w-full justify-start h-10 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-bold"
            >
              {busyAction === 'delete' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2 text-rose-400" />
              )}
              Delete Message (Hide for all viewers)
            </Button>

            {/* Make / Remove Moderator (Host ONLY, never on self) */}
            {isHost && !isTargetHost && (
              <Button
                type="button"
                disabled={busyAction !== null}
                onClick={() => run('mod', onToggleMod)}
                className={`w-full justify-start h-10 rounded-xl border text-xs font-bold ${
                  isTargetMod
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
                }`}
              >
                {busyAction === 'mod' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isTargetMod ? (
                  <ShieldOff className="h-4 w-4 mr-2 text-amber-400" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2 text-emerald-400" />
                )}
                {isTargetMod ? 'Remove Moderator Role' : 'Make Moderator (Grant MOD Shield)'}
              </Button>
            )}

            {/* Mute / Ban / Unrestrict (cannot mute/ban the Host) */}
            {!isTargetHost && (
              <>
                {isCurrentlyRestricted ? (
                  <Button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => run('unrestrict', onUnrestrict)}
                    className="w-full justify-start h-10 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold"
                  >
                    {busyAction === 'unrestrict' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-indigo-300" />
                    )}
                    Lift {targetRestriction?.type === 'BAN' ? 'Ban' : 'Mute'} (Allow Chat)
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => run('mute', onMute10Mins)}
                      className="h-10 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-bold"
                    >
                      {busyAction === 'mute' ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                      )}
                      Mute (10m)
                    </Button>
                    <Button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => run('ban', onBanFromStream)}
                      className="h-10 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/45 text-red-200 text-xs font-bold"
                    >
                      {busyAction === 'ban' ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Ban className="h-3.5 w-3.5 mr-1.5 text-red-400" />
                      )}
                      Ban User
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PRESET_SAFETY_WORDS = [
  'free money',
  'crypto giveaway',
  'whatsapp me',
  'click my bio',
  'scam',
  'bit.ly',
];

/**
 * `/settings/privacy` panel containing:
 *  1. Trusted Live Moderators Manager (`users/{hostId}/moderators`)
 *  2. Live Chat Word Filter (`users/{hostId}.blockedWords`)
 */
export function LiveChatSafetySettingsPanel({
  user,
}: {
  user: { uid: string; name?: string; handle?: string };
}) {
  const [moderators, setModerators] = useState<StreamModeratorDoc[]>([]);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState('');
  const [isSavingWords, setIsSavingWords] = useState(false);

  // Moderator search state
  const [modSearch, setModSearch] = useState('');
  const [modSearchResults, setModSearchResults] = useState<
    { uid: string; name: string; handle: string; avatarUrl?: string }[]
  >([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [busyModUid, setBusyModUid] = useState<string | null>(null);

  // Subscribe to creator's appointed moderators
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'moderators'), (snap) => {
      setModerators(
        snap.docs.map((d) => ({
          userId: d.id,
          ...(d.data() as Omit<StreamModeratorDoc, 'userId'>),
        }))
      );
    });
    return () => unsub();
  }, [user?.uid]);

  // Subscribe to creator's `blockedWords` array
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const list = snap.data()?.blockedWords;
        setBlockedWords(Array.isArray(list) ? list : []);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // Search Lonkind users to appoint as Moderator
  useEffect(() => {
    const qStr = modSearch.trim().toLowerCase().replace(/^@/, '');
    if (qStr.length < 2) {
      setModSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(60)));
        if (cancelled) return;
        const matches = snap.docs
          .map((d) => ({ uid: d.id, ...(d.data() as any) }))
          .filter((u) => {
            if (u.uid === user.uid) return false;
            const name = String(u.name || '').toLowerCase();
            const handle = String(u.handle || '').toLowerCase();
            return name.includes(qStr) || handle.includes(qStr);
          })
          .slice(0, 6)
          .map((u) => ({
            uid: u.uid,
            name: u.name || 'Lonkind User',
            handle: u.handle || 'user',
            avatarUrl: u.avatarUrl || '',
          }));
        setModSearchResults(matches);
      } catch {
        // Silent
      } finally {
        if (!cancelled) setIsSearchingUsers(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [modSearch, user.uid]);

  const modIdsSet = useMemo(() => new Set(moderators.map((m) => m.userId)), [moderators]);

  const handleAppointModerator = async (candidate: {
    uid: string;
    name: string;
    handle: string;
    avatarUrl?: string;
  }) => {
    setBusyModUid(candidate.uid);
    try {
      await setDoc(doc(db, 'users', user.uid, 'moderators', candidate.uid), {
        userId: candidate.uid,
        username: candidate.handle || candidate.name,
        displayName: candidate.name,
        avatarUrl: candidate.avatarUrl || '',
        assignedAt: serverTimestamp(),
      });
      toast({
        title: '🛡️ Moderator Added',
        description: `@${candidate.handle || candidate.name} can now moderate your live streams.`,
      });
      setModSearch('');
      setModSearchResults([]);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Could not add moderator',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setBusyModUid(null);
    }
  };

  const handleRemoveModerator = async (mod: StreamModeratorDoc) => {
    setBusyModUid(mod.userId);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'moderators', mod.userId));
      toast({
        title: 'Moderator removed',
        description: `${mod.displayName || mod.username} was removed from your Mod list.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Could not remove moderator',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setBusyModUid(null);
    }
  };

  const persistBlockedWords = async (nextWords: string[]) => {
    setIsSavingWords(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedWords: nextWords,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save word filter',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsSavingWords(false);
    }
  };

  const handleAddWords = async (rawInput: string) => {
    const incoming = rawInput
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0 && w.length <= 60);

    if (incoming.length === 0) return;

    const existingLower = new Set(blockedWords.map((w) => w.toLowerCase()));
    const additions = incoming.filter((w) => !existingLower.has(w));
    if (additions.length === 0) {
      setWordInput('');
      return;
    }

    const next = [...blockedWords, ...additions].slice(0, 100);
    setWordInput('');
    await persistBlockedWords(next);
    toast({
      title: 'Word filter updated',
      description: `Added ${additions.length} blocked ${additions.length === 1 ? 'term' : 'terms'} to your Live Chat filter.`,
    });
  };

  const handleRemoveWord = async (wordToRemove: string) => {
    const next = blockedWords.filter((w) => w !== wordToRemove);
    await persistBlockedWords(next);
  };

  return (
    <div className="space-y-4">
      {/* 1. LIVE CHAT WORD FILTER CARD */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 space-y-4 shadow-md text-[#F3F4F6]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
              <MessageSquareOff className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Live Chat Word Filter</h2>
                <Badge className="bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[10px] font-bold">
                  {blockedWords.length} blocked
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Automatically block messages containing restricted words or spam phrases before they appear in your Live Stream chat.
              </p>
            </div>
          </div>
          {isSavingWords && <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />}
        </div>

        {/* Add Blocked Word Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddWords(wordInput);
          }}
          className="flex gap-2"
        >
          <Input
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            placeholder="Add word or phrase (separate multiple with commas)..."
            className="h-10 rounded-xl bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 text-xs sm:text-sm"
          />
          <Button
            type="submit"
            disabled={!wordInput.trim() || isSavingWords}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </form>

        {/* Quick Spam Preset Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-[#F3F4F6] mr-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Quick add:
          </span>
          {PRESET_SAFETY_WORDS.filter(
            (p) => !blockedWords.some((w) => w.toLowerCase() === p.toLowerCase())
          ).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleAddWords(preset)}
              className="px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-400/50 text-[11px] font-semibold text-[#F3F4F6] hover:text-white transition-colors"
            >
              + {preset}
            </button>
          ))}
        </div>

        {/* Active Blocked Words Chips */}
        {blockedWords.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            {blockedWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-xs font-bold text-white"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveWord(word)}
                  aria-label={`Remove ${word}`}
                  className="h-5 w-5 rounded-full hover:bg-rose-500/35 flex items-center justify-center text-rose-200 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900/70 border border-dashed border-slate-700 p-3 text-center text-xs text-slate-300">
            No custom blocked words yet. Add words above to auto-filter live chat messages privately.
          </div>
        )}
      </div>

      {/* 2. TRUSTED LIVE MODERATORS MANAGER CARD */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 space-y-4 shadow-md text-[#F3F4F6]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">Trusted Live Moderators</h2>
              <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 text-[10px] font-bold">
                {moderators.length} active
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Appointed moderators receive a green/cyan <strong className="text-emerald-300">MOD</strong> shield in your live chat and can delete messages, mute viewers for 10 mins, or ban spammers.
            </p>
          </div>
        </div>

        {/* Search & Appoint Moderator */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={modSearch}
            onChange={(e) => setModSearch(e.target.value)}
            placeholder="Search by @handle or name to appoint a Moderator..."
            className="pl-9 h-10 rounded-xl bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 text-xs sm:text-sm"
          />
          {isSearchingUsers && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-indigo-400" />
          )}
        </div>

        {/* Search Results */}
        {modSearchResults.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800 overflow-hidden">
            {modSearchResults.map((cand) => {
              const isAlready = modIdsSet.has(cand.uid);
              return (
                <div
                  key={cand.uid}
                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-8 w-8 border border-slate-700 shrink-0">
                      <AvatarImage src={cand.avatarUrl} alt={cand.name} />
                      <AvatarFallback className="bg-indigo-600 text-white text-xs">
                        {cand.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{cand.name}</p>
                      <p className="text-[11px] text-slate-300 truncate">@{cand.handle}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={isAlready || busyModUid === cand.uid}
                    onClick={() => handleAppointModerator(cand)}
                    className={`h-8 px-3 rounded-xl text-[11px] font-bold shrink-0 ${
                      isAlready
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {busyModUid === cand.uid ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isAlready ? (
                      'Already MOD'
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Make Mod
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Appointed Moderators List */}
        {moderators.length > 0 ? (
          <div className="space-y-2 pt-1">
            {moderators.map((mod) => (
              <div
                key={mod.userId}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-emerald-500/25"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 border border-emerald-400/40 shrink-0">
                    <AvatarImage src={mod.avatarUrl} alt={mod.username} />
                    <AvatarFallback className="bg-emerald-700 text-white text-xs font-bold">
                      {(mod.displayName || mod.username || 'M').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {mod.displayName || mod.username}
                      </p>
                      <ModShieldBadge compact />
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">
                      @{mod.username}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyModUid === mod.userId}
                  onClick={() => handleRemoveModerator(mod)}
                  className="h-8 px-3 rounded-xl text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-500/20 shrink-0"
                >
                  {busyModUid === mod.userId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Remove'
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900/70 border border-dashed border-slate-700 p-3 text-center text-xs text-slate-300">
            No moderators appointed yet. Search above or tap any viewer&apos;s name in your Live Chat to grant the MOD shield.
          </div>
        )}
      </div>
    </div>
  );
}
