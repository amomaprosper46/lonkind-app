'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  FlipHorizontal2,
  Camera,
  Upload,
  Globe,
  Users,
  MessageSquare,
  Gift,
  UserPlus,
  Sparkles,
  Wifi,
  Settings2,
  X,
  RefreshCw,
  Check,
  Target,
  ChevronDown,
  Loader2,
  Trash2,
  CalendarClock,
  BellRing,
  Megaphone,
} from 'lucide-react';
import { getDoc } from 'firebase/firestore';
import { PromoteDialog } from './promote-dialog';
import { toast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/image-compression';
import {
  type ScheduledStreamDoc,
  toLocalDateTimeInputValue,
  formatScheduledDateShort,
  toMillis,
} from './upcoming-lives-banner';

export type StreamCategoryId = 'chat' | 'music' | 'gaming' | 'creative' | 'lifestyle';

export interface PreLiveStudioConfig {
  streamTitle: string;
  streamCategory: StreamCategoryId;
  streamMode: 'video' | 'audio';
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isMirrored: boolean;
  visibility: 'public' | 'followers';
  allowChat: boolean;
  allowGifts: boolean;
  allowCoHostRequests: boolean;
  thumbnailUrl?: string;
  selectedVideoDeviceId?: string;
  selectedAudioDeviceId?: string;
  goalEnabled: boolean;
  goalTitle: string;
  goalTarget: number;
  scheduledStreamId?: string;
}

interface PreLiveStudioProps {
  roomId: string;
  hostUid: string;
  hostName: string;
  hostHandle?: string;
  hostAvatar?: string;
  initialTitle: string;
  initialCategory: StreamCategoryId;
  initialMode: 'video' | 'audio';
  initialCameraEnabled: boolean;
  initialMicEnabled: boolean;
  initialGoalEnabled: boolean;
  initialGoalTitle: string;
  initialGoalTarget: number;
  activeScheduledStream?: ScheduledStreamDoc | null;
  onStreamScheduled?: (event: ScheduledStreamDoc) => void;
  onCancel: () => void;
  onGoLiveReady: (config: PreLiveStudioConfig) => void;
}

const MAX_TITLE_LEN = 80;

const TOPIC_TAGS: { id: StreamCategoryId; label: string; emoji: string; accent: string }[] = [
  { id: 'chat', label: 'Just Chatting', emoji: '💬', accent: 'from-indigo-500 to-blue-500' },
  { id: 'music', label: 'Music', emoji: '🎵', accent: 'from-fuchsia-500 to-pink-500' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮', accent: 'from-emerald-500 to-teal-500' },
  { id: 'creative', label: 'Q&A', emoji: '💡', accent: 'from-amber-500 to-orange-500' },
  { id: 'lifestyle', label: 'IRL', emoji: '🌍', accent: 'from-cyan-500 to-sky-500' },
];

// Subtle synthesized Web Audio countdown ping (3, 2, 1, GO!)
function playCountdownTone(step: number) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = step === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(step === 0 ? 880 : 520 + (3 - step) * 80, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (step === 0 ? 0.35 : 0.18));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // Ignore audio context blocks
  }
}

export default function PreLiveStudio({
  roomId,
  hostUid,
  hostName,
  hostHandle,
  hostAvatar,
  initialTitle,
  initialCategory,
  initialMode,
  initialCameraEnabled,
  initialMicEnabled,
  initialGoalEnabled,
  initialGoalTitle,
  initialGoalTarget,
  activeScheduledStream,
  onStreamScheduled,
  onCancel,
  onGoLiveReady,
}: PreLiveStudioProps) {
  // Broadcast configuration state
  const [streamTitle, setStreamTitle] = useState(
    (activeScheduledStream?.title || initialTitle).slice(0, MAX_TITLE_LEN)
  );
  const [streamCategory, setStreamCategory] = useState<StreamCategoryId>(
    ((activeScheduledStream?.category as StreamCategoryId) || initialCategory)
  );
  const [streamMode, setStreamMode] = useState<'video' | 'audio'>(initialMode);
  const [isCameraEnabled, setIsCameraEnabled] = useState(initialCameraEnabled);
  const [isMicEnabled, setIsMicEnabled] = useState(initialMicEnabled);
  const [isMirrored, setIsMirrored] = useState(true);

  // Audience & Monetization Controls
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [allowChat, setAllowChat] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);
  const [allowCoHostRequests, setAllowCoHostRequests] = useState(true);

  // Optional Stream Goal (COINS or LIKES)
  const [goalEnabled, setGoalEnabled] = useState(initialGoalEnabled);
  const [goalType, setGoalType] = useState<'COINS' | 'LIKES'>('COINS');
  const [goalTitle, setGoalTitle] = useState(initialGoalTitle);
  const [goalTarget, setGoalTarget] = useState(initialGoalTarget);

  // Schedule for Later Mode
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [scheduledForStr, setScheduledForStr] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [isScheduling, setIsScheduling] = useState(false);

  // Custom Thumbnail / Camera Snapshot
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    activeScheduledStream?.coverUrl || null
  );
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hardware Media Preview & Device Enumerations
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [streamStats, setStreamStats] = useState<{ label: string; healthy: boolean }>({
    label: 'Checking Camera & Mic...',
    healthy: false,
  });

  // Real-Time Green Audio Level Visualizer (5 responsive bars)
  const [audioLevels, setAudioLevels] = useState<number[]>([0.12, 0.16, 0.14, 0.18, 0.12]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number>(0);

  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [hostCoins, setHostCoins] = useState(0);

  useEffect(() => {
    if (!hostUid) return;
    getDoc(doc(db, 'users', hostUid))
      .then((snap) => {
        if (snap.exists()) setHostCoins(Number(snap.data()?.coins || 0));
      })
      .catch(() => {});
  }, [hostUid, isPromoteOpen]);

  // 3-2-1 Go Live Countdown & Publishing State
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);

  // Stop all active preview tracks cleanly
  const stopPreviewMedia = useCallback(() => {
    if (analyserRafRef.current) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = 0;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Enumerate connected Cameras & Microphones
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setVideoDevices(cams);
      setAudioDevices(mics);
      if (!selectedVideoDeviceId && cams[0]?.deviceId) {
        setSelectedVideoDeviceId(cams[0].deviceId);
      }
      if (!selectedAudioDeviceId && mics[0]?.deviceId) {
        setSelectedAudioDeviceId(mics[0].deviceId);
      }
    } catch {
      // Ignore device enumeration errors
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  // Acquire live camera & microphone stream via getUserMedia
  const startPreviewMedia = useCallback(async () => {
    stopPreviewMedia();
    setMediaError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMediaError('Your browser does not support camera/microphone access.');
      setStreamStats({ label: 'Browser Unsupported', healthy: false });
      return;
    }

    try {
      const videoConstraint: boolean | MediaTrackConstraints =
        streamMode === 'video'
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : { facingMode: 'user' }),
            }
          : false;

      const audioConstraint: boolean | MediaTrackConstraints = selectedAudioDeviceId
        ? { deviceId: { exact: selectedAudioDeviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true };

      const media = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint,
      });

      streamRef.current = media;

      // Apply current mute/camera toggles
      media.getVideoTracks().forEach((t) => {
        t.enabled = isCameraEnabled && streamMode === 'video';
      });
      media.getAudioTracks().forEach((t) => {
        t.enabled = isMicEnabled;
      });

      if (videoRef.current && streamMode === 'video') {
        videoRef.current.srcObject = media;
        videoRef.current.play().catch(() => {});
      }

      // Read real video settings for the Stream Health pill
      const vTrack = media.getVideoTracks()[0];
      const settings = vTrack?.getSettings();
      const resLabel =
        streamMode === 'audio'
          ? 'HD Studio Audio • Connection Ready'
          : settings?.height
          ? `${settings.height}p HD • Connection Ready`
          : 'HD Video • Connection Ready';
      setStreamStats({ label: resLabel, healthy: true });

      // Refresh labeled devices after permissions are granted
      refreshDevices();

      // Wire real-time Web Audio AnalyserNode for the green mic level visualizer
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx && media.getAudioTracks().length > 0) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(media);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        src.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!streamRef.current) return;
          const activeAudio = streamRef.current.getAudioTracks().some((t) => t.enabled);
          if (!activeAudio) {
            setAudioLevels([0.1, 0.1, 0.1, 0.1, 0.1]);
          } else {
            analyser.getByteFrequencyData(dataArray);
            const bars = [2, 4, 7, 10, 14].map((bin) => {
              const raw = (dataArray[bin] || 0) / 255;
              return Math.max(0.14, Math.min(1, raw * 1.45));
            });
            setAudioLevels(bars);
          }
          analyserRafRef.current = requestAnimationFrame(tick);
        };
        analyserRafRef.current = requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.warn('[PreLiveStudio] getUserMedia error:', err);
      setMediaError(
        err?.name === 'NotAllowedError'
          ? 'Camera or microphone permission was denied. Allow access in your browser to preview.'
          : 'Could not access camera or microphone. Check that no other app is using them.'
      );
      setStreamStats({ label: 'Check Permissions', healthy: false });
    }
  }, [streamMode, selectedVideoDeviceId, selectedAudioDeviceId, isCameraEnabled, isMicEnabled, refreshDevices, stopPreviewMedia]);

  // Start preview on mount and when device/mode changes
  useEffect(() => {
    startPreviewMedia();
    return () => {
      stopPreviewMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamMode, selectedVideoDeviceId, selectedAudioDeviceId]);

  // Toggle video/audio tracks in place without tearing down the stream
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = isCameraEnabled && streamMode === 'video';
    });
  }, [isCameraEnabled, streamMode]);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = isMicEnabled;
    });
  }, [isMicEnabled]);

  // Clean up countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) window.clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // Capture crisp 16:9 snapshot directly from live webcam preview
  const handleCaptureSnapshot = () => {
    const video = videoRef.current;
    if (!video || !isCameraEnabled || streamMode !== 'video' || video.videoWidth === 0) {
      toast({
        variant: 'destructive',
        title: 'Camera Preview Needed',
        description: 'Turn on your Video camera preview first to snap a cover photo.',
      });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setThumbnailPreview(dataUrl);
    canvas.toBlob(
      (blob) => {
        if (blob) setThumbnailBlob(blob);
      },
      'image/jpeg',
      0.9
    );
    toast({ title: 'Cover Snapshot Captured!', description: 'Your live cover thumbnail is ready.' });
  };

  // Custom thumbnail upload handler
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailBlob(file);
    setThumbnailPreview(URL.createObjectURL(file));
    toast({ title: 'Custom Thumbnail Ready', description: file.name });
  };

  // Finalize & write active stream document to Firestore `streams` + transition into Live Room
  const finalizeGoLive = useCallback(async () => {
    setIsLaunching(true);
    playCountdownTone(0);

    // Release preview hardware tracks BEFORE LiveStreamView initializes WebRTC
    stopPreviewMedia();

    let uploadedThumbUrl = '';
    if (thumbnailBlob && hostUid) {
      try {
        const fileToUpload =
          thumbnailBlob instanceof File
            ? await compressImage(thumbnailBlob)
            : new File([thumbnailBlob], `snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const thumbRef = ref(storage, `stream_thumbnails/${hostUid}/${Date.now()}_cover.jpg`);
        const snap = await uploadBytes(thumbRef, fileToUpload);
        uploadedThumbUrl = await getDownloadURL(snap.ref);
      } catch (err) {
        console.warn('[PreLiveStudio] Thumbnail upload fallback:', err);
      }
    }

    const finalTitle = streamTitle.trim() || `${hostName}'s Live Stream ✨`;

    // Persist active stream document in Firebase Firestore (`streams` collection)
    try {
      await setDoc(
        doc(db, 'streams', roomId),
        {
          id: roomId,
          status: 'active',
          hostUid,
          hostName,
          hostAvatar: hostAvatar || '',
          title: finalTitle,
          category: streamCategory,
          streamMode,
          visibility,
          allowChat,
          allowGifts,
          allowCoHostRequests,
          thumbnailUrl: uploadedThumbUrl || hostAvatar || '',
          streamGoal: goalEnabled
            ? {
                title: goalTitle.trim() || 'Community Goal 🎯',
                type: goalType,
                currentAmount: 0,
                targetAmount: Math.max(10, Number(goalTarget) || 1000),
              }
            : null,
          viewerCount: 1,
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[PreLiveStudio] streams collection write warning:', err);
    }

    // If launching from a Scheduled Stream, mark it LIVE and trigger Push + In-App alerts to all subscribers!
    if (activeScheduledStream?.id) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          const res = await fetch('/api/streams/start-scheduled', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              scheduleId: activeScheduledStream.id,
              streamTitle: finalTitle,
              category: streamCategory,
              coverUrl: uploadedThumbUrl || activeScheduledStream.coverUrl || null,
              visibility,
              allowChat,
              allowGifts,
              allowCoHostRequests,
            }),
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data) {
            toast({
              title: '🔔 Followers Notified!',
              description: `Sent ${data.notifiedInAppCount || 0} in-app & ${data.notifiedPushCount || 0} push alerts to your Remind Me list.`,
            });
          }
        }
      } catch (schedErr) {
        console.warn('[PreLiveStudio] start-scheduled dispatch warning:', schedErr);
      }
    }

    // Require verified email before unlocking live streaming (phone-only users unaffected)
    if (auth.currentUser?.email && !auth.currentUser.emailVerified) {
      await auth.currentUser.reload().catch(() => {});
      if (!auth.currentUser.emailVerified) {
        toast({
          variant: 'destructive',
          title: 'Email Verification Required',
          description:
            'Please verify your Gmail address (check your inbox for the verification link) before starting a live stream.',
        });
        return;
      }
    }

    onGoLiveReady({
      streamTitle: finalTitle,
      streamCategory,
      streamMode,
      isCameraEnabled,
      isMicEnabled,
      isMirrored,
      visibility,
      allowChat,
      allowGifts,
      allowCoHostRequests,
      thumbnailUrl: uploadedThumbUrl || activeScheduledStream?.coverUrl || undefined,
      selectedVideoDeviceId,
      selectedAudioDeviceId,
      goalEnabled,
      goalTitle,
      goalTarget,
      scheduledStreamId: activeScheduledStream?.id,
    });
  }, [
    activeScheduledStream,
    allowChat,
    allowCoHostRequests,
    allowGifts,
    goalEnabled,
    goalTarget,
    goalTitle,
    goalType,
    hostAvatar,
    hostName,
    hostUid,
    isCameraEnabled,
    isMicEnabled,
    isMirrored,
    onGoLiveReady,
    roomId,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    stopPreviewMedia,
    streamCategory,
    streamMode,
    streamTitle,
    thumbnailBlob,
    visibility,
  ]);

  const applySchedulePreset = (offsetHours: number, fixedHour?: number) => {
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

  // Save a new scheduled broadcast to `scheduled_streams`
  const handleScheduleForLater = async () => {
    if (isScheduling || isLaunching || countdown !== null) return;
    const cleanTitle = streamTitle.trim() || `${hostName}'s Upcoming Live`;
    const scheduledDate = new Date(scheduledForStr);

    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() - 60_000) {
      toast({
        variant: 'destructive',
        title: 'Choose a future date & time',
        description: 'Pick a start time in the future for your scheduled stream.',
      });
      return;
    }

    setIsScheduling(true);
    try {
      let uploadedCoverUrl: string | null = thumbnailPreview?.startsWith('http') ? thumbnailPreview : null;
      if (thumbnailBlob) {
        const storageRef = ref(storage, `stream_thumbnails/${hostUid}/scheduled_${Date.now()}.jpg`);
        await uploadBytes(storageRef, thumbnailBlob);
        uploadedCoverUrl = await getDownloadURL(storageRef);
      }

      const payload = {
        hostId: hostUid,
        hostName: hostName || 'Lonkind Creator',
        hostHandle: hostHandle || hostName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator',
        hostAvatar: hostAvatar || '',
        title: cleanTitle,
        category: streamCategory,
        coverUrl: uploadedCoverUrl,
        scheduledFor: Timestamp.fromDate(scheduledDate),
        status: 'UPCOMING' as const,
        subscribersCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'scheduled_streams'), payload);

      toast({
        title: '📅 Stream Scheduled on Lonkind!',
        description: `"${cleanTitle}" is scheduled for ${formatScheduledDateShort(
          scheduledDate.getTime()
        )}. Followers can now tap Remind Me!`,
      });

      stopPreviewMedia();
      if (onStreamScheduled) {
        onStreamScheduled({ id: docRef.id, ...payload });
      } else {
        onCancel();
      }
    } catch (err: any) {
      console.error('[PreLiveStudio] schedule error:', err);
      toast({
        variant: 'destructive',
        title: 'Could not schedule stream',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Trigger smooth 3 -> 2 -> 1 countdown before going live
  const handleStartCountdown = () => {
    if (countdown !== null || isLaunching) return;
    setCountdown(3);
    playCountdownTone(3);

    let step = 3;
    const advance = () => {
      step -= 1;
      if (step >= 1) {
        setCountdown(step);
        playCountdownTone(step);
        countdownTimerRef.current = window.setTimeout(advance, 920);
      } else {
        setCountdown(0);
        finalizeGoLive();
      }
    };
    countdownTimerRef.current = window.setTimeout(advance, 920);
  };

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-zinc-100 flex flex-col overflow-y-auto">
      {/* Subtle Ambient Studio Backlighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-[110px]" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-rose-600/12 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-cyan-600/10 blur-[110px]" />
      </div>

      {/* Studio Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl px-4 sm:px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
            <Radio className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                Creator Pre-Live Studio
              </h1>
              <Badge className="hidden sm:inline-flex bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-extrabold uppercase">
                Lonkind Live
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 truncate">
              Check your camera, mic, and hype controls before going on air
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleCancelCountdown();
            stopPreviewMedia();
            onCancel();
          }}
          className="rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-bold gap-1.5"
        >
          <X className="h-4 w-4" />
          <span>Exit Studio</span>
        </Button>
      </header>

      {/* Split-Screen Studio Grid (Desktop) / Stacked Preview (Mobile) */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================== */}
        {/* LEFT / TOP PANEL (7 COLS): LIVE CAMERA & AUDIO CHECK               */}
        {/* ================================================================== */}
        <section className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[4/3] sm:aspect-video w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/15 shadow-2xl shadow-black/60 group">
            {/* Live Webcam Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-all duration-300 ${
                isMirrored ? 'scale-x-[-1]' : ''
              } ${streamMode === 'video' && isCameraEnabled && !mediaError ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Camera Off / Audio Room / Permission Fallback Visual Stage */}
            {(streamMode === 'audio' || !isCameraEnabled || mediaError) && (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-indigo-950/50 to-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-4">
                  {isMicEnabled && !mediaError && (
                    <span
                      className="absolute inset-0 rounded-full bg-emerald-500/25 blur-xl transition-transform duration-100"
                      style={{ transform: `scale(${1 + (audioLevels[2] || 0.2) * 0.55})` }}
                    />
                  )}
                  <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-indigo-500/40 shadow-2xl relative z-10">
                    <AvatarImage src={hostAvatar} alt={hostName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-3xl font-black">
                      {hostName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {mediaError ? (
                  <div className="space-y-3 max-w-sm">
                    <p className="text-sm font-bold text-rose-300">{mediaError}</p>
                    <Button
                      size="sm"
                      onClick={startPreviewMedia}
                      className="rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry Camera &amp; Mic
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-base font-extrabold text-white">
                      {streamMode === 'audio' ? '🎙️ Audio Voice Room Preview' : 'Camera Paused'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {streamMode === 'audio'
                        ? 'Your voice is crystal clear. Viewers will see your creator stage.'
                        : 'Tap Camera below anytime to turn your video back on.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Subtle Top Gradient Scrim */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/65 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none" />

            {/* Top-Left: Stream Health / Connection Ready Pill */}
            <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 shadow-lg">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      streamStats.healthy ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      streamStats.healthy ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </span>
                <Wifi className={`h-3.5 w-3.5 ${streamStats.healthy ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="text-[11px] font-bold text-zinc-100 tracking-tight">{streamStats.label}</span>
              </div>
            </div>

            {/* Top-Right: Video Live vs Audio Room Mode Switcher Pill */}
            <div className="absolute top-3.5 right-3.5 z-20 flex items-center p-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15">
              <button
                type="button"
                onClick={() => setStreamMode('video')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  streamMode === 'video' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-300 hover:text-white'
                }`}
              >
                🎥 Video
              </button>
              <button
                type="button"
                onClick={() => setStreamMode('audio')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  streamMode === 'audio' ? 'bg-purple-600 text-white shadow' : 'text-zinc-300 hover:text-white'
                }`}
              >
                🎙️ Audio
              </button>
            </div>

            {/* Bottom Floating Glassmorphism Quick-Toggle Pills */}
            <div className="absolute bottom-3.5 inset-x-3.5 z-20 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mic Mute/Unmute + Real-Time Green Audio Level Visualizer Bar */}
                <button
                  type="button"
                  onClick={() => setIsMicEnabled((v) => !v)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full backdrop-blur-xl border text-xs font-bold transition-all shadow-lg ${
                    isMicEnabled
                      ? 'bg-zinc-950/75 border-emerald-500/40 text-white hover:bg-zinc-900/90'
                      : 'bg-rose-600/85 border-rose-400/50 text-white hover:bg-rose-600'
                  }`}
                >
                  {isMicEnabled ? (
                    <Mic className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <MicOff className="h-4 w-4 text-white shrink-0" />
                  )}
                  <span>{isMicEnabled ? 'Mic On' : 'Muted'}</span>
                  {/* Real-time 5-bar Green Audio Level Visualizer */}
                  <div className="flex items-end gap-[2.5px] h-4 pl-0.5" aria-hidden="true">
                    {audioLevels.map((lvl, idx) => (
                      <span
                        key={idx}
                        className={`w-[3px] rounded-full transition-all duration-75 ${
                          isMicEnabled ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-white/40'
                        }`}
                        style={{ height: `${Math.round(lvl * 16)}px` }}
                      />
                    ))}
                  </div>
                </button>

                {/* Camera On/Off Pill */}
                {streamMode === 'video' && (
                  <button
                    type="button"
                    onClick={() => setIsCameraEnabled((v) => !v)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-xl border text-xs font-bold transition-all shadow-lg ${
                      isCameraEnabled
                        ? 'bg-zinc-950/75 border-white/15 text-white hover:bg-zinc-900/90'
                        : 'bg-rose-600/85 border-rose-400/50 text-white hover:bg-rose-600'
                    }`}
                  >
                    {isCameraEnabled ? (
                      <Video className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <VideoOff className="h-4 w-4 text-white" />
                    )}
                    <span className="hidden sm:inline">{isCameraEnabled ? 'Cam On' : 'Cam Off'}</span>
                  </button>
                )}

                {/* Mirror / Flip Camera Pill */}
                {streamMode === 'video' && isCameraEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsMirrored((m) => !m)}
                    title="Mirror / Flip Camera"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-xl border text-xs font-bold transition-all shadow-lg ${
                      isMirrored
                        ? 'bg-indigo-600/35 border-indigo-400/40 text-indigo-200'
                        : 'bg-zinc-950/75 border-white/15 text-zinc-200 hover:bg-zinc-900/90'
                    }`}
                  >
                    <FlipHorizontal2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Mirror</span>
                  </button>
                )}
              </div>

              {/* Device Selector Toggle Pill */}
              <button
                type="button"
                onClick={() => setShowDeviceMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zinc-950/75 hover:bg-zinc-900/90 backdrop-blur-xl border border-white/15 text-xs font-bold text-zinc-200 shadow-lg transition-all"
              >
                <Settings2 className="h-4 w-4 text-cyan-400" />
                <span className="hidden sm:inline">Devices</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDeviceMenu ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 3-2-1 Animated Countdown Overlay */}
            <AnimatePresence>
              {countdown !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-6"
                >
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.45, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-7xl sm:text-8xl font-black bg-gradient-to-br from-rose-400 via-amber-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(244,63,94,0.65)]">
                      {countdown > 0 ? countdown : 'LIVE!'}
                    </span>
                    <p className="text-sm font-bold text-zinc-200 mt-2 tracking-wide uppercase">
                      {countdown > 0 ? 'Get Ready — Going On Air...' : 'Connecting Your Broadcast Room'}
                    </p>
                  </motion.div>

                  {countdown > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelCountdown}
                      className="mt-8 rounded-full border-white/25 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-5"
                    >
                      Cancel Countdown
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Expandable Camera & Microphone Device Selector Drawer */}
          <AnimatePresence>
            {showDeviceMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl bg-zinc-900/90 border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-xl"
              >
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-indigo-400" />
                    Camera Source
                  </label>
                  <select
                    value={selectedVideoDeviceId}
                    onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                    className="w-full h-10 rounded-xl bg-zinc-950 border border-white/15 px-3 text-xs font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {videoDevices.length === 0 ? (
                      <option value="">Default Camera</option>
                    ) : (
                      videoDevices.map((d, idx) => (
                        <option key={d.deviceId || idx} value={d.deviceId}>
                          {d.label || `Camera ${idx + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    Microphone Source
                  </label>
                  <select
                    value={selectedAudioDeviceId}
                    onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                    className="w-full h-10 rounded-xl bg-zinc-950 border border-white/15 px-3 text-xs font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {audioDevices.length === 0 ? (
                      <option value="">Default Microphone</option>
                    ) : (
                      audioDevices.map((d, idx) => (
                        <option key={d.deviceId || idx} value={d.deviceId}>
                          {d.label || `Microphone ${idx + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cover Thumbnail Card (Snapshot from Camera OR Custom Upload) */}
          <div className="rounded-2xl bg-zinc-900/75 border border-white/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-16 w-24 rounded-xl overflow-hidden bg-zinc-950 border border-white/15 shrink-0 flex items-center justify-center relative">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="Stream cover" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5 text-zinc-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Stream Cover Thumbnail</p>
                <p className="text-xs text-zinc-400 line-clamp-1">
                  {thumbnailPreview
                    ? 'Looking sharp! This cover will appear on Home & Explore feeds.'
                    : 'Snap a photo from your webcam or upload a custom cover.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCaptureSnapshot}
                disabled={streamMode !== 'video' || !isCameraEnabled}
                className="rounded-xl border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 text-xs font-bold gap-1.5"
              >
                <Camera className="h-3.5 w-3.5" />
                Snap Cover
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-bold gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
              />

              {thumbnailPreview && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setThumbnailPreview(null);
                    setThumbnailBlob(null);
                  }}
                  title="Clear thumbnail"
                  className="h-8 w-8 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* RIGHT / BOTTOM PANEL (5 COLS): STREAM DETAILS & HYPE CONTROLS      */}
        {/* ================================================================== */}
        <section className="lg:col-span-5 space-y-4">
          {/* Active Scheduled Stream Alert Banner (when starting a scheduled event) */}
          {activeScheduledStream && (
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600/25 via-fuchsia-600/20 to-rose-600/25 border border-indigo-400/40 p-4 shadow-xl flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/30 border border-indigo-300/40 flex items-center justify-center shrink-0">
                <BellRing className="h-4 w-4 text-indigo-200 animate-pulse" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-200">
                  Starting Scheduled Live
                </p>
                <p className="text-xs text-zinc-200 leading-relaxed">
                  Going live now will automatically send a push + in-app alert to{' '}
                  <span className="font-black text-white">
                    {activeScheduledStream.subscribersCount || 0}{' '}
                    {(activeScheduledStream.subscribersCount || 0) === 1 ? 'follower' : 'followers'}
                  </span>{' '}
                  who tapped Remind Me ({formatScheduledDateShort(toMillis(activeScheduledStream.scheduledFor))}).
                </p>
              </div>
            </div>
          )}

          {/* 1. Stream Title & Quick Topic/Category Tags */}
          <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="studio-stream-title" className="text-xs font-extrabold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Stream Title
                </label>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    streamTitle.length >= MAX_TITLE_LEN - 10 ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                >
                  {streamTitle.length}/{MAX_TITLE_LEN}
                </span>
              </div>

              <Input
                id="studio-stream-title"
                value={streamTitle}
                maxLength={MAX_TITLE_LEN}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Give your audience a reason to tap in..."
                className="h-12 rounded-xl bg-zinc-950/90 border-white/15 focus-visible:ring-indigo-500 text-base font-bold text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Quick Topic / Category Tags */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Quick Topic Tag
              </span>
              <div className="flex flex-wrap gap-2">
                {TOPIC_TAGS.map((tag) => {
                  const selected = streamCategory === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setStreamCategory(tag.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        selected
                          ? `bg-gradient-to-r ${tag.accent} text-white border-transparent shadow-lg scale-[1.02]`
                          : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span>{tag.emoji}</span>
                      <span>{tag.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Audience Visibility & Interactive Monetization Cards */}
          <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-5 space-y-4 shadow-xl">
            {/* Visibility Toggle */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Audience Visibility
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    visibility === 'public'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm'
                      : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <Globe className={`h-4 w-4 shrink-0 ${visibility === 'public' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <div>
                    <p className="text-xs font-bold">Public</p>
                    <p className="text-[10px] text-zinc-400">Discoverable globally</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('followers')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    visibility === 'followers'
                      ? 'bg-indigo-500/15 border-indigo-500/50 text-white shadow-sm'
                      : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <Users className={`h-4 w-4 shrink-0 ${visibility === 'followers' ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  <div>
                    <p className="text-xs font-bold">Followers Only</p>
                    <p className="text-[10px] text-zinc-400">Your close community</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Interactive & Monetization Toggles */}
            <div className="rounded-xl bg-zinc-950/60 border border-white/10 divide-y divide-white/10">
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare className="h-4 w-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Enable Live Chat</p>
                    <p className="text-[11px] text-zinc-400 truncate">Viewers can comment &amp; react in real time</p>
                  </div>
                </div>
                <Switch checked={allowChat} onCheckedChange={setAllowChat} />
              </div>

              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Gift className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Allow 3D Gifts &amp; Tips</p>
                    <p className="text-[11px] text-zinc-400 truncate">Earn Diamonds to your Lonkind Wallet</p>
                  </div>
                </div>
                <Switch checked={allowGifts} onCheckedChange={setAllowGifts} />
              </div>

              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserPlus className="h-4 w-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Co-Host Guest Requests</p>
                    <p className="text-[11px] text-zinc-400 truncate">Let viewers request to join your stage</p>
                  </div>
                </div>
                <Switch checked={allowCoHostRequests} onCheckedChange={setAllowCoHostRequests} />
              </div>
            </div>

            {/* Optional Creator Coin Goal */}
            <div className="rounded-xl bg-zinc-950/60 border border-white/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Target className="h-4 w-4 text-rose-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Stream Coin Goal</p>
                    <p className="text-[11px] text-zinc-400">Pin a live milestone bar for supporters</p>
                  </div>
                </div>
                <Switch checked={goalEnabled} onCheckedChange={setGoalEnabled} />
              </div>

              {goalEnabled && (
                <div className="pt-2 border-t border-white/10 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGoalType('COINS')}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        goalType === 'COINS'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-zinc-900 text-zinc-400 border-white/10'
                      }`}
                    >
                      🪙 Coins Goal
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoalType('LIKES')}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        goalType === 'LIKES'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-400'
                          : 'bg-zinc-900 text-zinc-400 border-white/10'
                      }`}
                    >
                      ❤️ Likes Goal
                    </button>
                  </div>
                  <Input
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="e.g., Sing a custom song or Unlock Q&A 🎯"
                    className="h-9 rounded-lg bg-zinc-900 border-white/15 text-xs text-white"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(goalType === 'LIKES' ? [100, 500, 1000, 2500, 5000] : [500, 1000, 2500, 5000, 10000]).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setGoalTarget(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          goalTarget === amt
                            ? 'bg-amber-400 text-black border-amber-300'
                            : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {amt.toLocaleString()} {goalType === 'LIKES' ? '❤️' : 'L'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Dual Launch Controls: "Go Live Now" + "Schedule for Later" */}
          <div className="space-y-3 pt-1">
            {/* Schedule for Later Expandable Panel (hidden if already starting a scheduled event) */}
            {!activeScheduledStream && (
              <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-3.5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                      <CalendarClock className="h-4 w-4 text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-white">Schedule for Later</p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        Announce ahead &amp; let followers tap Remind Me
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isScheduleMode ? 'secondary' : 'outline'}
                    onClick={() => setIsScheduleMode((prev) => !prev)}
                    className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 ${
                      isScheduleMode
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 border-transparent'
                        : 'bg-zinc-950/80 border-white/15 text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {isScheduleMode ? 'Hide Picker' : 'Pick Time'}
                  </Button>
                </div>

                {isScheduleMode && (
                  <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                    <Input
                      type="datetime-local"
                      value={scheduledForStr}
                      min={toLocalDateTimeInputValue(new Date())}
                      onChange={(e) => setScheduledForStr(e.target.value)}
                      className="h-10 rounded-xl bg-zinc-950 border-white/15 text-xs font-bold text-white [color-scheme:dark]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applySchedulePreset(0.5)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-indigo-600/25 border border-white/10 text-[11px] font-bold text-zinc-300"
                      >
                        In 30m
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset(2)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-indigo-600/25 border border-white/10 text-[11px] font-bold text-zinc-300"
                      >
                        In 2 Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset(0, 20)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-indigo-600/25 border border-white/10 text-[11px] font-bold text-zinc-300"
                      >
                        Tonight 8 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset(24)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-indigo-600/25 border border-white/10 text-[11px] font-bold text-zinc-300"
                      >
                        Tomorrow
                      </button>
                    </div>
                    <Button
                      type="button"
                      disabled={isScheduling || isLaunching || countdown !== null}
                      onClick={handleScheduleForLater}
                      className="w-full h-11 rounded-xl font-black text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:opacity-95 text-white shadow-lg"
                    >
                      {isScheduling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Publishing Schedule...
                        </>
                      ) : (
                        <>
                          <CalendarClock className="h-4 w-4 mr-2" />
                          Publish Scheduled Stream
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Optional Promote Live Stream Button (Self-Serve Coin Boost) */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromoteOpen(true)}
              className="w-full h-11 rounded-2xl border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs sm:text-sm gap-2"
            >
              <Megaphone className="h-4 w-4 text-amber-400" />
              Promote This Live Stream with Coins
            </Button>

            <PromoteDialog
              open={isPromoteOpen}
              onOpenChange={setIsPromoteOpen}
              target={{
                targetType: 'live',
                title: streamTitle.trim() || `${hostName} is going LIVE on Lonkind!`,
                description: `Join @${hostHandle || hostName} live now on Lonkind.`,
                mediaUrl: thumbnailPreview || activeScheduledStream?.coverUrl || hostAvatar || '',
                mediaType: 'image',
                publisherUid: hostUid,
                publisherName: hostName,
                publisherHandle: hostHandle || hostName,
                publisherAvatar: hostAvatar || '',
                userCoins: hostCoins,
              }}
              onPromoted={(_id, remaining) => setHostCoins(remaining)}
            />

            {/* Encouraging Glowing "Go Live Now" CTA Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              disabled={countdown !== null || isLaunching || isScheduling}
              onClick={handleStartCountdown}
              className="relative w-full h-14 rounded-2xl font-black text-base text-white shadow-[0_0_35px_rgba(244,63,94,0.45)] overflow-hidden disabled:opacity-60 transition-all group"
              style={{
                background:
                  'linear-gradient(135deg, #f43f5e 0%, #ec4899 45%, #6366f1 100%)',
              }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative z-10 flex items-center justify-center gap-2.5">
                {isLaunching ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>
                      {activeScheduledStream ? 'Notifying Followers & Going Live...' : 'Launching Live Room...'}
                    </span>
                  </>
                ) : countdown !== null ? (
                  <>
                    <Radio className="h-5 w-5 animate-ping" />
                    <span>Going Live in {countdown}...</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                    <span>{activeScheduledStream ? 'Start Scheduled Live Now' : 'Go Live Now'}</span>
                  </>
                )}
              </span>
            </motion.button>

            <p className="text-center text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                {activeScheduledStream
                  ? 'All Remind Me subscribers will be notified immediately when the countdown ends'
                  : 'Your community on Lonkind is ready — 3-2-1 countdown starts on tap'}
              </span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
