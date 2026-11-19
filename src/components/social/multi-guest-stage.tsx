'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  addDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  UserPlus,
  UserMinus,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
  Check,
  PhoneOff,
  VolumeX,
  Volume2,
  Crown,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const MAX_ACTIVE_GUESTS = 3;

const GUEST_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export interface GuestRequestDoc {
  userId: string;
  username: string;
  avatarUrl?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  requestedAt?: any;
}

export interface ActiveGuestItem {
  userId: string;
  username: string;
  avatarUrl?: string;
  joinedAtMs: number;
  isMutedByHost?: boolean;
  isCamEnabled?: boolean;
  isMicEnabled?: boolean;
}

// ============================================================================
// 1. MULTI-GUEST CO-HOST HOOK (FIRESTORE QUEUE + WEBRTC TRANSPORT + CLEANUP)
// ============================================================================
export function useMultiGuestSystem({
  streamId,
  hostUid,
  currentUserId,
  currentUsername,
  currentAvatar,
  isHost,
  isGuestViewer,
  allowCoHostRequests,
}: {
  streamId: string;
  hostUid: string;
  currentUserId: string;
  currentUsername: string;
  currentAvatar?: string;
  isHost: boolean;
  isGuestViewer?: boolean;
  allowCoHostRequests: boolean;
}) {
  const [activeGuests, setActiveGuests] = useState<ActiveGuestItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<GuestRequestDoc[]>([]);
  const [myRequestStatus, setMyRequestStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  const [isStreamAllowingGuests, setIsStreamAllowingGuests] = useState<boolean>(allowCoHostRequests);

  // Guest Local Camera/Mic Media State (when viewer is ACCEPTED on stage)
  const [myGuestStream, setMyGuestStream] = useState<MediaStream | null>(null);
  const myGuestStreamRef = useRef<MediaStream | null>(null);
  const [guestMicOn, setGuestMicOn] = useState(true);
  const [guestCamOn, setGuestCamOn] = useState(true);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);

  // Remote Co-Host WebRTC Media Streams keyed by guest userId
  const [remoteGuestStreams, setRemoteGuestStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speakingRafRef = useRef<number>(0);

  const isMeActiveOnStage = activeGuests.some((g) => g.userId === currentUserId);
  const myGuestSlot = activeGuests.find((g) => g.userId === currentUserId);
  const isMutedByHost = Boolean(myGuestSlot?.isMutedByHost);

  // 1A. Listen to `streams/{streamId}` (`activeGuests` & `allowCoHostRequests`)
  useEffect(() => {
    if (!streamId) return;
    const unsub = onSnapshot(
      doc(db, 'streams', streamId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        if (Array.isArray(data.activeGuests)) {
          setActiveGuests(data.activeGuests as ActiveGuestItem[]);
        } else {
          setActiveGuests([]);
        }
        if (typeof data.allowCoHostRequests === 'boolean') {
          setIsStreamAllowingGuests(data.allowCoHostRequests);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [streamId]);

  // 1B. Listen to `streams/{streamId}/guest_requests`
  useEffect(() => {
    if (!streamId) return;
    const reqsCol = collection(db, 'streams', streamId, 'guest_requests');
    const unsub = onSnapshot(
      reqsCol,
      (snap) => {
        const list = snap.docs.map((d) => ({ userId: d.id, ...(d.data() as Omit<GuestRequestDoc, 'userId'>) }));
        setPendingRequests(list.filter((r) => r.status === 'PENDING'));

        if (!isHost && currentUserId) {
          const mine = list.find((r) => r.userId === currentUserId);
          if (!mine) setMyRequestStatus('NONE');
          else if (mine.status === 'ACCEPTED') setMyRequestStatus('ACCEPTED');
          else if (mine.status === 'PENDING') setMyRequestStatus('PENDING');
          else setMyRequestStatus('NONE');
        }
      },
      () => {}
    );
    return () => unsub();
  }, [streamId, isHost, currentUserId]);

  // 1C. Stop local co-host camera/mic and WebRTC connections cleanly
  const stopLocalGuestMedia = useCallback(() => {
    if (speakingRafRef.current) {
      cancelAnimationFrame(speakingRafRef.current);
      speakingRafRef.current = 0;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (myGuestStreamRef.current) {
      myGuestStreamRef.current.getTracks().forEach((t) => t.stop());
      myGuestStreamRef.current = null;
    }
    setMyGuestStream(null);
    setIsSpeakingLocal(false);
  }, []);

  // 1D. Prompt accepted viewer for Camera/Mic permissions (`getUserMedia`) + speaking level detector
  useEffect(() => {
    if (isHost) return;
    if (!isMeActiveOnStage && myRequestStatus !== 'ACCEPTED') {
      stopLocalGuestMedia();
      return;
    }

    let cancelled = false;
    const acquireCoHostMedia = async () => {
      if (myGuestStreamRef.current) return;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        myGuestStreamRef.current = media;
        setMyGuestStream(media);
        setGuestMicOn(true);
        setGuestCamOn(true);

        toast({
          title: '🎥 You Are On Stage!',
          description: 'Your camera & mic are live as a Co-Host.',
        });

        // Real-time speaking detection for tile border glow
        const AudioCtx =
          window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx && media.getAudioTracks().length > 0) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(media);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const detect = () => {
            if (!myGuestStreamRef.current) return;
            const audioLive = myGuestStreamRef.current.getAudioTracks().some((t) => t.enabled);
            if (!audioLive) {
              setIsSpeakingLocal(false);
            } else {
              analyser.getByteFrequencyData(buf);
              let sum = 0;
              for (let i = 0; i < 12; i++) sum += buf[i] || 0;
              setIsSpeakingLocal(sum / 12 > 22);
            }
            speakingRafRef.current = requestAnimationFrame(detect);
          };
          speakingRafRef.current = requestAnimationFrame(detect);
        }
      } catch (err) {
        console.warn('[MultiGuest] Camera/Mic permission denied:', err);
        toast({
          variant: 'destructive',
          title: 'Camera & Mic Permission Required',
          description: 'Allow camera and microphone access in your browser to appear on stage.',
        });
      }
    };

    acquireCoHostMedia();
    return () => {
      cancelled = true;
    };
  }, [isHost, isMeActiveOnStage, myRequestStatus, stopLocalGuestMedia]);

  // Enforce host remote mute immediately on the guest's audio track
  useEffect(() => {
    if (!myGuestStreamRef.current) return;
    const effectiveMic = guestMicOn && !isMutedByHost;
    myGuestStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = effectiveMic;
    });
  }, [guestMicOn, isMutedByHost]);

  useEffect(() => {
    if (!myGuestStreamRef.current) return;
    myGuestStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = guestCamOn;
    });
  }, [guestCamOn]);

  // 1E. WebRTC Signaling Transport for Co-Host Video Tiles (`streams/{streamId}/guest_signals`)
  useEffect(() => {
    if (!streamId || !currentUserId) return;
    const signalsCol = collection(db, 'streams', streamId, 'guest_signals');

    // Co-Host pushes WebRTC offer to every other active watcher/host
    const startBroadcastOfferToPeer = async (targetUid: string) => {
      if (!myGuestStreamRef.current || targetUid === currentUserId) return;
      const pcKey = `out_${targetUid}`;
      if (peerConnectionsRef.current.has(pcKey)) return;

      const pc = new RTCPeerConnection(GUEST_RTC_CONFIG);
      peerConnectionsRef.current.set(pcKey, pc);

      myGuestStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, myGuestStreamRef.current!);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          addDoc(signalsCol, {
            type: 'ice',
            fromUid: currentUserId,
            toUid: targetUid,
            candidate: e.candidate.toJSON(),
            createdAt: serverTimestamp(),
          }).catch(() => {});
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await addDoc(signalsCol, {
          type: 'offer',
          fromUid: currentUserId,
          toUid: targetUid,
          sdp: offer.sdp,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Ignore offer failures
      }
    };

    // If I am an active guest with camera ready, offer my stream to the Host
    if (!isHost && isMeActiveOnStage && myGuestStream && hostUid) {
      startBroadcastOfferToPeer(hostUid);
    }

    // Listen for incoming offers/answers/ICE directed to `currentUserId`
    const incomingQ = query(signalsCol, where('toUid', '==', currentUserId));
    const unsubSignals = onSnapshot(
      incomingQ,
      (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type !== 'added') return;
          const sig = change.doc.data();
          const fromUid = sig.fromUid as string;
          if (!fromUid || fromUid === currentUserId) return;

          if (sig.type === 'offer' && sig.sdp) {
            const pcKey = `in_${fromUid}`;
            let pc = peerConnectionsRef.current.get(pcKey);
            if (pc) pc.close();
            pc = new RTCPeerConnection(GUEST_RTC_CONFIG);
            peerConnectionsRef.current.set(pcKey, pc);

            pc.ontrack = (ev) => {
              const stream = ev.streams?.[0];
              if (stream) {
                setRemoteGuestStreams((prev) => ({ ...prev, [fromUid]: stream }));
              }
            };
            pc.onicecandidate = (e) => {
              if (e.candidate) {
                addDoc(signalsCol, {
                  type: 'ice',
                  fromUid: currentUserId,
                  toUid: fromUid,
                  candidate: e.candidate.toJSON(),
                  createdAt: serverTimestamp(),
                }).catch(() => {});
              }
            };

            try {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sig.sdp }));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await addDoc(signalsCol, {
                type: 'answer',
                fromUid: currentUserId,
                toUid: fromUid,
                sdp: answer.sdp,
                createdAt: serverTimestamp(),
              });
            } catch {
              // Ignore negotiation race
            }
          } else if (sig.type === 'answer' && sig.sdp) {
            const pc = peerConnectionsRef.current.get(`out_${fromUid}`);
            if (pc && pc.signalingState === 'have-local-offer') {
              pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sig.sdp })).catch(() => {});
            }
          } else if (sig.type === 'ice' && sig.candidate) {
            const pc =
              peerConnectionsRef.current.get(`in_${fromUid}`) ||
              peerConnectionsRef.current.get(`out_${fromUid}`);
            if (pc) {
              pc.addIceCandidate(new RTCIceCandidate(sig.candidate)).catch(() => {});
            }
          }
        });
      },
      () => {}
    );

    return () => {
      unsubSignals();
    };
  }, [streamId, currentUserId, hostUid, isHost, isMeActiveOnStage, myGuestStream]);

  // 1F. Clean Disconnect / Tab-Close Removal (`beforeunload` + `pagehide` + unmount)
  const leaveStageCleanly = useCallback(async () => {
    stopLocalGuestMedia();
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (!streamId || !currentUserId || isHost) return;
    try {
      const streamRef = doc(db, 'streams', streamId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(streamRef);
        if (snap.exists()) {
          const list = Array.isArray(snap.data()?.activeGuests) ? snap.data()!.activeGuests : [];
          tx.set(
            streamRef,
            {
              activeGuests: list.filter((g: ActiveGuestItem) => g.userId !== currentUserId),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
        tx.delete(doc(db, 'streams', streamId, 'guest_requests', currentUserId));
      });
    } catch {
      fetch('/api/streams/guest-leave', {
        method: 'POST',
        body: JSON.stringify({ streamId, userId: currentUserId }),
      }).catch(() => {});
    }
  }, [streamId, currentUserId, isHost, stopLocalGuestMedia]);

  useEffect(() => {
    if (isHost || !isMeActiveOnStage || !streamId || !currentUserId) return;

    const handleTabUnload = () => {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ streamId, userId: currentUserId })], {
          type: 'application/json',
        });
        navigator.sendBeacon('/api/streams/guest-leave', blob);
      }
    };

    window.addEventListener('beforeunload', handleTabUnload);
    window.addEventListener('pagehide', handleTabUnload);
    return () => {
      window.removeEventListener('beforeunload', handleTabUnload);
      window.removeEventListener('pagehide', handleTabUnload);
      leaveStageCleanly();
    };
  }, [isHost, isMeActiveOnStage, streamId, currentUserId, leaveStageCleanly]);

  // --------------------------------------------------------------------------
  // VIEWER ACTIONS: Request to Join / Cancel Request / Leave Stage
  // --------------------------------------------------------------------------
  const handleViewerRequestJoin = async () => {
    if (isGuestViewer || !currentUserId) {
      toast({ title: 'Sign In Required', description: 'Sign in to request to co-host on stage!' });
      return;
    }
    if (!isStreamAllowingGuests) {
      toast({ title: 'Guest Requests Disabled', description: 'The host has paused co-host requests.' });
      return;
    }

    const reqRef = doc(db, 'streams', streamId, 'guest_requests', currentUserId);
    try {
      if (myRequestStatus === 'PENDING') {
        await deleteDoc(reqRef);
        toast({ title: 'Request Canceled', description: 'Removed your co-host join request.' });
      } else {
        await setDoc(reqRef, {
          userId: currentUserId,
          username: currentUsername,
          avatarUrl: currentAvatar || '',
          status: 'PENDING',
          requestedAt: serverTimestamp(),
        });
        toast({
          title: '🙋 Co-Host Request Sent!',
          description: 'Waiting for the host to invite you on stage.',
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update your join request.' });
    }
  };

  // --------------------------------------------------------------------------
  // HOST ACTIONS: Accept (Max 3), Decline, Mute Guest, Remove Guest
  // --------------------------------------------------------------------------
  const handleHostAcceptGuest = async (req: GuestRequestDoc) => {
    if (!isHost || !streamId) return;
    if (activeGuests.length >= MAX_ACTIVE_GUESTS) {
      toast({
        variant: 'destructive',
        title: `Stage Full (${MAX_ACTIVE_GUESTS}/${MAX_ACTIVE_GUESTS})`,
        description: 'Remove an active co-host before accepting another guest.',
      });
      return;
    }

    const streamRef = doc(db, 'streams', streamId);
    const reqRef = doc(db, 'streams', streamId, 'guest_requests', req.userId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(streamRef);
        const currentList: ActiveGuestItem[] = snap.exists() && Array.isArray(snap.data()?.activeGuests)
          ? snap.data()!.activeGuests
          : [];
        if (currentList.length >= MAX_ACTIVE_GUESTS) {
          throw new Error('Stage is already full (3/3 guests).');
        }
        const alreadyIn = currentList.some((g) => g.userId === req.userId);
        const nextList = alreadyIn
          ? currentList
          : [
              ...currentList,
              {
                userId: req.userId,
                username: req.username,
                avatarUrl: req.avatarUrl || '',
                joinedAtMs: Date.now(),
                isMutedByHost: false,
                isCamEnabled: true,
                isMicEnabled: true,
              },
            ];

        tx.set(streamRef, { activeGuests: nextList, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(reqRef, { status: 'ACCEPTED', acceptedAt: serverTimestamp() }, { merge: true });
      });

      toast({ title: '🎉 Co-Host Invited!', description: `${req.username} is joining the stage.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could Not Accept', description: err?.message || 'Try again.' });
    }
  };

  const handleHostDeclineGuest = async (guestUid: string) => {
    if (!isHost || !streamId) return;
    await deleteDoc(doc(db, 'streams', streamId, 'guest_requests', guestUid)).catch(() => {});
    toast({ title: 'Request Declined' });
  };

  const handleHostToggleMuteGuest = async (guestUid: string) => {
    if (!isHost || !streamId) return;
    const streamRef = doc(db, 'streams', streamId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(streamRef);
        if (!snap.exists()) return;
        const list: ActiveGuestItem[] = Array.isArray(snap.data()?.activeGuests) ? snap.data()!.activeGuests : [];
        const updated = list.map((g) =>
          g.userId === guestUid ? { ...g, isMutedByHost: !g.isMutedByHost } : g
        );
        tx.set(streamRef, { activeGuests: updated, updatedAt: serverTimestamp() }, { merge: true });
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not toggle guest mute.' });
    }
  };

  const handleHostRemoveGuest = async (guestUid: string, guestName?: string) => {
    if (!isHost || !streamId) return;
    const streamRef = doc(db, 'streams', streamId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(streamRef);
        const list: ActiveGuestItem[] = snap.exists() && Array.isArray(snap.data()?.activeGuests)
          ? snap.data()!.activeGuests
          : [];
        tx.set(
          streamRef,
          {
            activeGuests: list.filter((g) => g.userId !== guestUid),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        tx.delete(doc(db, 'streams', streamId, 'guest_requests', guestUid));
      });
      setRemoteGuestStreams((prev) => {
        const copy = { ...prev };
        delete copy[guestUid];
        return copy;
      });
      toast({ title: 'Guest Removed', description: `${guestName || 'Guest'} has been removed from stage.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove guest.' });
    }
  };

  return {
    activeGuests,
    pendingRequests,
    myRequestStatus,
    isStreamAllowingGuests,
    isMeActiveOnStage,
    isMutedByHost,
    myGuestStream,
    remoteGuestStreams,
    guestMicOn,
    setGuestMicOn,
    guestCamOn,
    setGuestCamOn,
    isSpeakingLocal,
    handleViewerRequestJoin,
    leaveStageCleanly,
    handleHostAcceptGuest,
    handleHostDeclineGuest,
    handleHostToggleMuteGuest,
    handleHostRemoveGuest,
  };
}

// ============================================================================
// 2. INDIVIDUAL CO-HOST VIDEO TILE (LIVE STREAM + SPEAKING INDICATOR)
// ============================================================================
function CoHostVideoTile({
  guest,
  mediaStream,
  isSelf,
  isSpeaking,
  isCamOn,
  isMicOn,
}: {
  guest: ActiveGuestItem;
  mediaStream: MediaStream | null;
  isSelf: boolean;
  isSpeaking: boolean;
  isCamOn: boolean;
  isMicOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [mediaStream]);

  const muted = Boolean(guest.isMutedByHost) || !isMicOn;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-zinc-900 border-2 transition-all ${
        isSpeaking && !muted
          ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.45)]'
          : 'border-white/15'
      }`}
    >
      {mediaStream && isCamOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf || muted}
          className={`w-full h-full object-cover ${isSelf ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-indigo-950/40 to-zinc-950 flex flex-col items-center justify-center p-4">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-indigo-400/50 shadow-xl mb-2">
            <AvatarImage src={guest.avatarUrl} alt={guest.username} />
            <AvatarFallback className="bg-indigo-600 text-white text-xl font-black">
              {guest.username?.charAt(0).toUpperCase() || 'G'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-bold text-zinc-300">
            {mediaStream ? 'Camera Off' : 'Connecting Video...'}
          </span>
        </div>
      )}

      {/* Top-Left Speaking & Audio Indicator */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
        <Badge className="bg-black/60 backdrop-blur-md text-white border border-white/15 text-[10px] font-bold px-2 py-0.5 gap-1">
          {muted ? (
            <MicOff className="h-3 w-3 text-rose-400" />
          ) : (
            <span className={`h-2 w-2 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
          )}
          <span>{guest.isMutedByHost ? 'Muted by Host' : isSelf ? 'You (Co-Host)' : 'Co-Host'}</span>
        </Badge>
      </div>

      {/* Bottom-Left Username Pill */}
      <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md border border-white/15 rounded-full px-2.5 py-1 flex items-center gap-1.5 max-w-[85%]">
        <Avatar className="h-4 w-4 shrink-0">
          <AvatarImage src={guest.avatarUrl} alt={guest.username} />
          <AvatarFallback className="text-[8px] bg-indigo-600 text-white">
            {guest.username?.charAt(0) || 'G'}
          </AvatarFallback>
        </Avatar>
        <span className="text-[11px] font-bold text-white truncate">@{guest.username}</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// 3. DYNAMIC SPLIT-SCREEN VIDEO GRID (1 FULL, 2 50/50, 3-4 2x2 GRID)
// ============================================================================
export function MultiGuestSplitGridOverlay({
  activeGuests,
  currentUserId,
  hostName,
  hostAvatar,
  myGuestStream,
  remoteGuestStreams,
  isMeActiveOnStage,
  isMutedByHost,
  guestMicOn,
  setGuestMicOn,
  guestCamOn,
  setGuestCamOn,
  isSpeakingLocal,
  onLeaveStage,
}: {
  activeGuests: ActiveGuestItem[];
  currentUserId: string;
  hostName: string;
  hostAvatar?: string;
  myGuestStream: MediaStream | null;
  remoteGuestStreams: Record<string, MediaStream>;
  isMeActiveOnStage: boolean;
  isMutedByHost: boolean;
  guestMicOn: boolean;
  setGuestMicOn: (v: boolean) => void;
  guestCamOn: boolean;
  setGuestCamOn: (v: boolean) => void;
  isSpeakingLocal: boolean;
  onLeaveStage: () => void;
}) {
  if (activeGuests.length === 0) return null;

  const totalOnStage = 1 + activeGuests.length; // Host + 1..3 Guests
  const gridClasses =
    totalOnStage === 2
      ? 'grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1' // 50/50 Split-Screen
      : 'grid-cols-2 grid-rows-2'; // Clean 2x2 Grid for 3–4 participants

  return (
    <>
      {/* Dynamic Responsive Split-Screen Co-Host Boxes Layer */}
      <div className="absolute inset-0 z-10 pt-16 pb-20 px-2 sm:px-4 pointer-events-none">
        <div className={`w-full h-full grid gap-2 sm:gap-3 ${gridClasses}`}>
          {/* Slot 1: Transparent Frame Window showing the Underlying Host Video Tile */}
          <div className="relative w-full h-full rounded-2xl border-2 border-indigo-400/40 bg-transparent overflow-hidden">
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
              <Badge className="bg-indigo-600/85 backdrop-blur-md text-white text-[10px] font-black px-2 py-0.5 gap-1">
                <Crown className="h-3 w-3 text-amber-300" />
                HOST
              </Badge>
            </div>
            <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md border border-white/15 rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Avatar className="h-4 w-4 shrink-0">
                <AvatarImage src={hostAvatar} alt={hostName} />
                <AvatarFallback className="text-[8px] bg-indigo-600 text-white">{hostName?.charAt(0) || 'H'}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-bold text-white truncate">{hostName}</span>
            </div>
          </div>

          {/* Slots 2..4: Active Co-Host Guest Video Boxes */}
          <AnimatePresence>
            {activeGuests.slice(0, MAX_ACTIVE_GUESTS).map((guest) => {
              const isSelf = guest.userId === currentUserId;
              const stream = isSelf ? myGuestStream : remoteGuestStreams[guest.userId] || null;
              return (
                <CoHostVideoTile
                  key={guest.userId}
                  guest={guest}
                  mediaStream={stream}
                  isSelf={isSelf}
                  isSpeaking={isSelf ? isSpeakingLocal : false}
                  isCamOn={isSelf ? guestCamOn : guest.isCamEnabled !== false}
                  isMicOn={isSelf ? guestMicOn : guest.isMicEnabled !== false}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Co-Host Controls for Accepted Guest (Mic Mute, Camera Toggle, Leave Stage) */}
      {isMeActiveOnStage && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-zinc-950/90 backdrop-blur-xl border border-indigo-400/40 rounded-full px-3.5 py-2 shadow-2xl pointer-events-auto">
          <button
            type="button"
            disabled={isMutedByHost}
            onClick={() => setGuestMicOn(!guestMicOn)}
            className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              isMutedByHost || !guestMicOn
                ? 'bg-rose-600/35 text-rose-200 border border-rose-400/40'
                : 'bg-emerald-600/30 text-emerald-200 border border-emerald-400/40'
            }`}
          >
            {isMutedByHost || !guestMicOn ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{isMutedByHost ? 'Host Muted' : guestMicOn ? 'Mic' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => setGuestCamOn(!guestCamOn)}
            className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              guestCamOn
                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-400/40'
                : 'bg-rose-600/35 text-rose-200 border border-rose-400/40'
            }`}
          >
            {guestCamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            <span>{guestCamOn ? 'Cam' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={onLeaveStage}
            className="h-9 px-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-all"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>Leave Stage</span>
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 4. HOST GUEST MANAGEMENT DRAWER (ACTIVE CO-HOSTS + PENDING QUEUE)
// ============================================================================
export function HostGuestManagementDrawer({
  isOpen,
  onClose,
  activeGuests,
  pendingRequests,
  onAccept,
  onDecline,
  onToggleMute,
  onRemove,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeGuests: ActiveGuestItem[];
  pendingRequests: GuestRequestDoc[];
  onAccept: (req: GuestRequestDoc) => void;
  onDecline: (uid: string) => void;
  onToggleMute: (uid: string) => void;
  onRemove: (uid: string, name?: string) => void;
}) {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  if (!isOpen) return null;

  const isStageFull = activeGuests.length >= MAX_ACTIVE_GUESTS;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-white/15 p-5 shadow-2xl max-h-[82vh] flex flex-col space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Multi-Guest Co-Host Stage</h3>
              <p className="text-[11px] text-zinc-400">
                Active Co-Hosts: <strong className="text-emerald-300">{activeGuests.length}/{MAX_ACTIVE_GUESTS}</strong>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-zinc-400">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto space-y-5 pr-1">
          {/* Active Co-Hosts Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                On Stage Now ({activeGuests.length}/{MAX_ACTIVE_GUESTS})
              </h4>
              {isStageFull && (
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px]">
                  Stage Full (3 Max)
                </Badge>
              )}
            </div>

            {activeGuests.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center text-xs text-zinc-400">
                No co-hosts on stage yet. Accept a viewer below to split-screen!
              </div>
            ) : (
              <div className="space-y-2">
                {activeGuests.map((guest) => (
                  <div
                    key={guest.userId}
                    className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-950/25 border border-emerald-500/30"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 border border-emerald-400/40 shrink-0">
                        <AvatarImage src={guest.avatarUrl} alt={guest.username} />
                        <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                          {guest.username?.charAt(0) || 'G'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{guest.username}</p>
                        <p className="text-[10px] text-emerald-300">
                          {guest.isMutedByHost ? 'Muted by Host' : 'Live on Stage'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onToggleMute(guest.userId)}
                        className={`h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 ${
                          guest.isMutedByHost
                            ? 'border-amber-400/50 text-amber-300 bg-amber-500/15'
                            : 'border-white/15 text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        {guest.isMutedByHost ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                        <span>{guest.isMutedByHost ? 'Unmute' : 'Mute'}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemove(guest.userId, guest.username)}
                        className="h-8 px-2.5 rounded-xl border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-[11px] font-bold gap-1"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Requests Queue */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400">
              Pending Requests ({pendingRequests.length})
            </h4>

            {pendingRequests.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center text-xs text-zinc-400">
                No pending guest requests right now.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.userId}
                    className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 border border-white/15 shrink-0">
                        <AvatarImage src={req.avatarUrl} alt={req.username} />
                        <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                          {req.username?.charAt(0) || 'V'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{req.username}</p>
                        <p className="text-[10px] text-zinc-400">Wants to co-host</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        disabled={isStageFull || busyUid === req.userId}
                        onClick={async () => {
                          setBusyUid(req.userId);
                          await onAccept(req);
                          setBusyUid(null);
                        }}
                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold gap-1 disabled:opacity-40"
                      >
                        {busyUid === req.userId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyUid === req.userId}
                        onClick={() => onDecline(req.userId)}
                        className="h-8 px-2.5 rounded-xl border-rose-500/35 text-rose-300 hover:bg-rose-500/15 text-[11px]"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
