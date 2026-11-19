'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Scissors,
  Download,
  Upload,
  X,
  Play,
  Heart,
  Eye,
  Share2,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  Film,
  Radio,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export const CLIP_MAX_DURATION_SEC = 30;
const CHUNK_TIMESLICE_MS = 4000; // 4-second chunks for low memory & smooth flushing
const WINDOW_ROTATE_MS = 15000; // Staggered 15s overlap guarantees a header-intact 15-30s clip at any instant

export interface CapturedClipPayload {
  blob: Blob;
  url: string;
  durationSec: number;
  mimeType: string;
  extension: 'webm' | 'mp4';
}

export interface LiveClipDoc {
  id: string;
  clipId: string;
  hostId: string;
  hostName: string;
  hostHandle?: string;
  hostAvatar?: string;
  clippedByUid?: string;
  clippedByName?: string;
  caption: string;
  videoUrl: string;
  sourceStreamId: string;
  streamTitle?: string;
  durationSec?: number;
  likesCount: number;
  viewsCount: number;
  postId?: string | null;
  createdAt?: any;
}

interface RecorderSlot {
  recorder: MediaRecorder | null;
  chunks: Blob[];
  startedAt: number;
}

function pickSupportedRecorderMimeType(): { mimeType: string; extension: 'webm' | 'mp4' } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  const candidates: { mimeType: string; extension: 'webm' | 'mp4' }[] = [
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=h264,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];

  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) {
        return c;
      }
    } catch {
      // Ignore unsupported probe errors
    }
  }
  return { mimeType: '', extension: 'webm' };
}

/**
 * Lightweight 30-second rolling video buffer using staggered MediaRecorder slots.
 *
 * Why dual-staggered slots (15s offset, 30s max lifespan per slot)?
 * In WebM/MP4 containers, the first chunk contains the codec/EBML initialization header.
 * Rotating two overlapping slots every 15s keeps total RAM bounded (~3-6 MB) while
 * ensuring that at ANY instant after t=3s, there is a 100% header-intact, playable
 * video Blob covering the last 15-30 seconds without interrupting the live WebRTC stream.
 */
export function useRollingLiveClipBuffer(stream: MediaStream | null, enabled: boolean) {
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  const slotsRef = useRef<[RecorderSlot, RecorderSlot]>([
    { recorder: null, chunks: [], startedAt: 0 },
    { recorder: null, chunks: [], startedAt: 0 },
  ]);
  const mimeChoiceRef = useRef<{ mimeType: string; extension: 'webm' | 'mp4' }>({
    mimeType: 'video/webm',
    extension: 'webm',
  });
  const rotationTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const activeSlotIdxRef = useRef<0 | 1>(0);

  const stopSlot = useCallback((idx: 0 | 1) => {
    const slot = slotsRef.current[idx];
    if (slot.recorder) {
      try {
        slot.recorder.ondataavailable = null;
        slot.recorder.onerror = null;
        if (slot.recorder.state !== 'inactive') {
          slot.recorder.stop();
        }
      } catch {
        // Ignore stop errors on already-ended streams
      }
    }
    slot.recorder = null;
    slot.chunks = [];
    slot.startedAt = 0;
  }, []);

  const startSlot = useCallback(
    (idx: 0 | 1, mediaStream: MediaStream) => {
      stopSlot(idx);
      if (typeof MediaRecorder === 'undefined') return;

      const liveTracks = mediaStream.getTracks().filter((t) => t.readyState === 'live');
      if (liveTracks.length === 0) return;

      try {
        const chosen = mimeChoiceRef.current;
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 1_400_000,
          audioBitsPerSecond: 96_000,
        };
        if (chosen.mimeType) {
          options.mimeType = chosen.mimeType;
        }

        const recorder = new MediaRecorder(mediaStream, options);
        const slot: RecorderSlot = {
          recorder,
          chunks: [],
          startedAt: Date.now(),
        };

        recorder.ondataavailable = (ev: BlobEvent) => {
          if (ev.data && ev.data.size > 0) {
            slot.chunks.push(ev.data);
            // Defensive memory cap: never store more than ~36s of chunks per slot
            if (slot.chunks.length > 10) {
              // Keep chunk 0 (EBML header) + latest chunks if rotation was delayed
              slot.chunks = [slot.chunks[0], ...slot.chunks.slice(-8)];
            }
          }
        };

        recorder.onerror = () => {
          stopSlot(idx);
        };

        recorder.start(CHUNK_TIMESLICE_MS);
        slotsRef.current[idx] = slot;
      } catch (err) {
        console.warn('[LiveClipBuffer] MediaRecorder start warning:', err);
      }
    },
    [stopSlot]
  );

  const clearBuffer = useCallback(() => {
    if (rotationTimerRef.current) {
      window.clearInterval(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    stopSlot(0);
    stopSlot(1);
    setIsBuffering(false);
    setBufferedSeconds(0);
  }, [stopSlot]);

  useEffect(() => {
    if (!enabled || !stream || typeof MediaRecorder === 'undefined') {
      clearBuffer();
      return;
    }

    const liveTracks = stream.getTracks().filter((t) => t.readyState === 'live');
    if (liveTracks.length === 0) {
      clearBuffer();
      return;
    }

    mimeChoiceRef.current = pickSupportedRecorderMimeType();
    activeSlotIdxRef.current = 0;
    startSlot(0, stream);
    setIsBuffering(true);

    // Every 15 seconds, start/reset the alternate slot so one slot ALWAYS holds 15-30s of valid video
    rotationTimerRef.current = window.setInterval(() => {
      const nextIdx: 0 | 1 = activeSlotIdxRef.current === 0 ? 1 : 0;
      activeSlotIdxRef.current = nextIdx;
      startSlot(nextIdx, stream);
    }, WINDOW_ROTATE_MS);

    // Update UI indicator of buffered clip duration (0..30s)
    tickTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      const s0 = slotsRef.current[0];
      const s1 = slotsRef.current[1];
      const age0 = s0.startedAt > 0 ? (now - s0.startedAt) / 1000 : 0;
      const age1 = s1.startedAt > 0 ? (now - s1.startedAt) / 1000 : 0;
      const bestAge = Math.min(CLIP_MAX_DURATION_SEC, Math.floor(Math.max(age0, age1)));
      setBufferedSeconds(bestAge);
    }, 1000);

    return () => {
      clearBuffer();
    };
  }, [stream, enabled, startSlot, clearBuffer]);

  /**
   * Captures the last 15-30 seconds of the live broadcast as a playable Blob
   * without stopping or interrupting the live MediaStream.
   */
  const captureLast30Seconds = useCallback(async (): Promise<CapturedClipPayload | null> => {
    if (isCapturing) return null;

    const now = Date.now();
    const candidates = [slotsRef.current[0], slotsRef.current[1]]
      .filter((s) => s.recorder && s.startedAt > 0)
      .sort((a, b) => a.startedAt - b.startedAt); // oldest first (closest to 30s)

    if (candidates.length === 0) {
      toast({
        title: 'Buffering live stream...',
        description: 'Wait a few seconds while Lonkind buffers the live broadcast.',
      });
      return null;
    }

    // Pick the longest running slot that hasn't exceeded ~34s, otherwise newest slot
    const chosenSlot =
      candidates.find((s) => now - s.startedAt <= 34_000 && now - s.startedAt >= 2_000) ||
      candidates[candidates.length - 1];

    setIsCapturing(true);
    try {
      const rec = chosenSlot.recorder;
      // Flush the latest partial chunk cleanly without stopping recording
      if (rec && rec.state === 'recording') {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };
          const handleOnce = () => {
            rec.removeEventListener('dataavailable', handleOnce);
            finish();
          };
          rec.addEventListener('dataavailable', handleOnce);
          try {
            rec.requestData();
          } catch {
            rec.removeEventListener('dataavailable', handleOnce);
            finish();
          }
          window.setTimeout(() => {
            rec.removeEventListener('dataavailable', handleOnce);
            finish();
          }, 450);
        });
      }

      if (chosenSlot.chunks.length === 0) {
        toast({
          title: 'Clip still warming up',
          description: 'Give the broadcast 3–4 seconds and tap Clip again.',
        });
        return null;
      }

      const mimeType =
        chosenSlot.recorder?.mimeType ||
        mimeChoiceRef.current.mimeType ||
        'video/webm';
      const extension: 'webm' | 'mp4' = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob([...chosenSlot.chunks], { type: mimeType });

      if (blob.size < 1024) {
        toast({
          title: 'Clip too short',
          description: 'Wait a couple more seconds for video frames to buffer.',
        });
        return null;
      }

      const url = URL.createObjectURL(blob);
      const durationSec = Math.max(
        1,
        Math.min(CLIP_MAX_DURATION_SEC, Math.round((now - chosenSlot.startedAt) / 1000))
      );

      return {
        blob,
        url,
        durationSec,
        mimeType,
        extension,
      };
    } catch (err: any) {
      console.error('[LiveClipBuffer] Capture error:', err);
      toast({
        variant: 'destructive',
        title: 'Could not capture clip',
        description: err?.message || 'Please try tapping Clip again.',
      });
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  return {
    isBuffering,
    bufferedSeconds,
    isCapturing,
    captureLast30Seconds,
    clearBuffer,
  };
}

interface PublishClipModalProps {
  clip: CapturedClipPayload | null;
  onClose: () => void;
  sourceStreamId: string;
  streamTitle?: string;
  hostId: string;
  hostName: string;
  hostHandle?: string;
  hostAvatar?: string;
  clippedByUid: string;
  clippedByName: string;
}

/**
 * Compact, non-blocking dark-glassmorphic "Publish Highlight Clip" modal.
 * The live broadcast continues running uninterrupted behind this panel.
 */
export function PublishClipModal({
  clip,
  onClose,
  sourceStreamId,
  streamTitle,
  hostId,
  hostName,
  hostHandle,
  hostAvatar,
  clippedByUid,
  clippedByName,
}: PublishClipModalProps) {
  const [caption, setCaption] = useState('');
  const [shareToFeed, setShareToFeed] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (clip) {
      setCaption(
        streamTitle
          ? `Best moment from "${streamTitle}" 🔥`
          : `Live highlight from ${hostName}'s stream 🔥`
      );
      setUploadProgress(0);
      setIsUploading(false);
      setIsSuccess(false);
    }
  }, [clip, streamTitle, hostName]);

  const handleClose = () => {
    if (isUploading) return;
    if (clip?.url) {
      URL.revokeObjectURL(clip.url);
    }
    onClose();
  };

  const handleDownload = () => {
    if (!clip) return;
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = `lonkind-clip-${Date.now()}.${clip.extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast({
      title: '⬇️ Clip Downloaded',
      description: `Saved your ${clip.durationSec}s Lonkind highlight locally.`,
    });
  };

  const handlePublish = async () => {
    if (!clip || isUploading) return;

    const cleanCaption = caption.trim() || `Live highlight from ${hostName}'s broadcast 🔥`;
    const cleanHostId = hostId.replace(/^live_/, '');
    const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Upload strictly to the authenticated uploader's own Storage namespace (`clips/{userId}/...`)
    const uploaderUid = clippedByUid || cleanHostId;
    const storagePath = `clips/${uploaderUid}/${clipId}.${clip.extension}`;

    setIsUploading(true);
    setUploadProgress(4);

    try {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, clip.blob, {
        contentType: clip.mimeType || `video/${clip.extension}`,
      });

      const videoUrl: string = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = snapshot.totalBytes > 0
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 10;
            setUploadProgress(Math.max(5, pct));
          },
          (error) => reject(error),
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      const resolvedHandle =
        hostHandle || hostName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';

      let createdPostId: string | null = null;

      // Optionally also publish to main Home & Explore feed (`posts` collection) with `isLiveClip: true`
      if (shareToFeed) {
        const isHostClipping = uploaderUid === cleanHostId;
        const postDoc = await addDoc(collection(db, 'posts'), {
          author: {
            uid: uploaderUid,
            name: isHostClipping ? (hostName || 'Lonkind Creator') : (clippedByName || 'Lonkind Viewer'),
            handle: isHostClipping
              ? resolvedHandle
              : (clippedByName || 'viewer').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'viewer',
            avatarUrl: isHostClipping ? (hostAvatar || '') : '',
          },
          content: cleanCaption,
          videoUrl,
          isLiveClip: true,
          clipId,
          clipHostUid: cleanHostId,
          clipHostName: hostName || 'Lonkind Creator',
          sourceStreamId,
          clipDurationSec: clip.durationSec,
          clippedByName,
          reactions: {},
          comments: 0,
          hashtags: ['#liveclip', '#lonkindlive'],
          timestamp: serverTimestamp(),
        });
        createdPostId = postDoc.id;
      }

      // Save canonical highlight record in `clips/{clipId}`
      await setDoc(doc(db, 'clips', clipId), {
        clipId,
        hostId: cleanHostId,
        hostName: hostName || 'Lonkind Creator',
        hostHandle: resolvedHandle,
        hostAvatar: hostAvatar || '',
        clippedByUid,
        clippedByName,
        caption: cleanCaption,
        videoUrl,
        sourceStreamId,
        streamTitle: streamTitle || '',
        durationSec: clip.durationSec,
        mimeType: clip.mimeType,
        likesCount: 0,
        viewsCount: 0,
        postId: createdPostId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setUploadProgress(100);
      setIsSuccess(true);

      toast({
        title: '✂️ Highlight Clip Published!',
        description: shareToFeed
          ? 'Your Live Clip is now live on the Home/Explore feed and Profile Clips tab!'
          : 'Your Live Clip was saved to the Creator Profile Clips tab!',
      });

      window.setTimeout(() => {
        if (clip.url) URL.revokeObjectURL(clip.url);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('[PublishClipModal] Upload failed:', err);
      toast({
        variant: 'destructive',
        title: 'Clip upload failed',
        description: err?.message || 'Could not upload highlight clip. You can still download it locally.',
      });
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {clip && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[390px] z-[75] pointer-events-auto"
        >
          <div className="rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_70px_rgba(0,0,0,0.85)] overflow-hidden text-white">
            {/* Compact Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-950/60 via-zinc-950 to-fuchsia-950/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-7 w-7 rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
                  <Scissors className="h-3.5 w-3.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black tracking-tight truncate">
                    Publish Highlight Clip
                  </h3>
                  <p className="text-[10px] text-zinc-400 truncate">
                    Live stream continues uninterrupted behind this window
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleClose}
                className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video Preview */}
            <div className="p-3.5 space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video">
                <video
                  src={clip.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/90 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white shadow">
                  <Scissors className="h-2.5 w-2.5" />
                  LIVE CLIP • {clip.durationSec}s
                </span>
              </div>

              {/* Caption Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Clip Caption / Title
                </label>
                <Input
                  value={caption}
                  maxLength={160}
                  disabled={isUploading}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe this highlight moment..."
                  className="h-10 rounded-xl bg-zinc-900 border-white/15 text-xs font-semibold text-white placeholder:text-zinc-500"
                />
              </div>

              {/* Share to Main Feed Toggle */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white">Also post to Home &amp; Explore</p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    Displays with a LIVE CLIP badge in the main feed
                  </p>
                </div>
                <Switch
                  checked={shareToFeed}
                  disabled={isUploading}
                  onCheckedChange={setShareToFeed}
                />
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-indigo-300 flex items-center gap-1.5">
                      {isSuccess ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Published!</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Uploading highlight clip...</span>
                        </>
                      )}
                    </span>
                    <span className="font-mono text-zinc-300">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isSuccess
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500'
                      }`}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-5 gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading}
                  onClick={handleDownload}
                  className="col-span-2 h-10 rounded-xl bg-white/5 hover:bg-white/10 border-white/15 text-xs font-bold text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
                <Button
                  type="button"
                  disabled={isUploading}
                  onClick={handlePublish}
                  className="col-span-3 h-10 rounded-xl font-black text-xs text-white shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #6366f1 100%)',
                  }}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Post Highlight
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ProfileClipsTabProps {
  creatorUid: string;
  creatorName: string;
  currentUserUid?: string;
  isOwnProfile: boolean;
}

/**
 * Creator Profile "Clips" Tab — lets visitors binge-watch a creator's saved Live Clips.
 */
export function ProfileClipsTab({
  creatorUid,
  creatorName,
  currentUserUid,
  isOwnProfile,
}: ProfileClipsTabProps) {
  const [clips, setClips] = useState<LiveClipDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeClip, setActiveClip] = useState<LiveClipDoc | null>(null);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const viewedSessionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!creatorUid) return;
    setIsLoading(true);

    const q = query(collection(db, 'clips'), where('hostId', '==', creatorUid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveClipDoc, 'id'>) }))
          .sort((a, b) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return tB - tA;
          });
        setClips(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[ProfileClipsTab] Snapshot notice:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [creatorUid]);

  const handleOpenClip = (clip: LiveClipDoc) => {
    setActiveClip(clip);
    if (!viewedSessionRef.current.has(clip.id)) {
      viewedSessionRef.current.add(clip.id);
      updateDoc(doc(db, 'clips', clip.id), {
        viewsCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const handleLikeClip = async (clip: LiveClipDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserUid) {
      toast({ title: 'Sign in to like clips' });
      return;
    }
    const alreadyLiked = Boolean(likedIds[clip.id]);
    setLikedIds((prev) => ({ ...prev, [clip.id]: !alreadyLiked }));
    try {
      await updateDoc(doc(db, 'clips', clip.id), {
        likesCount: increment(alreadyLiked ? -1 : 1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setLikedIds((prev) => ({ ...prev, [clip.id]: alreadyLiked }));
    }
  };

  const handleDeleteClip = async (clip: LiveClipDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'clips', clip.id));
      if (clip.postId) {
        await deleteDoc(doc(db, 'posts', clip.postId)).catch(() => {});
      }
      if (activeClip?.id === clip.id) setActiveClip(null);
      toast({ title: 'Clip deleted' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not delete clip', description: err?.message });
    }
  };

  const handleShareClip = async (clip: LiveClipDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(clip.videoUrl);
      toast({ title: 'Clip link copied!', description: 'Ready to share anywhere.' });
    } catch {
      toast({ title: 'Share Clip', description: clip.caption });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        <span>Loading live clips...</span>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="rounded-3xl bg-slate-950/70 border border-white/10 p-10 text-center space-y-2.5">
        <div className="h-12 w-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto">
          <Scissors className="h-6 w-6 text-rose-400" />
        </div>
        <h3 className="text-base font-extrabold text-white">No Live Clips Yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          {isOwnProfile
            ? 'Tap the ✂️ Clip button during any Live Stream to capture the last 30 seconds and showcase your best highlights here.'
            : `${creatorName} hasn't published any live stream highlight clips yet.`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip) => {
          const isLiked = Boolean(likedIds[clip.id]);
          const timeLabel = clip.createdAt?.toDate
            ? formatDistanceToNow(clip.createdAt.toDate(), { addSuffix: true })
            : 'Just now';

          return (
            <article
              key={clip.id}
              onClick={() => handleOpenClip(clip)}
              className="group cursor-pointer rounded-2xl overflow-hidden bg-zinc-950/90 border border-white/10 hover:border-rose-500/45 transition-all duration-300 shadow-lg hover:shadow-rose-500/10 flex flex-col"
            >
              <div className="relative aspect-video bg-black overflow-hidden">
                <video
                  src={clip.videoUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                {/* LIVE CLIP Badge */}
                <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/90 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white shadow">
                  <Scissors className="h-2.5 w-2.5" />
                  LIVE CLIP
                </span>

                {/* Duration Pill */}
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-mono font-bold text-white">
                  {clip.durationSec || 30}s
                </span>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-11 w-11 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-rose-600/90 transition-all shadow-xl">
                    <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                  </div>
                </div>

                {/* Bottom Stats Overlay */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white/90">
                  <span className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    <Eye className="h-3 w-3 text-indigo-300" />
                    {(clip.viewsCount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-300">{timeLabel}</span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                  {clip.caption}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleLikeClip(clip, e)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        isLiked
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{(clip.likesCount || 0) + (isLiked ? 1 : 0)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleShareClip(clip, e)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] font-bold transition-colors"
                      title="Copy clip link"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClip(clip, e)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                      title="Delete clip"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Binge-Watch Clip Lightbox Dialog */}
      <Dialog open={Boolean(activeClip)} onOpenChange={(open) => !open && setActiveClip(null)}>
        <DialogContent className="sm:max-w-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/15 text-white rounded-3xl p-4 sm:p-5">
          {activeClip && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-black">
                  <Badge className="bg-rose-600 text-white border-none text-[10px] font-black uppercase">
                    ✂️ LIVE CLIP
                  </Badge>
                  <span className="truncate">{activeClip.caption}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video mt-2">
                <video
                  key={activeClip.id}
                  src={activeClip.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-7 w-7 border border-white/20">
                    <AvatarImage src={activeClip.hostAvatar} alt={activeClip.hostName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                      {activeClip.hostName?.charAt(0) || 'L'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{activeClip.hostName}</p>
                    {activeClip.clippedByName && (
                      <p className="text-[10px] text-zinc-400 truncate">
                        Clipped by {activeClip.clippedByName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-200 font-bold">
                    <Eye className="h-3.5 w-3.5 text-indigo-400" />
                    {(activeClip.viewsCount || 0).toLocaleString()}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleLikeClip(activeClip, e)}
                    className="h-8 rounded-xl bg-white/5 border-white/15 text-xs font-bold text-white hover:bg-rose-500/20"
                  >
                    <Heart
                      className={`h-3.5 w-3.5 mr-1 ${
                        likedIds[activeClip.id] ? 'fill-rose-500 text-rose-500' : ''
                      }`}
                    />
                    {(activeClip.likesCount || 0) + (likedIds[activeClip.id] ? 1 : 0)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
