'use client';

import { useEffect, useRef, useState } from 'react';
import { getLiveRoomId } from '@/lib/zego';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, doc, setDoc, updateDoc, deleteDoc, getDocs, increment } from 'firebase/firestore';
import { Send, MessageSquare, Gift, X, Sparkles, Eye, Power, Loader2, Heart, Video, VideoOff, Mic, MicOff, Radio, Flame, Music, Gamepad2, Check, Layers, Trophy, Target, Pin, PinOff, Crown, RefreshCw, Volume2, VolumeX, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import KingLionGift from './gifts/KingLionGift';
import GoldenLionSvgGift, { GoldenLionSvgPreview } from './gifts/GoldenLionSvgGift';
import RoyalCrownSvgGift, { RoyalCrownSvgPreview } from './gifts/RoyalCrownSvgGift';
import UniverseGift from './gifts/UniverseGift';
import GiftTakeoverEngine, { GiftTakeoverEvent } from './gifts/GiftTakeoverEngine';
import SvgaLottieVectorCard from './gifts/SvgaLottieVectorCard';
import { useGiftQueueManager } from '@/lib/gift-queue-manager';
import { useGiftTapBatcherAndOutbox } from '@/lib/gift-batch-outbox';

const FREE_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

interface LiveMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type?: 'text' | 'gift';
  giftIcon?: string;
  giftName?: string;
  vipLevel?: number;
  vipBadge?: string;
  createdAtMs?: number;
  timestamp: any;
}

export function getVipTier(coins: number) {
  if (coins >= 100000) {
    return {
      level: 10,
      title: 'ROYAL EMPEROR',
      badge: '👑 VIP 10',
      vehicle: 'Golden Lion',
      videoUrl: '',
      color: 'from-amber-400 via-red-500 to-yellow-500',
    };
  }
  if (coins >= 20000) {
    return {
      level: 8,
      title: 'ROYAL DUKE',
      badge: '👑 VIP 8',
      vehicle: 'Royal Crown',
      videoUrl: '',
      color: 'from-purple-500 via-indigo-500 to-pink-500',
    };
  }
  if (coins >= 5000) {
    return {
      level: 5,
      title: 'STAR COMMANDER',
      badge: '✨ VIP 5',
      vehicle: 'Starlight',
      videoUrl: '',
      color: 'from-cyan-400 to-blue-600',
    };
  }
  if (coins >= 1000) {
    return {
      level: 3,
      title: 'DIAMOND NOBLE',
      badge: '💎 VIP 3',
      vehicle: 'Diamond Radiance',
      videoUrl: '',
      color: 'from-indigo-400 to-purple-600',
    };
  }
  return {
    level: 0,
    title: '',
    badge: '',
    vehicle: '',
    videoUrl: '',
    color: '',
  };
}

export const PK_PENALTIES = [
  '💪 Do 10 Pushups Live on Camera!',
  '🎤 Sing a 30-Second Song Acapella!',
  '💃 Freestyle Dance for 30 Seconds!',
  '👑 Give a Royal Shoutout to Top 3 Gifters!',
  '🤪 Hold a Funny Face for 20 Seconds!',
  '💧 Chug a Full Glass of Water in 10 Seconds!',
];

interface FloatingGift {
  id: string;
  icon: string;
  name: string;
  senderName: string;
  xPercent: number;
}

interface FloatingLike {
  id: string;
  xPercent: number;
  emoji: string;
}

export const GIFT_CATALOG: Array<{
  id: string;
  name: string;
  icon: string;
  price: number;
  color: string;
  isSuper?: boolean;
  image3d?: string;
  previewGifUrl?: string;
  videoUrl: string;
  webmUrl?: string;
  lottieUrl?: string;
  badgeTag?: string;
}> = [
  {
    id: 'rose',
    name: 'Rose',
    icon: '🌹',
    price: 10,
    color: 'from-rose-500 to-pink-600',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'heart',
    name: 'Finger Heart',
    icon: '🫰',
    price: 25,
    color: 'from-pink-500 to-rose-500',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'perfume',
    name: 'Luxury Perfume',
    icon: '🌸',
    price: 100,
    color: 'from-fuchsia-500 to-purple-600',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'ring',
    name: 'Gold Ring',
    icon: '💍',
    price: 500,
    color: 'from-amber-400 to-yellow-600',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'diamond',
    name: 'Diamond Radiance',
    icon: '💎',
    price: 1000,
    color: 'from-cyan-400 to-blue-600',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'crown',
    name: 'Royal Crown',
    icon: '👑',
    price: 2500,
    color: 'from-yellow-400 via-amber-500 to-orange-500',
    isSuper: true,
    videoUrl: '',
    badgeTag: 'ROYAL',
  },
  {
    id: 'car',
    name: 'Neon Supercar',
    icon: '🏎️',
    price: 5000,
    color: 'from-indigo-500 via-purple-600 to-pink-500',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'rocket',
    name: 'Space Rocket',
    icon: '🚀',
    price: 10000,
    color: 'from-blue-500 via-indigo-600 to-violet-600',
    isSuper: false,
    videoUrl: '',
  },
  {
    id: 'lion',
    name: 'Golden Lion',
    icon: '🦁',
    price: 20000,
    color: 'from-amber-500 via-orange-600 to-yellow-500',
    isSuper: true,
    videoUrl: '',
    badgeTag: 'TOP TIER',
  },
];

interface LiveStreamViewProps {
  hostUid: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isHost: boolean;
  onLeave: () => void;
  userCoins?: number;
  onGoToWallet?: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

export function playLonkindSoundEffect(type: 'applause' | 'cheer' | 'airhorn' | 'fanfare' | 'bell' | 'dragon_roar') {
  if (typeof window === 'undefined') return;
  try {
    if (type === 'dragon_roar') {
      try {
        const realRoar = new Audio('/gifts/audio/dragon-roar.mp3');
        realRoar.volume = 0.92;
        realRoar.play().catch(() => {});
      } catch (_) {}
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'dragon_roar') {
      // Ferocious, multi-layer resonant dragon roar audio synthesis
      const oscLow = ctx.createOscillator();
      const oscMid = ctx.createOscillator();
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      // Deep sub-bass sweep
      oscLow.type = 'sawtooth';
      oscLow.frequency.setValueAtTime(65, ctx.currentTime);
      oscLow.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.3);
      oscLow.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 1.8);

      // Guttural mid-frequency roar
      oscMid.type = 'triangle';
      oscMid.frequency.setValueAtTime(160, ctx.currentTime);
      oscMid.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.4);
      oscMid.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 1.8);

      // Fire throat turbulent breath noise
      const bufferSize = ctx.sampleRate * 1.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noise.buffer = buffer;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
      filter.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 1.8);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.9);

      oscLow.connect(gain);
      oscMid.connect(gain);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      oscLow.start();
      oscMid.start();
      noise.start();

      oscLow.stop(ctx.currentTime + 1.9);
      oscMid.stop(ctx.currentTime + 1.9);
      noise.stop(ctx.currentTime + 1.9);
      return;
    }

    if (type === 'airhorn') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(466, ctx.currentTime);
      osc2.frequency.setValueAtTime(470, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(370, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    } else if (type === 'bell' || type === 'fanfare') {
      const freqs = type === 'bell' ? [523.25, 659.25, 783.99] : [440, 554.37, 659.25, 880];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.6);
      });
    } else {
      const bufferSize = ctx.sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 1.5);
    }
  } catch (e) {
    console.warn('Audio synth error:', e);
  }
}

export default function LiveStreamView(props: LiveStreamViewProps) {
  return <LiveStreamViewInner {...props} />;
}

function LiveStreamViewInner({
  hostUid,
  userId,
  userName,
  userAvatar,
  isHost,
  onLeave,
  userCoins: initialCoins = 0,
  onGoToWallet,
  isGuest = false,
  onRequireAuth,
}: LiveStreamViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const roomId = getLiveRoomId(hostUid || userId || 'default_host');
  const validUserId = userId || `guest_${Math.floor(100000 + Math.random() * 900000)}`;
  const validUserName = userName || 'Guest Viewer';

  const handleShareLiveStream = async () => {
    const cleanHostId = (hostUid || validUserId).replace(/^live_/, '');
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://impactful-ideas.web.app'}/?live=${cleanHostId}`;
    const shareTitle = `🔴 Watch ${isHost ? validUserName : (streamHostInfo?.name || 'Live Stream')} LIVE on Lonkind!`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `${shareTitle} — Tap to watch live!`,
          url: shareUrl,
        });
        return;
      }
    } catch (_) {}

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: '🔗 Live Stream Link Copied!',
        description: 'Share this link on WhatsApp, TikTok, or X — anyone can watch instantly!',
      });
    } catch (_) {
      toast({
        title: 'Share Link Ready',
        description: shareUrl,
      });
    }
  };

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [rechargeModalGift, setRechargeModalGift] = useState<typeof GIFT_CATALOG[0] | null>(null);
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const [floatingLikes, setFloatingLikes] = useState<FloatingLike[]>([]);
  const [viewerCount, setViewerCount] = useState(1);
  const [userCoins, setUserCoins] = useState(initialCoins);
  const [entranceBanner, setEntranceBanner] = useState<{ name: string; avatarUrl?: string } | null>(null);
  const [isCoHostRequested, setIsCoHostRequested] = useState(false);
  const [isCoHostAccepted, setIsCoHostAccepted] = useState(false);
  const [coHostRequests, setCoHostRequests] = useState<Array<{ id: string; uid: string; name: string; avatarUrl?: string; status: string }>>([]);
  const [isHostRequestsModalOpen, setIsHostRequestsModalOpen] = useState(false);

  // User Choice Pre-Live Studio State
  const [hasStartedLive, setHasStartedLive] = useState(!isHost);
  const [streamTitle, setStreamTitle] = useState(`${validUserName}'s Live Stream ✨`);
  const [streamCategory, setStreamCategory] = useState<'chat' | 'music' | 'gaming' | 'creative' | 'lifestyle'>('chat');
  const [streamMode, setStreamMode] = useState<'video' | 'audio'>('video');
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // High-Impact Gifting Moments State
  const [giftCombo, setGiftCombo] = useState<{ giftId: string; count: number }>({ giftId: '', count: 1 });
  const comboTimerRef = useRef<any>(null);
  const [vipBanner, setVipBanner] = useState<{
    senderName: string;
    senderAvatar?: string;
    giftName: string;
    giftIcon: string;
    combo: number;
    price: number;
  } | null>(null);
  const [activeCenterGift, setActiveCenterGift] = useState<{
    gift: typeof GIFT_CATALOG[0];
    senderName: string;
    combo: number;
  } | null>(null);
  const [activeKingLionGift, setActiveKingLionGift] = useState<{
    senderName: string;
    senderAvatar?: string;
    combo: number;
  } | null>(null);
  const [activeUniverseGift, setActiveUniverseGift] = useState<{
    senderName: string;
    senderAvatar?: string;
    combo: number;
  } | null>(null);
  const [customTakeoverEvent, setCustomTakeoverEvent] = useState<GiftTakeoverEvent | null>(null);
  const [showCustomAssetPanel, setShowCustomAssetPanel] = useState(false);
  const [customWebmUrl, setCustomWebmUrl] = useState('');
  const [customLottieUrl, setCustomLottieUrl] = useState('');
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const sessionStartedAtMsRef = useRef<number>(Date.now());

  // TikTok-Scale Frontend Gift Queue, Combo Coalescer & Kafka Broker Telemetry
  const {
    activeGift: queuedActiveGift,
    queuedGifts,
    sideComboSlots,
    brokerStats,
    enqueueGift,
    completeActiveGift,
    resetGiftQueue,
    simulateSimultaneousBurst,
  } = useGiftQueueManager(roomId);

  // Top Gifters & Contributor Leaderboard State (Powered by Redis Sorted Sets: ZINCRBY / ZREVRANGE)
  const [contributors, setContributors] = useState<Array<{
    rank?: number;
    uid: string;
    name: string;
    avatarUrl?: string;
    totalCoins: number;
    lastGiftName?: string;
    lastGiftIcon?: string;
    lastGiftAt?: any;
  }>>([]);
  const [redisTelemetry, setRedisTelemetry] = useState<{
    redisKey: string;
    lastWriteCommand: string;
    top3ReadCommand: string;
    roomZincrbyOps: number;
    roomZrevrangeOps: number;
    primaryDbQueries: number;
    readLatencyMs: number;
    recentCommands: Array<{ id: string; command: string; latencyMs: number; timestampMs: number }>;
  }>({
    redisKey: `stream:leaderboard:${roomId}`,
    lastWriteCommand: `ZINCRBY stream:leaderboard:${roomId} 100 "Alice"`,
    top3ReadCommand: `ZREVRANGE stream:leaderboard:${roomId} 0 2 WITHSCORES`,
    roomZincrbyOps: 0,
    roomZrevrangeOps: 0,
    primaryDbQueries: 0,
    readLatencyMs: 0.02,
    recentCommands: [],
  });
  const [isContributorsModalOpen, setIsContributorsModalOpen] = useState(false);
  const [leaderboardBanner, setLeaderboardBanner] = useState<{ name: string; avatarUrl?: string; coins: number } | null>(null);
  const prevLeaderUidRef = useRef<string | null>(null);

  // Creator Stream Goal State
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalTitle, setGoalTitle] = useState('Community Goal 🎯');
  const [goalTarget, setGoalTarget] = useState(1000);
  const [streamGoal, setStreamGoal] = useState<{
    enabled: boolean;
    title: string;
    targetCoins: number;
    currentCoins: number;
    achieved?: boolean;
  } | null>(null);
  const [hasCelebratedGoal, setHasCelebratedGoal] = useState(false);

  // Pinned Notice / Announcement State
  const [pinnedComment, setPinnedComment] = useState<{
    text: string;
    senderName: string;
    pinnedAt?: any;
  } | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInputText, setPinInputText] = useState('');
  const [isEndConfirmModalOpen, setIsEndConfirmModalOpen] = useState(false);

  // Native WebRTC Live Streaming State & Refs ($0/month, Zero Third-Party Expiration)
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const hasJoinedRoomRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const coHostVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const coHostLocalStreamRef = useRef<MediaStream | null>(null);
  const hostPeersRef = useRef<Map<string, { pc: RTCPeerConnection; offerId: string; addedCandCount: number }>>(new Map());
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [hasRemoteStream, setHasRemoteStream] = useState<boolean>(false);
  const [hasCoHostStream, setHasCoHostStream] = useState<boolean>(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState<boolean>(false);

  // Lonkind 1v1 PK Battle State + 2X Final Minute Booster + Penalty Spin Wheel
  const [pkBattleScore, setPkBattleScore] = useState<{ host1Score: number; host2Score: number; active: boolean }>({
    host1Score: 0,
    host2Score: 0,
    active: false,
  });
  const [pkTimeLeft, setPkTimeLeft] = useState<number>(180); // 3:00 PK Battle round
  const [isPkModalOpen, setIsPkModalOpen] = useState<boolean>(false);
  const [pkWheelSpinning, setPkWheelSpinning] = useState<boolean>(false);
  const [selectedPenalty, setSelectedPenalty] = useState<string | null>(null);
  const isPkBoosterActive = pkBattleScore.active && pkTimeLeft > 0 && pkTimeLeft <= 60;

  // VIP Gifter Level & Luxury Entrance HD Video State
  const userVipTier = getVipTier(userCoins);
  const [vipEntranceBanner, setVipEntranceBanner] = useState<{
    name: string;
    avatarUrl?: string;
    badge: string;
    title: string;
    vehicle: string;
    videoUrl: string;
    color: string;
  } | null>(null);

  // Live Stream Treasure Chest ("Lucky Coin Drop") State
  const [treasureChest, setTreasureChest] = useState<{
    id: string;
    senderName: string;
    unlockAtMs: number;
    expiresAtMs: number;
    rewardPool: number;
  } | null>(null);
  const [treasureCountdown, setTreasureCountdown] = useState<number>(0);
  const [claimedChestId, setClaimedChestId] = useState<string | null>(null);

  // Lonkind Video AR Filter & Sound Effects State
  const [activeFilter, setActiveFilter] = useState<'normal' | 'sparkles' | 'warm' | 'neon' | 'vintage' | 'golden'>('normal');
  const [streamHostInfo, setStreamHostInfo] = useState<{ name: string; avatar?: string; uid: string } | null>(null);

  // Admin Platform Event & Free Event Gift + AI 3D Gift Video Overrides
  const [activePlatformEvent, setActivePlatformEvent] = useState<{
    eventActive: boolean;
    eventTitle: string;
    eventBannerText: string;
    freeGiftId: string | null;
    freeGiftDailyLimit: number;
  } | null>(null);
  const [freeEventGiftSentCount, setFreeEventGiftSentCount] = useState<number>(0);
  const [giftOverrides, setGiftOverrides] = useState<Record<string, { videoUrl?: string; previewGifUrl?: string }>>({});

  useEffect(() => {
    const unsubEvents = onSnapshot(doc(db, 'platform_settings', 'events'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setActivePlatformEvent({
          eventActive: Boolean(d.eventActive),
          eventTitle: d.eventTitle || 'Special Event',
          eventBannerText: d.eventBannerText || '',
          freeGiftId: d.freeGiftId || null,
          freeGiftDailyLimit: Number(d.freeGiftDailyLimit) || 3,
        });
      }
    });
    const unsubOverrides = onSnapshot(doc(db, 'platform_settings', 'gift_overrides'), (snap) => {
      if (snap.exists()) {
        setGiftOverrides(snap.data() || {});
      }
    });
    return () => {
      unsubEvents();
      unsubOverrides();
    };
  }, []);

  // PK Battle 1-Second Countdown Timer & Treasure Chest Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setPkTimeLeft((prev) => {
        if (!pkBattleScore.active) return prev;
        if (prev <= 1) {
          return 180; // Auto-start next 3-minute PK round after completion
        }
        return prev - 1;
      });

      if (treasureChest) {
        const now = Date.now();
        if (now >= treasureChest.expiresAtMs) {
          setTreasureChest(null);
        } else {
          const secsToUnlock = Math.max(0, Math.ceil((treasureChest.unlockAtMs - now) / 1000));
          setTreasureCountdown(secsToUnlock);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pkBattleScore.active, treasureChest]);

  const handleSpinPenaltyWheel = () => {
    if (pkWheelSpinning) return;
    setPkWheelSpinning(true);
    setSelectedPenalty(null);
    playLonkindSoundEffect('cheer');
    setTimeout(() => {
      const winnerPenalty = PK_PENALTIES[Math.floor(Math.random() * PK_PENALTIES.length)];
      setSelectedPenalty(winnerPenalty);
      setPkWheelSpinning(false);
      playLonkindSoundEffect('fanfare');
      try {
        confetti({
          particleCount: 100,
          spread: 90,
          origin: { y: 0.5 },
        });
      } catch (_) {}
    }, 2200);
  };

  const handleClaimTreasureChest = async () => {
    if (isGuest) {
      toast({
        title: '🎁 Sign Up to Claim Lucky Chest',
        description: 'Create an account to claim rewards and send gifts!',
      });
      onRequireAuth?.();
      return;
    }
    if (!treasureChest || claimedChestId === treasureChest.id || treasureCountdown > 0) return;
    setClaimedChestId(treasureChest.id);

    playLonkindSoundEffect('fanfare');
    try {
      confetti({
        particleCount: 110,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#fef08a', '#10b981'],
      });
    } catch (_) {}

    toast({
      title: `🎁 Lucky Chest Celebrated!`,
      description: `You celebrated @${treasureChest.senderName}'s Super Gift drop!`,
    });
  };

  // Listen to live stream document for real-time host info, stream goal, pinned comment, and treasure chest
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'live_streams', roomId);
    const unsub = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (typeof data.sessionStartedAtMs === 'number') {
          sessionStartedAtMsRef.current = data.sessionStartedAtMs;
        }
        if (data.hostName) {
          setStreamHostInfo({
            name: data.hostName,
            avatar: data.hostAvatar,
            uid: data.hostUid,
          });
        }
        if (data.streamGoal) {
          setStreamGoal(data.streamGoal);
          // Check if goal was newly achieved
          if (data.streamGoal.enabled && data.streamGoal.currentCoins >= data.streamGoal.targetCoins && !hasCelebratedGoal) {
            setHasCelebratedGoal(true);
            playLonkindSoundEffect('fanfare');
            try {
              confetti({
                particleCount: 140,
                spread: 100,
                origin: { y: 0.45 },
                colors: ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#ffffff'],
              });
            } catch (_) {}
          }
        } else {
          setStreamGoal(null);
        }
        if (data.pinnedComment !== undefined) {
          setPinnedComment(data.pinnedComment);
        }
        if (data.treasureChest && data.treasureChest.expiresAtMs > Date.now()) {
          setTreasureChest(data.treasureChest);
        }
      }
    });
    return () => unsub();
  }, [roomId, hasCelebratedGoal]);

  // 1. REAL REAL-TIME FIRESTORE VIEWER TRACKING & STREAM REGISTRATION
  useEffect(() => {
    if (!roomId || !validUserId) return;
    if (isHost && !hasStartedLive) return;

    const viewerRef = doc(db, 'live_streams', roomId, 'viewers', validUserId);
    const roomRef = doc(db, 'live_streams', roomId);
    const actualHostUid = (hostUid || validUserId).replace(/^live_/, '');
    const currentVip = getVipTier(userCoins);

    // Register active viewer entry in Firestore (including VIP level & vehicle)
    setDoc(viewerRef, {
      uid: validUserId,
      name: validUserName,
      avatarUrl: userAvatar || '',
      vipLevel: currentVip.level,
      vipBadge: currentVip.badge,
      vipTitle: currentVip.title,
      vipVehicle: currentVip.vehicle,
      vipVideoUrl: currentVip.videoUrl,
      vipColor: currentVip.color,
      joinedAt: serverTimestamp(),
    }, { merge: true }).catch(console.error);

    // Trigger Luxury VIP Entrance Banner for VIP users upon joining
    if (currentVip.level >= 3) {
      setVipEntranceBanner({
        name: validUserName,
        avatarUrl: userAvatar,
        badge: currentVip.badge,
        title: currentVip.title,
        vehicle: currentVip.vehicle,
        videoUrl: currentVip.videoUrl,
        color: currentVip.color,
      });
      playLonkindSoundEffect('fanfare');
      setTimeout(() => setVipEntranceBanner(null), 5000);
    }

    // Update stream status to active if host & wipe old chat/gift messages from any previous live session
    if (isHost) {
      const freshSessionMs = Date.now();
      sessionStartedAtMsRef.current = freshSessionMs;
      resetGiftQueue();
      setMessages([]);
      setVipBanner(null);

      // Server-side batch wipe of any leftover chat/gift messages via Admin SDK
      auth.currentUser?.getIdToken().then((token) => {
        if (!token) return;
        fetch('/api/live/clean-room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roomId }),
        }).catch(() => {});
      }).catch(() => {});

      const chatCol = collection(db, 'live_streams', roomId, 'chat');
      getDocs(chatCol)
        .then((snap) => {
          snap.docs.forEach((d) => {
            deleteDoc(d.ref).catch(() => {});
          });
        })
        .catch(() => {});

      setDoc(roomRef, {
        id: roomId,
        status: 'active',
        hostUid: actualHostUid,
        hostName: validUserName,
        hostAvatar: userAvatar || '',
        streamTitle: streamTitle || `${validUserName}'s Live Stream`,
        category: streamCategory,
        streamMode: streamMode,
        viewerCount: 1,
        sessionStartedAtMs: freshSessionMs,
        pinnedComment: null,
        treasureChest: null,
        streamGoal: goalEnabled ? {
          enabled: true,
          title: goalTitle || 'Community Goal 🎯',
          targetCoins: Number(goalTarget) || 1000,
          currentCoins: 0,
          achieved: false,
        } : null,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(console.error);

      // Mark host user profile as live for entire app
      updateDoc(doc(db, 'users', validUserId), {
        isLive: true,
        liveRoomId: roomId,
        liveStartedAt: serverTimestamp(),
      }).catch(() => {});
    }

    // Keep active stream heartbeat alive every 30s
    let heartbeatTimer: any = null;
    if (isHost) {
      heartbeatTimer = setInterval(() => {
        updateDoc(roomRef, { updatedAt: serverTimestamp() }).catch(() => {});
      }, 30000);
    }

    // Clean up when user closes browser, tab, or navigates away
    const handleBeforeUnload = () => {
      deleteDoc(viewerRef).catch(() => {});
      if (isHost && hasStartedLive) {
        setDoc(roomRef, { status: 'ended', endedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        updateDoc(doc(db, 'users', validUserId), { isLive: false, liveRoomId: null }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      deleteDoc(viewerRef).catch(console.error);
      if (isHost && hasStartedLive && hasJoinedRoomRef.current) {
        setDoc(roomRef, { status: 'ended', endedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        updateDoc(doc(db, 'users', validUserId), { isLive: false, liveRoomId: null }).catch(() => {});
      }
    };
  }, [roomId, validUserId, validUserName, userAvatar, isHost, hostUid, hasStartedLive, streamTitle, streamCategory, streamMode, goalEnabled, goalTitle, goalTarget]);

  // 2. REAL-TIME VIEWERS COUNT & VIP / STANDARD ENTRANCE BANNER LISTENER
  useEffect(() => {
    if (!roomId) return;
    const viewersCol = collection(db, 'live_streams', roomId, 'viewers');

    const unsubscribe = onSnapshot(viewersCol, (snapshot) => {
      setViewerCount(Math.max(1, snapshot.size));

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && change.doc.id !== validUserId) {
          const data = change.doc.data();
          if (data.name) {
            if (data.vipLevel && data.vipLevel >= 3 && data.vipVideoUrl) {
              setVipEntranceBanner({
                name: data.name,
                avatarUrl: data.avatarUrl,
                badge: data.vipBadge || '👑 VIP',
                title: data.vipTitle || 'ROYAL VIP',
                vehicle: data.vipVehicle || 'Luxury Supercar',
                videoUrl: data.vipVideoUrl,
                color: data.vipColor || 'from-amber-400 via-red-500 to-yellow-500',
              });
              playLonkindSoundEffect('fanfare');
              setTimeout(() => setVipEntranceBanner(null), 5000);
            } else {
              setEntranceBanner({ name: data.name, avatarUrl: data.avatarUrl });
              setTimeout(() => setEntranceBanner(null), 3500);
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [roomId, validUserId]);

  // 3. REAL-TIME CO-HOST REQUESTS & ACCEPTANCE LISTENER
  useEffect(() => {
    if (!roomId || !validUserId || isGuest) return;
    const reqsCol = collection(db, 'live_streams', roomId, 'cohost_requests');

    const unsubscribe = onSnapshot(reqsCol, (snapshot) => {
      const reqList: any[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        reqList.push({ id: docSnap.id, ...data });

        // If viewer's request was accepted by host
        if (!isHost && docSnap.id === validUserId) {
          if (data.status === 'accepted' && !isCoHostAccepted) {
            setIsCoHostAccepted(true);
            toast({
              title: '🎉 Co-Host Request Accepted!',
              description: 'The host approved your request! You are now live on split-screen.',
            });
          }
        }
      });
      setCoHostRequests(reqList);
    });

    return () => unsubscribe();
  }, [roomId, validUserId, isHost, isCoHostAccepted, isGuest]);

  const handleToggleCoHostRequest = async () => {
    if (isGuest) {
      toast({
        title: '🎙️ Sign Up to Join as Co-Host',
        description: 'Create an account to join the live split-screen!',
      });
      onRequireAuth?.();
      return;
    }
    if (!roomId || !validUserId) return;
    const reqRef = doc(db, 'live_streams', roomId, 'cohost_requests', validUserId);

    if (isCoHostRequested) {
      await deleteDoc(reqRef).catch(console.error);
      setIsCoHostRequested(false);
      toast({
        title: 'Co-Host Request Canceled',
        description: 'Your guest seat request was removed.',
      });
    } else {
      await setDoc(reqRef, {
        uid: validUserId,
        name: validUserName,
        avatarUrl: userAvatar || '',
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      setIsCoHostRequested(true);
      toast({
        title: '✨ Co-Host Request Sent!',
        description: 'The host will review your request to bring you on live split-screen.',
      });
    }
  };

  const handleAcceptCoHostRequest = async (reqUid: string, reqName: string) => {
    if (!roomId) return;
    const reqRef = doc(db, 'live_streams', roomId, 'cohost_requests', reqUid);
    await updateDoc(reqRef, { status: 'accepted' });
    toast({
      title: `Approved @${reqName}! 🎉`,
      description: `Viewer @${reqName} is now joining live split-screen!`,
    });
  };

  const handleDeclineCoHostRequest = async (reqUid: string) => {
    if (!roomId) return;
    const reqRef = doc(db, 'live_streams', roomId, 'cohost_requests', reqUid);
    await updateDoc(reqRef, { status: 'declined' });
    toast({
      title: 'Request Declined',
      description: 'Co-Host seat request was declined.',
    });
  };

  // 4. REDIS SORTED SET (`ZINCRBY` / `ZREVRANGE`) LIVE LEADERBOARD ENGINE
  // Zero strain on primary SQL/Firestore DB: fetches Top 3 gifters via `ZREVRANGE stream:leaderboard:<roomId> 0 2 WITHSCORES`
  const applyRedisLeaderboardResponse = (data: any) => {
    if (!data) return;
    const rawList: any[] = data.topContributors || data.leaderboard?.topContributors || [];
    const mapped = rawList.map((entry: any, idx: number) => ({
      rank: entry.rank || idx + 1,
      uid: entry.uid || entry.member || `user_${idx}`,
      name: entry.name || entry.member || 'Anonymous',
      avatarUrl: entry.avatarUrl,
      totalCoins: Number(entry.score ?? entry.totalCoins ?? 0),
      lastGiftName: entry.lastGiftName,
      lastGiftIcon: entry.lastGiftIcon,
      lastGiftAt: entry.updatedAtMs,
    }));

    // Detect if #1 top contributor changed hands (Crown Takeover!)
    if (mapped.length > 0 && mapped[0].totalCoins > 0) {
      const topLeaderKey = mapped[0].name;
      if (prevLeaderUidRef.current && topLeaderKey !== prevLeaderUidRef.current) {
        setLeaderboardBanner({
          name: mapped[0].name,
          avatarUrl: mapped[0].avatarUrl,
          coins: mapped[0].totalCoins,
        });
        playLonkindSoundEffect('fanfare');
        setTimeout(() => setLeaderboardBanner(null), 4500);
      }
      prevLeaderUidRef.current = topLeaderKey;
    }

    setContributors(mapped);

    const tel = data.telemetry;
    const resObj = data.result || data.leaderboard;
    if (tel || resObj) {
      setRedisTelemetry((prev) => ({
        redisKey: tel?.redisKey || resObj?.key || prev.redisKey,
        lastWriteCommand:
          resObj?.command || tel?.recentCommands?.[0]?.command || prev.lastWriteCommand,
        top3ReadCommand:
          data.top3Command || resObj?.readCommand || `ZREVRANGE stream:leaderboard:${roomId} 0 2 WITHSCORES`,
        roomZincrbyOps: tel?.roomZincrbyOps ?? prev.roomZincrbyOps + (resObj ? 1 : 0),
        roomZrevrangeOps: tel?.roomZrevrangeOps ?? prev.roomZrevrangeOps + 1,
        primaryDbQueries: 0,
        readLatencyMs: tel?.readLatencyMs ?? resObj?.latencyMs ?? 0.02,
        recentCommands: tel?.recentCommands || prev.recentCommands,
      }));
    }
  };

  const executeRedisZincrby = async (
    memberName: string,
    coins: number,
    meta?: {
      uid?: string;
      avatarUrl?: string;
      giftName?: string;
      giftIcon?: string;
      batchEntries?: Array<{
        member: string;
        coins: number;
        uid?: string;
        avatarUrl?: string;
        giftName?: string;
        giftIcon?: string;
      }>;
    }
  ) => {
    try {
      const res = await fetch('/api/stream-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          member: memberName,
          coins,
          uid: meta?.uid,
          avatarUrl: meta?.avatarUrl,
          giftName: meta?.giftName,
          giftIcon: meta?.giftIcon,
          batchEntries: meta?.batchEntries,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        applyRedisLeaderboardResponse(data);
        return data;
      }
    } catch (e) {
      console.warn('Redis ZINCRBY fetch error:', e);
    }
    return null;
  };

  useEffect(() => {
    if (!roomId) return;
    let isMounted = true;

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(
          `/api/stream-leaderboard?roomId=${encodeURIComponent(roomId)}&member=${encodeURIComponent(validUserName)}&top=25`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          applyRedisLeaderboardResponse(data);
        }
      } catch (_) {}
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId, validUserName]);

  // 5. CLIENT-SIDE 500ms TAP BATCHER ("Combo x10") & IDEMPOTENT NETWORK RETRY OUTBOX
  const targetHostUidForOutbox = (hostUid || validUserId).replace(/^live_/, '');
  const {
    pendingBatch: pendingTapBatch,
    outboxItems,
    simulateNetworkDrop,
    setSimulateNetworkDrop,
    registerGiftTap,
    flushPendingBatchNow,
    retryAllPendingOutbox,
    verifyIdempotentReplayProtection,
    telemetry: batchOutboxTelemetry,
  } = useGiftTapBatcherAndOutbox({
    roomId,
    toUserId: targetHostUidForOutbox,
    senderId: validUserId,
    senderName: validUserName,
    senderAvatar: userAvatar,
    getIdToken: async () => auth.currentUser?.getIdToken(),
    onBatchCommitted: async (item, serverData) => {
      if (serverData?.leaderboard || serverData?.topContributors) {
        applyRedisLeaderboardResponse(serverData);
      }

      if (item.idempotentReplayConfirmed) {
        return;
      }

      // Write 1 single coalesced chat message for the entire Combo xN batch
      try {
        const chatRef = collection(db, 'live_streams', roomId, 'chat');
        await addDoc(chatRef, {
          senderId: validUserId,
          senderName: validUserName,
          senderAvatar: userAvatar || '',
          text:
            item.comboCount > 1
              ? `sent ${item.giftName} ${item.giftEmoji} x${item.comboCount}!`
              : `sent ${item.giftName} ${item.giftEmoji}!`,
          type: 'gift',
          giftIcon: item.giftEmoji,
          giftName: item.giftName,
          vipLevel: userVipTier.level,
          vipBadge: userVipTier.badge,
          createdAtMs: Date.now(),
          timestamp: serverTimestamp(),
        });
      } catch (_) {}

      if (streamGoal?.enabled) {
        const roomRef = doc(db, 'live_streams', roomId);
        updateDoc(roomRef, {
          'streamGoal.currentCoins': increment(item.totalCoins),
        }).catch(() => {});
      }

      const matchedGift = GIFT_CATALOG.find((g) => g.id === item.giftId);
      if (matchedGift?.isSuper) {
        const now = Date.now();
        const chestData = {
          id: `chest_${now}`,
          senderName: validUserName,
          unlockAtMs: now + 12000,
          expiresAtMs: now + 45000,
          rewardPool: Math.min(2500, Math.round(item.totalCoins * 0.05)),
        };
        setTreasureChest(chestData);
        setTreasureCountdown(12);
        updateDoc(doc(db, 'live_streams', roomId), {
          treasureChest: chestData,
        }).catch(() => {});
      }

      const pkPointsEarned = isPkBoosterActive ? item.totalCoins * 2 : item.totalCoins;
      setPkBattleScore((prev) => ({
        ...prev,
        host1Score: prev.host1Score + pkPointsEarned,
      }));

      toast({
        title:
          item.comboCount > 1
            ? `Sent ${item.giftName} ${item.giftEmoji} x${item.comboCount}! 🎁`
            : `Sent ${item.giftName} ${item.giftEmoji}! 🎁`,
        description: `${item.totalCoins.toLocaleString()} Coins sent to ${isHost ? validUserName : (streamHostInfo?.name || 'the host')}`,
      });
    },
    onBatchError: (item, errMsg) => {
      toast({
        variant: 'destructive',
        title: 'Gift Batch Rejected',
        description: errMsg,
      });
    },
  });

  const handleSavePinnedNotice = async () => {
    if (!roomId || !isHost) return;
    const text = pinInputText.trim();
    if (!text) return;
    const roomRef = doc(db, 'live_streams', roomId);
    await updateDoc(roomRef, {
      pinnedComment: {
        text,
        senderName: validUserName,
        pinnedAt: serverTimestamp(),
      },
    }).catch(console.error);
    setIsPinModalOpen(false);
    setPinInputText('');
    toast({
      title: '📌 Notice Pinned!',
      description: 'Your announcement is now pinned at the top of the chat for all viewers.',
    });
  };

  const handleUnpinNotice = async () => {
    if (!roomId || !isHost) return;
    const roomRef = doc(db, 'live_streams', roomId);
    await updateDoc(roomRef, {
      pinnedComment: null,
    }).catch(console.error);
    toast({
      title: 'Notice Unpinned',
      description: 'The pinned announcement was removed.',
    });
  };

  // Subscribe to real-time user coin balance updates
  useEffect(() => {
    if (!validUserId) return;
    const userRef = doc(db, 'users', validUserId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (typeof data.coins === 'number') {
          setUserCoins(data.coins);
        }
      }
    });
    return () => unsubscribe();
  }, [validUserId]);

  // Listen for stream end status from host
  useEffect(() => {
    if (!roomId) return;
    const streamRef = doc(db, 'live_streams', roomId);
    const unsubscribe = onSnapshot(streamRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()?.status === 'ended' && !isHost) {
        onLeave();
      }
    });
    return () => unsubscribe();
  }, [roomId, isHost, onLeave]);

  // Live Hardware Controls (Mic Toggle, Camera Toggle, Front/Back Camera Flip)
  const handleToggleLiveMic = () => {
    const nextMic = !isMicEnabled;
    setIsMicEnabled(nextMic);
    const activeStream = localStreamRef.current || coHostLocalStreamRef.current;
    if (activeStream) {
      activeStream.getAudioTracks().forEach((track) => {
        track.enabled = nextMic;
      });
    }
  };

  const handleToggleLiveCamera = () => {
    const nextCam = !isCameraEnabled;
    setIsCameraEnabled(nextCam);
    const activeStream = localStreamRef.current || coHostLocalStreamRef.current;
    if (activeStream) {
      activeStream.getVideoTracks().forEach((track) => {
        track.enabled = nextCam;
      });
    }
  };

  const handleFlipCamera = async () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacing);
    try {
      const newMedia = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newVideoTrack = newMedia.getVideoTracks()[0];
      if (!newVideoTrack) return;
      newVideoTrack.enabled = isCameraEnabled;

      const currentStream = localStreamRef.current || coHostLocalStreamRef.current;
      if (currentStream) {
        const oldVideoTracks = currentStream.getVideoTracks();
        oldVideoTracks.forEach((t) => {
          t.stop();
          currentStream.removeTrack(t);
        });
        currentStream.addTrack(newVideoTrack);
      }

      if (localVideoRef.current && currentStream) {
        localVideoRef.current.srcObject = currentStream;
      }

      // Replace outgoing video track on all active WebRTC peer connections
      hostPeersRef.current.forEach(({ pc }) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch(() => {});
        }
      });
      if (viewerPeerRef.current) {
        const videoSender = viewerPeerRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Camera flip not supported on this device:', err);
    }
  };

  const handleUnmuteRemoteAudio = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.play().catch(() => {});
      setIsRemoteAudioMuted(false);
    }
  };

  // Native WebRTC Live Stream Engine (Host Broadcaster + Viewer/Co-Host Receiver via Firestore Signaling)
  useEffect(() => {
    if (!roomId || !validUserId) return;
    if (isHost && !hasStartedLive) return;

    let isCancelled = false;
    let unsubSignaling: (() => void) | null = null;

    const startHostBroadcast = async () => {
      setIsConnecting(true);
      setConnectionError(null);

      let stream: MediaStream | null = null;
      try {
        if (streamMode === 'video') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: cameraFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: true,
            });
          } catch (_) {
            // Fallback to audio-only if camera is unavailable
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        }
      } catch (err: any) {
        console.warn('Could not access camera/microphone:', err);
        if (!isCancelled) {
          setConnectionError('Please allow camera and microphone permissions in your browser to go live.');
          setIsConnecting(false);
        }
        return;
      }

      if (isCancelled || !stream) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      // Apply initial mic & camera toggle states
      stream.getAudioTracks().forEach((t) => {
        t.enabled = isMicEnabled;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = isCameraEnabled;
      });

      localStreamRef.current = stream;
      hasJoinedRoomRef.current = true;
      setIsConnecting(false);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Listen for Viewer WebRTC Offers inside live_streams/{roomId}/viewers
      const viewersCol = collection(db, 'live_streams', roomId, 'viewers');
      unsubSignaling = onSnapshot(viewersCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const viewerId = change.doc.id;
          if (viewerId === validUserId) return;

          if (change.type === 'removed') {
            const existing = hostPeersRef.current.get(viewerId);
            if (existing) {
              try {
                existing.pc.close();
              } catch (_) {}
              hostPeersRef.current.delete(viewerId);
            }
            return;
          }

          const data = change.doc.data();
          const offer = data.rtcOffer;
          if (!offer || !offer.sdp || !offer.offerId) return;

          const existingPeer = hostPeersRef.current.get(viewerId);

          // If this is a brand new offer from this viewer, create a fresh RTCPeerConnection
          if (!existingPeer || existingPeer.offerId !== offer.offerId) {
            if (existingPeer) {
              try {
                existingPeer.pc.close();
              } catch (_) {}
            }

            const pc = new RTCPeerConnection(FREE_RTC_CONFIG);
            const peerRecord = { pc, offerId: offer.offerId, addedCandCount: 0 };
            hostPeersRef.current.set(viewerId, peerRecord);

            // Add Host camera & audio tracks to send to Viewer
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
              });
            }

            // If this viewer is an accepted Co-Host sending video/audio back, display it in Co-Host PiP
            pc.ontrack = (event) => {
              const incomingStream = event.streams?.[0] || new MediaStream([event.track]);
              if (coHostVideoRef.current) {
                coHostVideoRef.current.srcObject = incomingStream;
                coHostVideoRef.current.play().catch(() => {});
              }
              setHasCoHostStream(true);
            };

            const hostCands: any[] = [];
            const viewerDocRef = doc(db, 'live_streams', roomId, 'viewers', viewerId);

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                hostCands.push(event.candidate.toJSON());
                setDoc(viewerDocRef, { hostCandidates: hostCands }, { merge: true }).catch(() => {});
              }
            };

            try {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: offer.type, sdp: offer.sdp }));

              // Add any viewer ICE candidates already present
              const viewerCands = Array.isArray(data.viewerCandidates) ? data.viewerCandidates : [];
              for (let i = 0; i < viewerCands.length; i++) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(viewerCands[i]));
                } catch (_) {}
              }
              peerRecord.addedCandCount = viewerCands.length;

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              await setDoc(
                viewerDocRef,
                {
                  rtcAnswer: {
                    type: answer.type,
                    sdp: answer.sdp,
                    offerId: offer.offerId,
                  },
                },
                { merge: true }
              );
            } catch (err) {
              console.warn('Error answering viewer WebRTC offer:', err);
            }
          } else {
            // Same offerId: add any newly arrived viewer ICE candidates
            const viewerCands = Array.isArray(data.viewerCandidates) ? data.viewerCandidates : [];
            if (viewerCands.length > existingPeer.addedCandCount && existingPeer.pc.remoteDescription) {
              for (let i = existingPeer.addedCandCount; i < viewerCands.length; i++) {
                try {
                  await existingPeer.pc.addIceCandidate(new RTCIceCandidate(viewerCands[i]));
                } catch (_) {}
              }
              existingPeer.addedCandCount = viewerCands.length;
            }
          }
        });
      });
    };

    const startViewerOrCoHostConnection = async () => {
      setIsConnecting(true);
      setConnectionError(null);

      const pc = new RTCPeerConnection(FREE_RTC_CONFIG);
      viewerPeerRef.current = pc;

      // If Viewer was accepted as a Co-Host, capture their camera & mic and stream back to Host
      if (isCoHostAccepted) {
        try {
          const coStream = await navigator.mediaDevices.getUserMedia({
            video: streamMode === 'video' ? { facingMode: cameraFacingMode, width: { ideal: 640 }, height: { ideal: 480 } } : false,
            audio: true,
          });
          coHostLocalStreamRef.current = coStream;
          if (coHostVideoRef.current) {
            coHostVideoRef.current.srcObject = coStream;
            coHostVideoRef.current.play().catch(() => {});
          }
          setHasCoHostStream(true);
          coStream.getTracks().forEach((track) => {
            pc.addTrack(track, coStream);
          });
        } catch (err) {
          console.warn('Co-Host camera/mic unavailable, joining receive-only:', err);
          pc.addTransceiver('video', { direction: 'recvonly' });
          pc.addTransceiver('audio', { direction: 'recvonly' });
        }
      } else {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      const incomingStream = new MediaStream();

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => incomingStream.addTrack(t));
        } else if (event.track) {
          incomingStream.addTrack(event.track);
        }

        setHasRemoteStream(true);
        setIsConnecting(false);
        hasJoinedRoomRef.current = true;

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = incomingStream;
          remoteVideoRef.current.play().catch(() => {
            // Browser blocked unmuted autoplay: play muted and show 1-tap unmute button
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = true;
              setIsRemoteAudioMuted(true);
              remoteVideoRef.current.play().catch(() => {});
            }
          });
        }
      };

      const viewerDocRef = doc(db, 'live_streams', roomId, 'viewers', validUserId);
      const viewerCands: any[] = [];
      const offerId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          viewerCands.push(event.candidate.toJSON());
          setDoc(viewerDocRef, { viewerCandidates: viewerCands }, { merge: true }).catch(() => {});
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await setDoc(
          viewerDocRef,
          {
            uid: validUserId,
            name: validUserName,
            rtcOffer: {
              type: offer.type,
              sdp: offer.sdp,
              offerId,
            },
            rtcAnswer: null,
            viewerCandidates: [],
            hostCandidates: [],
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Failed to create viewer WebRTC offer:', err);
      }

      let addedHostCandCount = 0;
      unsubSignaling = onSnapshot(viewerDocRef, async (docSnap) => {
        if (!docSnap.exists() || isCancelled) return;
        const data = docSnap.data();

        if (
          data.rtcAnswer &&
          data.rtcAnswer.offerId === offerId &&
          data.rtcAnswer.sdp &&
          !pc.currentRemoteDescription
        ) {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: data.rtcAnswer.type, sdp: data.rtcAnswer.sdp })
            );
            setIsConnecting(false);
            hasJoinedRoomRef.current = true;
          } catch (err) {
            console.warn('Failed to set remote answer on viewer:', err);
          }
        }

        const hostCands = Array.isArray(data.hostCandidates) ? data.hostCandidates : [];
        if (hostCands.length > addedHostCandCount && pc.remoteDescription) {
          for (let i = addedHostCandCount; i < hostCands.length; i++) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(hostCands[i]));
            } catch (_) {}
          }
          addedHostCandCount = hostCands.length;
        }
      });
    };

    if (isHost) {
      startHostBroadcast();
    } else {
      startViewerOrCoHostConnection();
    }

    return () => {
      isCancelled = true;
      if (unsubSignaling) unsubSignaling();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (coHostLocalStreamRef.current) {
        coHostLocalStreamRef.current.getTracks().forEach((t) => t.stop());
        coHostLocalStreamRef.current = null;
      }
      hostPeersRef.current.forEach(({ pc }) => {
        try {
          pc.close();
        } catch (_) {}
      });
      hostPeersRef.current.clear();

      if (viewerPeerRef.current) {
        try {
          viewerPeerRef.current.close();
        } catch (_) {}
        viewerPeerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost, isCoHostAccepted, hasStartedLive, streamMode]);

  // Firestore real-time live chat & gift listener (filtered strictly to current live session)
  useEffect(() => {
    if (!roomId) return;
    const chatRef = collection(db, 'live_streams', roomId, 'chat');
    const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100));
    let isInitialLoad = true;

    const isFromCurrentSession = (data: LiveMessage) => {
      const cutoffMs = sessionStartedAtMsRef.current - 5000;
      if (typeof data.createdAtMs === 'number') {
        return data.createdAtMs >= cutoffMs;
      }
      if (data.timestamp && typeof data.timestamp.toMillis === 'function') {
        return data.timestamp.toMillis() >= cutoffMs;
      }
      // Pending serverTimestamp() write from local client is always current
      return true;
    };

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: LiveMessage[] = [];
      if (!isInitialLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as LiveMessage;
            if (!isFromCurrentSession(data)) return;
            if (data.type === 'gift' && data.giftIcon) {
              if (data.senderId !== validUserId) {
                const matchedGift = GIFT_CATALOG.find(
                  (g) => g.name === data.giftName || g.icon === data.giftIcon
                );
                // Only Top-Tier gifts (`isSuper: true`) play on stage; standard gifts (Rose, etc.) only appear in the bottom Live Chat
                if (matchedGift?.isSuper) {
                  triggerGiftingMoment(matchedGift, data.senderName, data.senderAvatar, 1, true);
                }
              }
            }
          }
        });
      }
      isInitialLoad = false;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as LiveMessage;
        if (isFromCurrentSession(data)) {
          msgs.push({ ...data, id: docSnap.id });
        }
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [roomId]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // TikTok-Style Screen Tap Floating Heart Spawner
  const handleScreenTap = () => {
    const emojis = ['❤️', '💖', '🔥', '💜', '✨'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const likeId = Math.random().toString();
    const randomX = Math.floor(Math.random() * 25) + 70; // Float up near bottom-right (70% - 95% width)

    const newLike: FloatingLike = { id: likeId, xPercent: randomX, emoji: randomEmoji };
    setFloatingLikes((prev) => [...prev, newLike]);

    setTimeout(() => {
      setFloatingLikes((prev) => prev.filter((l) => l.id !== likeId));
    }, 2000);
  };

  const triggerGiftingMoment = (
    gift: typeof GIFT_CATALOG[0],
    senderName: string,
    senderAvatar?: string,
    quantity = 1,
    skipRedisZincrby = false
  ) => {
    // 1. Enqueue & Coalesce in the Frontend Gift Queue + Kafka Partition Broker (applying Admin AI Studio video overrides if present)
    const effectiveGift = giftOverrides[gift.id]?.videoUrl
      ? {
          ...gift,
          videoUrl: giftOverrides[gift.id].videoUrl!,
          previewGifUrl: giftOverrides[gift.id].previewGifUrl || gift.previewGifUrl,
          isSuper: true,
        }
      : gift;

    const stackedItem = enqueueGift({
      roomId,
      gift: effectiveGift,
      senderId: validUserId,
      senderName,
      senderAvatar,
      quantity,
    });

    // Update Redis Sorted Set (`ZINCRBY stream:leaderboard:<roomId> <coins> "<senderName>"`)
    if (!skipRedisZincrby) {
      executeRedisZincrby(senderName, gift.price * quantity, {
        uid: validUserId,
        avatarUrl: senderAvatar,
        giftName: gift.name,
        giftIcon: gift.icon,
      });
    }

    // Standard gifts (Rose, Finger Heart, Perfume, Ring, Diamond, Crown, etc.) do NOT play on screen —
    // they only post "sent Rose 🌹!" in the bottom Live Chat comment box.
    if (!gift.isSuper) {
      return;
    }

    const currentCombo = stackedItem.combo;

    // 2. Update VIP Banner state for Top-Tier gifts
    setVipBanner({
      senderName: stackedItem.displaySenderLabel,
      senderAvatar,
      giftName: gift.name,
      giftIcon: gift.icon,
      combo: currentCombo,
      price: gift.price,
    });

    if ((triggerGiftingMoment as any).vipTimeout) {
      clearTimeout((triggerGiftingMoment as any).vipTimeout);
    }
    (triggerGiftingMoment as any).vipTimeout = setTimeout(() => {
      setVipBanner(null);
    }, 4200);
  };

  const handleSendMessage = async () => {
    if (isGuest) {
      toast({
        title: '💬 Sign Up to Chat Live',
        description: 'Join Lonkind to chat live with the creator and community!',
      });
      onRequireAuth?.();
      return;
    }
    if (!inputText.trim() || isSending) return;
    setIsSending(true);
    const messageContent = inputText.trim();
    setInputText('');

    try {
      const chatRef = collection(db, 'live_streams', roomId, 'chat');
      await addDoc(chatRef, {
        senderId: validUserId,
        senderName: validUserName,
        senderAvatar: userAvatar || '',
        text: messageContent,
        type: 'text',
        vipLevel: userVipTier.level,
        vipBadge: userVipTier.badge,
        createdAtMs: Date.now(),
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send live message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGift = async (gift: typeof GIFT_CATALOG[0]) => {
    setIsGiftModalOpen(false);
    if (isGuest) {
      toast({
        title: '🎁 Sign Up to Send Gifts',
        description: 'Create your account now to support creators with virtual gifts!',
      });
      onRequireAuth?.();
      return;
    }

    // Check if this gift is currently an active Admin Free Event Gift
    const isFreeEventGift =
      activePlatformEvent?.eventActive &&
      activePlatformEvent.freeGiftId === gift.id &&
      freeEventGiftSentCount < (activePlatformEvent.freeGiftDailyLimit || 3);

    if (isFreeEventGift) {
      const nextCount = freeEventGiftSentCount + 1;
      setFreeEventGiftSentCount(nextCount);
      triggerGiftingMoment(gift, validUserName, userAvatar, 1, false);
      toast({
        title: `🎉 Free Event Gift Sent!`,
        description: `Sent ${gift.name} ${gift.icon} for FREE (${(activePlatformEvent?.freeGiftDailyLimit || 3) - nextCount} free left in ${activePlatformEvent?.eventTitle})!`,
      });
      try {
        const chatRef = collection(db, 'live_streams', roomId, 'chat');
        await addDoc(chatRef, {
          senderId: validUserId,
          senderName: validUserName,
          senderAvatar: userAvatar || '',
          text: `sent Free Event Gift ${gift.name} ${gift.icon}! 🎉`,
          type: 'gift',
          giftName: gift.name,
          giftIcon: gift.icon,
          giftPrice: 0,
          createdAtMs: Date.now(),
          timestamp: serverTimestamp(),
        });
      } catch (_) {}
      return;
    }

    const reservedInPendingBatch =
      pendingTapBatch && pendingTapBatch.giftId === gift.id ? pendingTapBatch.totalCoins : 0;

    // If the user has enough coins, process the real coin gift batch + animation
    if (userCoins - reservedInPendingBatch >= gift.price) {
      registerGiftTap(gift, 1);
      triggerGiftingMoment(gift, validUserName, userAvatar, 1, true);
      return;
    }

    // Lock down 0-coin gift loophole: prompt user to recharge coins if balance is insufficient
    setRechargeModalGift(gift);
  };

  /**
   * Simulates a user rapidly tapping a gift 10 times (80ms apart, well within the 500ms window).
   * Proves that 10 rapid taps do NOT hit the database 10 times — instead, after 500ms of inactivity,
   * the client flushes a single `"Combo x10"` request with 1 unique idempotencyKey!
   */
  const simulateRapidTapCombo10 = (gift: typeof GIFT_CATALOG[0]) => {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        registerGiftTap(gift, 1);
        triggerGiftingMoment(gift, validUserName, userAvatar, 1, true);
      }, i * 65);
    }
  };

  const handleEndStream = async () => {
    try {
      resetGiftQueue();
      setMessages([]);
      setVipBanner(null);

      if (validUserId && roomId) {
        // Delete viewer tracking document
        const viewerRef = doc(db, 'live_streams', roomId, 'viewers', validUserId);
        await deleteDoc(viewerRef).catch(() => {});

        // Only mark stream ended in Firestore & wipe chat/gift history if user is host
        if (isHost && hasJoinedRoomRef.current) {
          // 1. Trigger server-side Firebase Admin batch deletion so every viewer's chat/gift doc is wiped
          try {
            const idToken = await auth.currentUser?.getIdToken();
            if (idToken) {
              await fetch('/api/live/clean-room', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ roomId }),
              });
            }
          } catch {}

          // 2. Client-side fallback cleanup
          const chatCol = collection(db, 'live_streams', roomId, 'chat');
          const chatSnap = await getDocs(chatCol).catch(() => null);
          if (chatSnap) {
            await Promise.all(chatSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
          }

          const streamRef = doc(db, 'live_streams', roomId);
          await setDoc(
            streamRef,
            {
              status: 'ended',
              pinnedComment: null,
              treasureChest: null,
              endedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
          await updateDoc(doc(db, 'users', validUserId), { isLive: false, liveRoomId: null }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error ending stream:', err);
    } finally {
      onLeave();
    }
  };

  const hostDisplayName = isHost ? validUserName : (streamHostInfo?.name || validUserName);
  const hostDisplayAvatar = isHost ? userAvatar : (streamHostInfo?.avatar || userAvatar);

  // Pre-Live Creator Studio (User Choice before going on air)
  if (isHost && !hasStartedLive) {
    const titlePresets = [
      'Chilling & Chatting ☕',
      'Late Night Vibes 🌙',
      'Q&A & Community Talk 🎙️',
      'Gaming Marathon 🎮',
      'Music Jam Session 🎸',
    ];

    const categories = [
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'music', label: 'Music', icon: Music },
      { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
      { id: 'creative', label: 'Creative', icon: Sparkles },
      { id: 'lifestyle', label: 'Lifestyle', icon: Heart },
    ];

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex flex-col justify-between overflow-y-auto select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 md:px-8 border-b border-white/10 shrink-0 bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Radio className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black text-white">Live Studio</h1>
                <Badge className="bg-indigo-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5">
                  Creator Mode
                </Badge>
              </div>
              <p className="text-xs text-slate-400">Configure your broadcast before going on air</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full text-xs font-bold"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>

        {/* Studio Setup Body */}
        <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left Column: Live Preview Card */}
          <div className="bg-slate-900/80 border border-white/15 rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-between min-h-[380px] relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Preview Tag */}
            <div className="w-full flex items-center justify-between z-10 mb-4">
              <Badge className="bg-slate-800 text-slate-300 border border-white/10 text-[11px] font-semibold px-3 py-1">
                Preview Mode
              </Badge>
              <Badge className={`font-extrabold text-[11px] px-3 py-1 ${streamMode === 'video' ? 'bg-indigo-600 text-white' : 'bg-purple-600 text-white'}`}>
                {streamMode === 'video' ? '🎥 Video Live' : '🎙️ Audio Room'}
              </Badge>
            </div>

            {/* Avatar & Visual Stage Preview */}
            <div className="my-auto flex flex-col items-center text-center z-10 py-6">
              <div className="relative mb-4">
                {streamMode === 'audio' && (
                  <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" />
                )}
                <Avatar className="h-28 w-28 border-4 border-indigo-500/50 shadow-2xl">
                  <AvatarImage src={userAvatar} alt={validUserName} />
                  <AvatarFallback className="bg-indigo-600 text-white text-3xl font-black">
                    {validUserName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white shadow">
                  <Check className="h-4 w-4" />
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-1 truncate max-w-[280px]">
                {streamTitle || `${validUserName}'s Live`}
              </h3>
              <p className="text-xs text-slate-400 capitalize">
                Category: <span className="text-indigo-400 font-semibold">{streamCategory}</span>
              </p>
            </div>

            {/* Hardware Quick Toggles */}
            <div className="w-full z-10 pt-4 border-t border-white/10 flex items-center justify-around">
              {streamMode === 'video' && (
                <button
                  type="button"
                  onClick={() => setIsCameraEnabled(!isCameraEnabled)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isCameraEnabled
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  <span>{isCameraEnabled ? 'Camera On' : 'Camera Off'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMicEnabled(!isMicEnabled)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isMicEnabled
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span>{isMicEnabled ? 'Mic On' : 'Mic Muted'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Choices & Configuration */}
          <div className="space-y-6">
            {/* 1. Broadcast Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                <span>Select Broadcast Mode</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStreamMode('video')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    streamMode === 'video'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Video className={`h-4 w-4 ${streamMode === 'video' ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Video Live</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Camera broadcast with AR filters, PK battles, and video co-hosting.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStreamMode('audio')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    streamMode === 'audio'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Radio className={`h-4 w-4 ${streamMode === 'audio' ? 'text-purple-400' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Audio Voice Room</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Clubhouse-style voice room. Low bandwidth, camera off, audio-first stage.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Stream Title Input & Suggestions */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Stream Title</span>
              </label>
              <Input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                maxLength={60}
                placeholder="Give your stream a catchy title..."
                className="bg-slate-900/90 border-white/15 text-white placeholder:text-slate-500 rounded-xl h-11 text-sm focus:border-indigo-500"
              />
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {titlePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStreamTitle(preset)}
                    className="text-[11px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white px-2.5 py-1 rounded-full transition-all"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = streamCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setStreamCategory(cat.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Creator Stream Goal (Optional) */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-rose-400" />
                  <span>Stream Coin Goal</span>
                </label>
                <button
                  type="button"
                  onClick={() => setGoalEnabled(!goalEnabled)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                    goalEnabled
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'bg-white/5 text-slate-400 border border-white/10'
                  }`}
                >
                  {goalEnabled ? 'Enabled ✓' : 'Disabled'}
                </button>
              </div>

              {goalEnabled && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-inner">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block mb-1">Goal Objective</span>
                    <Input
                      type="text"
                      value={goalTitle}
                      onChange={(e) => setGoalTitle(e.target.value)}
                      maxLength={40}
                      placeholder="e.g. Song Cover 🎸, Subathon 🎯"
                      className="bg-slate-950 border-white/15 text-white text-xs h-10 rounded-xl focus:border-rose-500"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Song Cover 🎸', 'Dance Celebration 💃', 'Community Milestone 🎯', 'Q&A Special 🎙️', 'PC Setup Fund 💻'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setGoalTitle(preset)}
                          className="text-[10px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white px-2.5 py-1 rounded-full transition-all"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Coin Target</span>
                      <span className="text-[11px] font-mono font-extrabold text-amber-400">{goalTarget.toLocaleString()} L</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[500, 1000, 2500, 5000, 10000, 25000].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setGoalTarget(amount)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all ${
                            goalTarget === amount
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-amber-400 shadow-md font-extrabold'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                          }`}
                        >
                          {amount.toLocaleString()} L
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Go Live Action Bar */}
        <div className="p-4 md:px-8 border-t border-white/10 shrink-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-between max-w-4xl w-full mx-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Radio className="h-4 w-4 text-rose-500 animate-pulse" />
            <span>Ready to reach viewers across Lonkind</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onLeave}
              className="border-white/15 text-slate-300 hover:text-white hover:bg-white/10 text-xs font-bold rounded-xl h-11 px-5"
            >
              Cancel
            </Button>

            <Button
              onClick={() => {
                setHasStartedLive(true);
                toast({
                  title: '🔴 Going Live!',
                  description: `Starting ${streamMode === 'video' ? 'Video Live' : 'Audio Voice Room'}...`,
                });
              }}
              className="bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-sm rounded-xl h-11 px-7 shadow-xl shadow-rose-600/30 flex items-center gap-2 transform hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
              <span>Go Live Now 🔴</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 bg-black overflow-hidden flex flex-col select-none ${isScreenShaking ? 'animate-screen-shake' : ''}`}>
      {/* Native WebRTC Video Stage (Host Local Camera + Viewer Remote WebRTC Stream + Co-Host PiP) */}
      <div
        ref={containerRef}
        onClick={handleScreenTap}
        className={`w-full h-full absolute inset-0 bg-slate-950 flex items-center justify-center transition-all duration-300 ${
          streamMode === 'audio' ? 'opacity-0 pointer-events-none' : ''
        } ${
          activeFilter === 'sparkles' ? 'brightness-110 contrast-105' :
          activeFilter === 'warm' ? 'sepia-[0.2] hue-rotate-15' :
          activeFilter === 'neon' ? 'saturate-200 contrast-125' :
          activeFilter === 'vintage' ? 'sepia-[0.4] contrast-90 brightness-95' :
          activeFilter === 'golden' ? 'brightness-115 sepia-[0.25]' : ''
        }`}
      >
        {isHost ? (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraFacingMode === 'user' ? '-scale-x-100' : ''} ${
                !isCameraEnabled ? 'opacity-0' : 'opacity-100'
              } transition-opacity duration-300`}
            />
            {(!isCameraEnabled || isConnecting || connectionError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-center">
                <Avatar className="h-24 w-24 border-4 border-indigo-500/50 shadow-2xl mb-3">
                  <AvatarImage src={hostDisplayAvatar} alt={hostDisplayName} />
                  <AvatarFallback className="bg-indigo-600 text-white text-3xl font-bold">
                    {hostDisplayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {isConnecting ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Starting camera &amp; WebRTC broadcast...</span>
                  </div>
                ) : connectionError ? (
                  <p className="text-xs font-semibold text-rose-400 max-w-xs">{connectionError}</p>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">Camera Paused</span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${hasRemoteStream ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
            />
            {!hasRemoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-center">
                <div className="relative flex items-center justify-center mb-4">
                  <div className="absolute h-32 w-32 rounded-full bg-indigo-500/15 animate-ping" />
                  <Avatar className="h-24 w-24 border-4 border-indigo-500/50 shadow-2xl">
                    <AvatarImage src={hostDisplayAvatar} alt={hostDisplayName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-3xl font-bold">
                      {hostDisplayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting to {hostDisplayName}&apos;s live stream...</span>
                </div>
              </div>
            )}
            {isRemoteAudioMuted && hasRemoteStream && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnmuteRemoteAudio();
                }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto"
              >
                <VolumeX className="h-4 w-4" />
                <span>Tap to Unmute Live Audio 🔊</span>
              </button>
            )}
          </>
        )}

        {/* Co-Host Split-Screen / Picture-in-Picture Window */}
        {(hasCoHostStream || isCoHostAccepted) && (
          <div className="absolute top-20 right-3 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-2xl bg-slate-900 z-20">
            <video
              ref={coHostVideoRef}
              autoPlay
              playsInline
              muted={isCoHostAccepted}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-1.5 left-1.5 bg-emerald-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
              Co-Host 🎙️
            </span>
          </div>
        )}
      </div>

      {/* Audio Voice Room Center Stage when in audio mode */}
      {streamMode === 'audio' && (
        <div 
          onClick={handleScreenTap}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-950/40 via-slate-950/80 to-black cursor-pointer"
        >
          {/* Radial pulsing waves */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute h-48 w-48 rounded-full bg-indigo-500/10 animate-ping" />
            <div className="absolute h-36 w-36 rounded-full bg-purple-500/20 animate-pulse" />
            <Avatar className="h-28 w-28 border-4 border-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.5)]">
              <AvatarImage src={hostDisplayAvatar} alt={hostDisplayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-3xl font-bold">
                {hostDisplayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[11px] font-black px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-white/20">
              <Radio className="h-3 w-3 animate-pulse text-rose-300" />
              <span>ON AIR</span>
            </div>
          </div>

          {/* Room Title & Host Info */}
          <h2 className="text-xl md:text-2xl font-black text-white text-center max-w-md drop-shadow mb-2">
            {streamTitle || `${hostDisplayName}'s Voice Room`}
          </h2>
          <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold mb-6">
            <Badge className="bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 capitalize">
              {streamCategory}
            </Badge>
            <span>•</span>
            <span>🎙️ Audio Voice Room</span>
          </div>

          {/* Animated Audio Equalizer Bars */}
          <div className="flex items-end gap-1.5 h-8">
            <div className="w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s] h-6" />
            <div className="w-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.1s] h-8" />
            <div className="w-1.5 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.4s] h-4" />
            <div className="w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.2s] h-7" />
            <div className="w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.5s] h-5" />
          </div>
        </div>
      )}

      {/* AR Video Filter Overlay Layer */}
      {activeFilter !== 'normal' && (
        <div className={`absolute inset-0 pointer-events-none z-10 transition-all duration-300 ${
          activeFilter === 'sparkles' ? 'bg-gradient-to-tr from-yellow-500/10 via-pink-500/10 to-indigo-500/10 mix-blend-screen animate-pulse' :
          activeFilter === 'warm' ? 'bg-amber-500/15 mix-blend-color-burn' :
          activeFilter === 'neon' ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 mix-blend-overlay' :
          activeFilter === 'vintage' ? 'bg-amber-900/20 mix-blend-color' :
          activeFilter === 'golden' ? 'bg-gradient-to-b from-yellow-400/20 to-amber-600/20 mix-blend-color' : ''
        }`} />
      )}

      {/* Top Header Overlay - Responsive & Adjustable for Phone & PC */}
      <div className="absolute top-3 left-2.5 right-2.5 sm:top-4 sm:left-4 sm:right-4 z-30 flex items-center justify-between pointer-events-auto gap-1 sm:gap-2">
        {/* Left Side: Host Info & LIVE Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 bg-slate-950/80 backdrop-blur-md border border-white/15 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 shadow-xl shrink min-w-0">
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-white/20 shrink-0">
            <AvatarImage src={hostDisplayAvatar} alt={hostDisplayName} />
            <AvatarFallback className="bg-indigo-600 text-white text-[10px] sm:text-xs font-bold">
              {hostDisplayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 pr-0.5 sm:pr-1">
            <span className="text-[11px] sm:text-xs font-bold text-white truncate max-w-[65px] xs:max-w-[85px] sm:max-w-[140px]">
              {hostDisplayName}
            </span>
            <span className="hidden sm:inline text-[10px] text-indigo-300 font-medium truncate max-w-[120px]">
              {streamTitle || (isHost ? 'Host (You)' : 'Live Host')}
            </span>
          </div>
          <Badge className="bg-rose-600 text-white font-extrabold text-[9px] sm:text-[10px] px-1.5 py-0 sm:px-2 sm:py-0.5 rounded-full flex items-center gap-1 shadow-md border-none shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
          {streamCategory && (
            <Badge className="hidden md:inline-flex bg-white/15 text-white text-[9px] font-semibold px-1.5 py-0 rounded-full capitalize">
              {streamCategory}
            </Badge>
          )}
        </div>

        {/* Right Side: Responsive Controls & Phone-Adjusted End Button */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Co-Host Button */}
          {!isHost ? (
            <Button
              size="sm"
              onClick={handleToggleCoHostRequest}
              className={`h-8 px-2 sm:h-9 sm:px-3 text-[10px] sm:text-xs font-bold rounded-full shadow-xl transition-all border border-emerald-400/30 shrink-0 ${
                isCoHostAccepted
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : isCoHostRequested
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isCoHostAccepted ? 'Co-Host 🎙️' : isCoHostRequested ? 'Requested ✓' : 'Co-Host'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsHostRequestsModalOpen(true)}
              className="h-8 px-2 sm:h-9 sm:px-3 text-[10px] sm:text-xs font-bold rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl flex items-center gap-1 border border-emerald-400/30 shrink-0"
            >
              <span className="hidden sm:inline">Co-Host Seats</span>
              <span className="sm:hidden">Guests</span>
              <Badge className="bg-white text-emerald-800 font-extrabold text-[9px] sm:text-[10px] px-1.5 py-0 rounded-full">
                {coHostRequests.filter(r => r.status === 'pending').length}
              </Badge>
            </Button>
          )}

          {/* 🏆 Top Gifters Podium Button */}
          <button
            type="button"
            onClick={() => setIsContributorsModalOpen(true)}
            title="Top Contributors & Leaderboard"
            className="flex items-center gap-1 bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-amber-500/40 text-white text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full shadow-xl transition-all transform hover:scale-105 active:scale-95 shrink-0"
          >
            <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400 shrink-0" />
            {contributors.length === 0 ? (
              <span className="text-amber-300 text-[10px] sm:text-[11px] font-semibold hidden sm:inline">Top Gifters</span>
            ) : (
              <div className="flex items-center -space-x-1.5">
                {contributors.slice(0, 3).map((c, idx) => (
                  <div key={c.uid} className="relative">
                    <Avatar className={`h-5 w-5 sm:h-6 sm:w-6 border-2 ${
                      idx === 0 ? 'border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : idx === 1 ? 'border-slate-300' : 'border-amber-700'
                    } shadow shrink-0`}>
                      <AvatarImage src={c.avatarUrl} alt={c.name} />
                      <AvatarFallback className="bg-indigo-600 text-[7px] sm:text-[8px] font-bold text-white">
                        {c.name ? c.name.charAt(0) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 text-[7px] sm:text-[8px] leading-none pointer-events-none">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </button>

          {/* Real-Time Viewer Count */}
          <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-white/15 text-slate-100 text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full shadow-xl shrink-0">
            <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-400" />
            <span>{viewerCount}</span>
            <span className="hidden sm:inline">{viewerCount === 1 ? 'viewer' : 'viewers'}</span>
          </div>

          {/* 🔗 1-Tap Share Live Stream Link Button */}
          <button
            type="button"
            onClick={handleShareLiveStream}
            title="Share Live Stream Link"
            className="flex items-center gap-1 bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md border border-indigo-400/40 text-white text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full shadow-xl transition-all active:scale-95 shrink-0"
          >
            <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
            <span className="hidden sm:inline">Share</span>
          </button>


          {/* 🔴 Phone-Adjusted End Live / Leave Button */}
          <Button
            size="sm"
            onClick={() => {
              if (isHost) {
                setIsEndConfirmModalOpen(true);
              } else {
                handleEndStream();
              }
            }}
            className={`h-8 px-2.5 sm:h-9 sm:px-3.5 text-[11px] sm:text-xs font-black rounded-full shadow-2xl transition-all flex items-center gap-1 border shrink-0 z-10 active:scale-95 ${
              isHost
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border-rose-400/50 shadow-rose-600/30'
                : 'bg-slate-800/95 hover:bg-slate-700 text-slate-100 border-white/20'
            }`}
          >
            <Power className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
            <span>{isHost ? 'End' : 'Leave'}</span>
            <span className="hidden sm:inline">{isHost ? ' Stream' : ''}</span>
          </Button>
        </div>
      </div>

      {/* 👑 #1 Top Gifter Crown Takeover Banner */}
      {leaderboardBanner && (
        <div className="absolute top-16 left-4 right-4 z-40 pointer-events-none flex justify-center animate-crown-takeover">
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black font-black text-xs md:text-sm px-5 py-2.5 rounded-full shadow-[0_0_35px_rgba(245,158,11,0.9)] border-2 border-white flex items-center gap-2 max-w-md truncate">
            <Crown className="h-5 w-5 fill-black text-black shrink-0 animate-bounce" />
            <span className="truncate">
              NEW #1 GIFTER! <strong>@{leaderboardBanner.name}</strong> claimed the Crown with {leaderboardBanner.coins.toLocaleString()} L!
            </span>
            <span className="shrink-0 text-base">👑</span>
          </div>
        </div>
      )}

      {/* ⚔️ Lonkind 1v1 PK Battle Top Progress Bar Widget + Timer + 2X Booster + Penalty Wheel */}
      {pkBattleScore.active && (
        <div className="absolute top-16 left-4 right-4 z-30 flex flex-col items-center pointer-events-auto max-w-md mx-auto">
          <div className={`w-full bg-slate-950/90 backdrop-blur-md border ${isPkBoosterActive ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)]' : 'border-white/20'} rounded-2xl p-2.5 shadow-2xl transition-all`}>
            <div className="flex items-center justify-between text-xs font-black mb-1.5 px-1 gap-1">
              <div className="flex items-center gap-1.5 text-blue-400 min-w-0">
                <Avatar className="h-5 w-5 border border-blue-400 shrink-0">
                  <AvatarImage src={userAvatar} alt={validUserName} />
                  <AvatarFallback className="bg-blue-600 text-white text-[9px]">{validUserName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[70px] sm:max-w-[90px]">{validUserName}</span>
                <Badge className="bg-blue-600/80 text-white font-black text-[10px] px-1.5 py-0 shrink-0">{pkBattleScore.host1Score.toLocaleString()}</Badge>
              </div>

              <button
                type="button"
                onClick={() => setIsPkModalOpen(true)}
                title="Open PK Battle MVP & Loser Penalty Spin Wheel"
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-white font-black text-[10px] tracking-wider shadow-md shrink-0 transition-transform hover:scale-105 ${
                  isPkBoosterActive
                    ? 'bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 animate-pulse'
                    : 'bg-gradient-to-r from-blue-600 via-purple-600 to-rose-600'
                }`}
              >
                <span>{isPkBoosterActive ? '🔥 2X PK' : '⚔️ PK'}</span>
                <span className="font-mono bg-black/40 px-1.5 rounded text-amber-300">
                  {Math.floor(pkTimeLeft / 60)}:{String(pkTimeLeft % 60).padStart(2, '0')}
                </span>
                <span>🎡</span>
              </button>

              <div className="flex items-center gap-1.5 text-rose-400 min-w-0">
                <Badge className="bg-rose-600/80 text-white font-black text-[10px] px-1.5 py-0 shrink-0">{pkBattleScore.host2Score.toLocaleString()}</Badge>
                <span className="truncate max-w-[70px] sm:max-w-[90px]">Challenger</span>
                <Avatar className="h-5 w-5 border border-rose-400 shrink-0">
                  <AvatarFallback className="bg-rose-600 text-white text-[9px]">CH</AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Dual PK Progress Bar */}
            <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden flex border border-white/10 shadow-inner">
              <div 
                style={{ width: `${Math.max(10, Math.min(90, (pkBattleScore.host1Score / (pkBattleScore.host1Score + pkBattleScore.host2Score || 1)) * 100))}%` }}
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 relative"
              >
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 animate-pulse" />
              </div>
              <div 
                style={{ width: `${100 - Math.max(10, Math.min(90, (pkBattleScore.host1Score / (pkBattleScore.host1Score + pkBattleScore.host2Score || 1)) * 100))}%` }}
                className="h-full bg-gradient-to-r from-pink-500 to-rose-600 transition-all duration-500"
              />
            </div>

            {/* PK Sub-Bar Quick Actions */}
            <div className="flex items-center justify-between text-[10px] text-slate-300 mt-1 px-1">
              <button
                type="button"
                onClick={() => setPkTimeLeft((t) => (t > 60 ? 59 : 180))}
                className="text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                <Flame className="h-3 w-3 text-amber-400" />
                <span>{isPkBoosterActive ? '🔥 2X Points Active!' : 'Activate 2X Final Minute'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPkModalOpen(true)}
                className="text-indigo-300 hover:text-white font-bold hover:underline"
              >
                MVP &amp; Penalty Wheel 🎡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 Creator Stream Goal Progress Meter */}
      {streamGoal?.enabled && (
        <div className={`absolute ${pkBattleScore.active ? 'top-36' : 'top-16'} left-4 right-4 z-20 flex justify-center pointer-events-auto`}>
          <div className="bg-slate-950/85 backdrop-blur-md border border-white/20 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-sm w-full">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <div className="flex items-center gap-1.5 text-white truncate max-w-[190px]">
                <Target className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{streamGoal.title}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-[11px]">
                {streamGoal.currentCoins >= streamGoal.targetCoins ? (
                  <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white font-extrabold text-[10px] px-2 py-0 animate-pulse border-none shadow-md">
                    🎉 ACHIEVED!
                  </Badge>
                ) : (
                  <span className="font-mono text-amber-400 font-extrabold">
                    {streamGoal.currentCoins.toLocaleString()} / {streamGoal.targetCoins.toLocaleString()} L
                  </span>
                )}
              </div>
            </div>

            {/* Progress Bar Track */}
            <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10 shadow-inner">
              <div
                style={{
                  width: `${Math.min(100, Math.round(((streamGoal.currentCoins || 0) / (streamGoal.targetCoins || 1)) * 100))}%`,
                }}
                className={`h-full transition-all duration-500 ${
                  streamGoal.currentCoins >= streamGoal.targetCoins
                    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                    : 'bg-gradient-to-r from-rose-500 via-amber-500 to-yellow-400'
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
              <span>{Math.min(100, Math.round(((streamGoal.currentCoins || 0) / (streamGoal.targetCoins || 1)) * 100))}% complete</span>
              <button
                type="button"
                onClick={() => setIsGiftModalOpen(true)}
                className="text-amber-400 hover:text-amber-300 font-bold hover:underline"
              >
                Contribute Gift 🎁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎁 Floating Live Stream Treasure Chest ("Lucky Coin Drop") Widget */}
      {treasureChest && (
        <div className="absolute top-40 right-4 z-40 pointer-events-auto animate-in zoom-in-95 duration-300">
          <button
            type="button"
            disabled={treasureCountdown > 0 || claimedChestId === treasureChest.id}
            onClick={handleClaimTreasureChest}
            className={`flex flex-col items-center p-3 rounded-2xl border-2 shadow-2xl transition-all ${
              claimedChestId === treasureChest.id
                ? 'bg-slate-900/90 border-emerald-500/50 opacity-80'
                : treasureCountdown === 0
                ? 'bg-gradient-to-b from-amber-500 via-yellow-500 to-amber-600 border-white text-black animate-bounce shadow-[0_0_35px_rgba(245,158,11,0.95)] cursor-pointer'
                : 'bg-slate-950/90 border-amber-400/70 text-white shadow-[0_0_25px_rgba(245,158,11,0.4)]'
            }`}
          >
            <span className="text-3xl mb-1">{claimedChestId === treasureChest.id ? '✅' : '🎁'}</span>
            <span className="text-[10px] font-black uppercase tracking-wider">
              {claimedChestId === treasureChest.id
                ? 'Claimed!'
                : treasureCountdown > 0
                ? `Opens ${treasureCountdown}s`
                : 'TAP TO CLAIM!'}
            </span>
            <span className={`text-[9px] font-bold truncate max-w-[90px] ${treasureCountdown === 0 && claimedChestId !== treasureChest.id ? 'text-black/80' : 'text-amber-300'}`}>
              By @{treasureChest.senderName}
            </span>
          </button>
        </div>
      )}

      {/* 👑 Luxury VIP Entrance Real HD .MP4 Video Banner (When a VIP 3–10 Joins the Stream) */}
      {vipEntranceBanner && (
        <div className="absolute top-24 left-4 right-4 z-40 pointer-events-none flex justify-center animate-in slide-in-from-left duration-500">
          <div className={`bg-gradient-to-r ${vipEntranceBanner.color} p-0.5 rounded-3xl shadow-[0_0_45px_rgba(245,158,11,0.85)] max-w-md w-full`}>
            <div className="bg-slate-950/95 backdrop-blur-md rounded-[22px] p-2.5 flex items-center gap-3">
              <div className="relative w-16 h-14 rounded-2xl overflow-hidden border-2 border-amber-400 shrink-0 bg-black">
                <video
                  src={vipEntranceBanner.videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    {vipEntranceBanner.badge}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider truncate">
                    {vipEntranceBanner.title}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-black text-white truncate mt-0.5">
                  @{vipEntranceBanner.name} has arrived!
                </span>
                <span className="text-[10px] text-slate-300 font-semibold truncate">
                  Riding in on a <strong>{vipEntranceBanner.vehicle}</strong> ✨
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-In Standard Viewer Entrance Banner */}
      {entranceBanner && !vipEntranceBanner && (
        <div className="absolute top-20 left-4 z-40 bg-emerald-600/95 text-white font-extrabold text-xs backdrop-blur-md shadow-2xl rounded-full px-4 py-2 flex items-center gap-2 border border-emerald-400/40 animate-in slide-in-from-left duration-300">
          <span className="text-base">✨</span>
          <span><strong>@{entranceBanner.name}</strong> joined the live!</span>
        </div>
      )}

      {/* TikTok-Style Dual Stacked Combo Slots + Priority Gift Queue HUD */}
      {sideComboSlots.length > 0 && (
        <div className="absolute top-28 left-4 z-40 pointer-events-none flex flex-col gap-2">
          {sideComboSlots.map((slot) => (
            <div
              key={slot.queueId}
              className="bg-gradient-to-r from-amber-500/95 via-purple-600/90 to-pink-600/90 backdrop-blur-md border border-white/30 rounded-full pl-1.5 pr-4 py-1.5 shadow-[0_0_25px_rgba(236,72,153,0.5)] flex items-center gap-2.5 animate-in slide-in-from-left duration-200"
            >
              <Avatar className="h-9 w-9 border-2 border-white/60 shadow shrink-0">
                <AvatarImage src={slot.senderAvatar} alt={slot.senderName} />
                <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                  {slot.senderName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-extrabold text-white truncate max-w-[165px]">
                  {slot.displaySenderLabel}
                </span>
                <span className="text-[10px] text-amber-200 font-semibold truncate">
                  sent <strong>{slot.giftName}</strong> {slot.giftIcon}
                </span>
              </div>
              <div className="flex items-center gap-0.5 bg-amber-400 text-black font-black text-sm px-2.5 py-0.5 rounded-full shadow-lg">
                <Flame className="h-3.5 w-3.5 fill-rose-600 text-rose-600" />
                <span>x{slot.combo}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🦁👑 SINGLE-STAGE QUEUED FULLSCREEN GIFT RENDERER (Never stacks 50 heavy animations on top of each other) */}
      <div data-live-gift-stage="active" className="hidden" aria-hidden="true" />
      {queuedActiveGift?.giftId === 'lion' && (
        <GoldenLionSvgGift
          key={queuedActiveGift.queueId}
          senderName={queuedActiveGift.displaySenderLabel}
          senderAvatar={queuedActiveGift.senderAvatar}
          combo={queuedActiveGift.combo}
          onComplete={completeActiveGift}
        />
      )}

      {queuedActiveGift?.giftId === 'crown' && (
        <RoyalCrownSvgGift
          key={queuedActiveGift.queueId}
          senderName={queuedActiveGift.displaySenderLabel}
          senderAvatar={queuedActiveGift.senderAvatar}
          combo={queuedActiveGift.combo}
          onComplete={completeActiveGift}
        />
      )}

      {queuedActiveGift?.giftId === 'universe' && (
        <UniverseGift
          senderName={queuedActiveGift.displaySenderLabel}
          senderAvatar={queuedActiveGift.senderAvatar}
          combo={queuedActiveGift.combo}
          onComplete={completeActiveGift}
        />
      )}

      {queuedActiveGift &&
        queuedActiveGift.giftId !== 'lion' &&
        queuedActiveGift.giftId !== 'crown' &&
        queuedActiveGift.giftId !== 'universe' && (
          <GiftTakeoverEngine
            event={{
              id: queuedActiveGift.queueId,
              giftId: queuedActiveGift.giftId,
              giftName: queuedActiveGift.giftName,
              price: queuedActiveGift.price,
              senderName: queuedActiveGift.displaySenderLabel,
              senderAvatar: queuedActiveGift.senderAvatar,
              combo: queuedActiveGift.combo,
              videoUrl: queuedActiveGift.webmUrl || queuedActiveGift.videoUrl,
              lottieUrl: queuedActiveGift.lottieUrl,
            }}
            onComplete={completeActiveGift}
          />
        )}

      {/* Direct Manual Override Overlays (from Custom Asset Injector) */}
      {activeKingLionGift && !queuedActiveGift && (
        <GoldenLionSvgGift
          senderName={activeKingLionGift.senderName}
          senderAvatar={activeKingLionGift.senderAvatar}
          combo={activeKingLionGift.combo}
          onComplete={() => setActiveKingLionGift(null)}
        />
      )}

      {activeUniverseGift && !queuedActiveGift && (
        <UniverseGift
          senderName={activeUniverseGift.senderName}
          senderAvatar={activeUniverseGift.senderAvatar}
          combo={activeUniverseGift.combo}
          onComplete={() => setActiveUniverseGift(null)}
        />
      )}

      {customTakeoverEvent && !queuedActiveGift && (
        <GiftTakeoverEngine
          event={customTakeoverEvent}
          onComplete={() => setCustomTakeoverEvent(null)}
        />
      )}

      {/* TikTok-Style Screen Tap Floating Hearts Overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {floatingLikes.map((like) => (
          <div
            key={like.id}
            style={{ left: `${like.xPercent}%`, bottom: '15%' }}
            className="absolute text-4xl animate-float-up filter drop-shadow-[0_5px_10px_rgba(0,0,0,0.4)]"
          >
            {like.emoji}
          </div>
        ))}
      </div>

      {/* Floating Semi-Transparent Live Chat Overlay (Positioned above Zego bottom control bar) */}
      <div className="absolute bottom-20 left-3 right-3 sm:left-4 sm:right-auto sm:w-80 md:left-auto md:right-6 md:bottom-20 md:w-80 max-h-[30vh] md:max-h-[340px] z-20 flex flex-col bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-2.5 sm:p-3 pointer-events-auto">
        {/* Chat Header */}
        <div className="flex items-center gap-2 px-2 pb-2 border-b border-white/10 mb-2 shrink-0">
          <MessageSquare className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold text-white tracking-wide uppercase">Live Chat</span>
          
          <div className="ml-auto flex items-center gap-1.5">
            {isHost && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsPinModalOpen(true)}
                title={pinnedComment ? 'Edit Pinned Notice' : 'Pin Host Notice'}
                className="h-7 px-2 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 rounded-full border border-amber-500/30 flex items-center gap-1"
              >
                <Pin className="h-3 w-3" />
                <span>{pinnedComment ? 'Notice' : 'Pin'}</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (isGuest) {
                  toast({
                    title: '🎁 Sign Up to Send Gifts',
                    description: 'Create your account to send virtual gifts!',
                  });
                  onRequireAuth?.();
                  return;
                }
                setIsGiftModalOpen(true);
              }}
              className="h-7 px-2.5 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-[11px] rounded-full shadow-md flex items-center gap-1.5 border border-white/20 transform hover:scale-105 transition-all"
            >
              <Gift className="h-3.5 w-3.5" />
              Send Gift
            </Button>
          </div>
        </div>

        {/* Guest Viewer 1-Tap Sign-Up Banner */}
        {isGuest && (
          <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 border border-indigo-400/50 text-xs text-white shrink-0 shadow-lg flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-extrabold text-[11px] text-amber-300 leading-tight">
                ✨ Join the Live Conversation!
              </p>
              <p className="text-[10px] text-slate-200 leading-tight mt-0.5">
                Sign up to chat live &amp; support the creator
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onRequireAuth?.()}
              className="h-7 px-3 bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] rounded-full shrink-0 shadow"
            >
              Sign Up
            </Button>
          </div>
        )}

        {/* 📌 Pinned Announcement Sticky Notice */}
        {pinnedComment && (
          <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-purple-500/20 border border-amber-400/40 text-xs text-white shrink-0 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-[10px] font-black text-amber-300 uppercase tracking-wider">
                <Pin className="h-3 w-3 text-amber-400" />
                <span>Host Notice</span>
              </div>
              {isHost && (
                <button
                  type="button"
                  onClick={handleUnpinNotice}
                  title="Unpin Announcement"
                  className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors"
                >
                  <PinOff className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-100 leading-snug break-words font-medium">
              {pinnedComment.text}
            </p>
          </div>
        )}

        {/* Message Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar min-h-[64px]">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-6">
              Welcome to the live stream! Say hello 👋
            </div>
          ) : (
            messages.map((msg) => {
              const isVipMsg = (msg.vipLevel || 0) >= 3;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 text-xs ${
                    isVipMsg
                      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-purple-500/20 border border-amber-400/50 rounded-xl p-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : ''
                  }`}
                >
                  <Avatar className={`h-6 w-6 shrink-0 mt-0.5 ${isVipMsg ? 'border-2 border-amber-400' : 'border border-white/10'}`}>
                    <AvatarImage src={msg.senderAvatar} alt={msg.senderName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                      {msg.senderName ? msg.senderName.charAt(0) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {msg.vipBadge && (
                        <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase shadow">
                          {msg.vipBadge}
                        </span>
                      )}
                      <span className={`font-bold truncate text-[11px] ${isVipMsg ? 'text-amber-300' : 'text-indigo-300'}`}>
                        {msg.senderName}
                      </span>
                    </div>
                    {msg.type === 'gift' ? (
                      <span className="inline-flex items-center gap-1 text-amber-200 font-bold bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-400/40 text-[11px] mt-0.5">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        {msg.text}
                      </span>
                    ) : (
                      <span className={`${isVipMsg ? 'text-amber-50 font-semibold' : 'text-slate-100'} break-words leading-relaxed`}>
                        {msg.text}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10 shrink-0 mt-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => {
              if (isGuest) {
                toast({
                  title: '💬 Sign Up to Chat Live',
                  description: 'Create your account to chat live on the stream!',
                });
                onRequireAuth?.();
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isGuest ? 'Tap to join free & chat live...' : 'Type a message...'}
            className="h-9 text-xs bg-white/10 border-white/10 text-white placeholder:text-slate-400 rounded-xl focus-visible:ring-indigo-500"
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={(!inputText.trim() && !isGuest) || isSending}
            className="h-9 w-9 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Native WebRTC Bottom Live Control Bar (Mic, Camera, Flip Camera, Gift, Like) */}
      <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-center gap-2 pointer-events-auto">
        <div className="bg-slate-950/85 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2">
          {(isHost || isCoHostAccepted) && (
            <>
              <button
                type="button"
                onClick={handleToggleLiveMic}
                className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isMicEnabled
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
                }`}
              >
                {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span className="hidden xs:inline">{isMicEnabled ? 'Mic' : 'Muted'}</span>
              </button>

              {streamMode === 'video' && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleLiveCamera}
                    className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isCameraEnabled
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    <span className="hidden xs:inline">{isCameraEnabled ? 'Cam' : 'Off'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    title="Flip Front/Back Camera"
                    className="h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Flip</span>
                  </button>
                </>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                toast({
                  title: '🎁 Sign Up to Send Gifts',
                  description: 'Create your account to send virtual gifts!',
                });
                onRequireAuth?.();
                return;
              }
              setIsGiftModalOpen(true);
            }}
            className="h-9 px-4 rounded-full bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs shadow-lg flex items-center gap-1.5 border border-white/20 active:scale-95 transition-all"
          >
            <Gift className="h-4 w-4" />
            <span>Gifts</span>
          </button>

          <button
            type="button"
            onClick={handleScreenTap}
            title="Send Heart"
            className="h-9 w-9 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/40 text-rose-300 flex items-center justify-center active:scale-90 transition-all"
          >
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
          </button>
        </div>
      </div>

      {/* Send Virtual Gift Modal / Bottom Drawer */}
      {isGiftModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-slate-950 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Send Gift</h3>
              </div>
              
              {/* Lonkind Coin Balance Badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold text-indigo-300">
                  <span className="h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">L</span>
                  <span>{userCoins.toLocaleString()} Coins</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsGiftModalOpen(false);
                    if (onGoToWallet) onGoToWallet();
                    else window.location.href = '/?view=wallet';
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 rounded-full border border-amber-500/30"
                  title="Buy coins"
                >
                  Buy Coins
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsGiftModalOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Active Admin Special Event Banner inside Gift Drawer */}
            {activePlatformEvent?.eventActive && (
              <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-pink-600/20 via-purple-600/20 to-amber-500/20 border border-pink-500/40 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <div className="text-xs font-extrabold text-pink-300 flex items-center gap-1.5">
                    <span>🎉 {activePlatformEvent.eventTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {activePlatformEvent.eventBannerText || 'Special live event active now!'}
                  </p>
                </div>
                {activePlatformEvent.freeGiftId && (
                  <Badge className="bg-emerald-500 text-black font-black text-[10px] shrink-0">
                    {Math.max(0, (activePlatformEvent.freeGiftDailyLimit || 3) - freeEventGiftSentCount)} FREE LEFT
                  </Badge>
                )}
              </div>
            )}

            {/* Gift Cards Grid */}
            {GIFT_CATALOG.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
                  <Gift className="h-7 w-7" />
                </div>
                <p className="text-sm font-bold text-white mb-1">No Gifts Available Yet</p>
                <p className="text-xs text-slate-400">
                  All previous gifts have been wiped. New gifts will appear here soon!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto pr-1 no-scrollbar p-1 mb-3">
                {GIFT_CATALOG.map((gift) => {
                  const activeTapCombo =
                    pendingTapBatch && pendingTapBatch.giftId === gift.id
                      ? pendingTapBatch.comboCount
                      : 0;
                  const isFreeEventGift =
                    activePlatformEvent?.eventActive &&
                    activePlatformEvent.freeGiftId === gift.id &&
                    freeEventGiftSentCount < (activePlatformEvent.freeGiftDailyLimit || 3);
                  return (
                    <button
                      key={gift.id}
                      disabled={isSending}
                      onClick={() => handleSendGift(gift)}
                      className={`flex flex-col items-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border ${
                        isFreeEventGift
                          ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                          : activeTapCombo > 0
                          ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105'
                          : gift.isSuper
                          ? 'border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'border-white/10 hover:border-cyan-400/50'
                      } transition-all group text-center transform hover:scale-105 active:scale-95 disabled:opacity-50 relative`}
                    >
                      {isFreeEventGift && (
                        <span className="absolute -top-1.5 -left-1 z-10 bg-emerald-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow tracking-wider">
                          FREE EVENT
                        </span>
                      )}
                      {activeTapCombo > 0 && (
                        <span className="absolute -top-1.5 -right-1 z-10 bg-gradient-to-r from-cyan-400 to-amber-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow tracking-wider">
                          x{activeTapCombo}
                        </span>
                      )}
                      {gift.badgeTag && activeTapCombo === 0 && (
                        <span className="absolute -top-1.5 -right-1 z-10 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow tracking-wider">
                          {gift.badgeTag}
                        </span>
                      )}
                      <div className="w-16 h-16 mb-1.5 flex items-center justify-center rounded-xl overflow-hidden bg-slate-950 border border-amber-400/50 shadow-md group-hover:scale-110 transition-transform relative">
                        {gift.id === 'lion' ? (
                          <GoldenLionSvgPreview className="w-14 h-14" />
                        ) : gift.id === 'crown' ? (
                          <RoyalCrownSvgPreview className="w-14 h-14" />
                        ) : gift.previewGifUrl || gift.image3d ? (
                          <img
                            src={gift.previewGifUrl || gift.image3d}
                            alt={gift.name}
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (gift.image3d && target.src !== gift.image3d) {
                                target.src = gift.image3d;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
                            {gift.icon}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-white text-xs mb-1 truncate w-full">{gift.name}</span>
                      {isFreeEventGift ? (
                        <Badge className="bg-emerald-500 text-black font-black text-[10px] px-2 py-0.5 rounded-full border-none shadow-sm">
                          FREE 🎁
                        </Badge>
                      ) : (
                        <Badge className={`bg-gradient-to-r ${gift.color} text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border-none shadow-sm flex items-center gap-1`}>
                          <span className="font-black">L</span> {gift.price.toLocaleString()}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insufficient Lonkind Coins / Recharge Prompt Modal */}
      {rechargeModalGift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-white/15 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="h-14 w-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-black text-indigo-400">L</span>
            </div>

            <h3 className="font-extrabold text-white text-lg mb-2">Insufficient Lonkind Coins</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              You need <strong className="text-indigo-400">{rechargeModalGift.price.toLocaleString()} Lonkind Coins (L)</strong> to send <span className="text-white font-bold">{rechargeModalGift.name} {rechargeModalGift.icon}</span>, but you currently have <strong className="text-white">{userCoins.toLocaleString()} Coins</strong>.
            </p>

            {/* First Purchase Promotional Banner */}
            <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 border border-amber-500/30 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🎁</span>
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">First Purchase Special</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Get up to <strong className="text-amber-400 font-extrabold">+20% Bonus Coins</strong> on your first coin purchase!
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setRechargeModalGift(null)}
                className="w-1/2 border-white/15 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-bold h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setRechargeModalGift(null);
                  setIsGiftModalOpen(false);
                  if (onGoToWallet) {
                    onGoToWallet();
                  } else {
                    window.location.href = '/?view=wallet';
                  }
                }}
                className="w-1/2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:opacity-95 text-white font-extrabold rounded-xl text-xs h-11 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-1.5"
              >
                <span>Buy Coins</span>
                <span className="bg-white/20 text-[9px] font-black px-1.5 py-0.5 rounded-full">+20%</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Host Co-Host Seat Management Modal */}
      {isHostRequestsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-white/15 rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <span>✨ Co-Host Guest Requests</span>
                <Badge className="bg-emerald-600 text-white font-black text-xs px-2 py-0.5">
                  {coHostRequests.filter(r => r.status === 'pending').length} pending
                </Badge>
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsHostRequestsModalOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
              {coHostRequests.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-6">
                  No pending guest requests right now. Viewers on phone or PC can tap "Request Co-Host" to join your live!
                </p>
              ) : (
                coHostRequests.filter(r => r.status === 'pending').map((req) => (
                  <div key={req.id} className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9 border border-emerald-400/40">
                        <AvatarImage src={req.avatarUrl} alt={req.name} />
                        <AvatarFallback className="bg-emerald-600 text-white text-xs">{req.name ? req.name.charAt(0) : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">@{req.name}</span>
                        <span className="text-[10px] text-emerald-400 font-medium">Wants to join split-screen</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => handleDeclineCoHostRequest(req.uid)}
                        variant="ghost"
                        className="h-8 px-2.5 text-xs text-rose-400 hover:bg-rose-500/20 rounded-xl font-bold"
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptCoHostRequest(req.uid, req.name)}
                        className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md"
                      >
                        Accept ✓
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🏆 Top Contributors Modal */}
      {isContributorsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-white/15 rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Top Contributors</h3>
                  <p className="text-[11px] text-slate-400">
                    Top gifters supporting this live stream
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsContributorsModalOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {contributors.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center">
                <div className="h-14 w-14 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mb-3 shadow-inner">
                  👑
                </div>
                <h4 className="text-sm font-bold text-white mb-1">No Gifters Yet</h4>
                <p className="text-xs text-slate-400 max-w-xs mb-4">
                  Be the first to send a gift and claim the #1 Crown on the podium!
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsContributorsModalOpen(false);
                    setIsGiftModalOpen(true);
                  }}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold text-xs rounded-xl shadow-lg h-10 px-5"
                >
                  Send First Gift 🎁
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
                {/* 🥇 🥈 🥉 3D-Style Podium Stage (Fetched via ZREVRANGE 0 2 WITHSCORES) */}
                <div className="pt-4 pb-2 px-1 flex items-end justify-center gap-2 sm:gap-3 border-b border-white/10">
                  {/* 2nd Place (Silver) */}
                  <div className="flex flex-col items-center flex-1 max-w-[105px]">
                    {contributors[1] ? (
                      <>
                        <div className="relative mb-2">
                          <Avatar className="h-12 w-12 border-2 border-slate-300 shadow-md">
                            <AvatarImage src={contributors[1].avatarUrl} alt={contributors[1].name} />
                            <AvatarFallback className="bg-slate-700 text-white font-bold text-xs">
                              {contributors[1].name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 bg-slate-300 text-slate-900 text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow">
                            2
                          </span>
                        </div>
                        <span className="text-xs font-bold text-white truncate max-w-full text-center">
                          {contributors[1].name}
                        </span>
                        <span className="text-[10px] font-mono font-extrabold text-slate-300">
                          {contributors[1].totalCoins.toLocaleString()} L
                        </span>
                        <div className="w-full h-14 bg-gradient-to-t from-slate-800 to-slate-700/60 rounded-t-xl mt-2 flex items-center justify-center font-black text-slate-300 text-xs border-t border-slate-400/40">
                          🥈 2nd
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-24 flex flex-col items-center justify-end opacity-40">
                        <span className="text-[10px] text-slate-500 mb-1">Open</span>
                        <div className="w-full h-14 bg-slate-900 rounded-t-xl border-t border-white/5 flex items-center justify-center text-[11px] text-slate-600">
                          🥈
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1st Place (Center, tallest, Gold) */}
                  <div className="flex flex-col items-center flex-1 max-w-[115px]">
                    {contributors[0] ? (
                      <>
                        <div className="relative mb-2">
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-base animate-bounce">
                            👑
                          </div>
                          <Avatar className="h-14 w-14 border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                            <AvatarImage src={contributors[0].avatarUrl} alt={contributors[0].name} />
                            <AvatarFallback className="bg-amber-600 text-white font-black text-sm">
                              {contributors[0].name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 bg-amber-400 text-black text-[11px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow">
                            1
                          </span>
                        </div>
                        <span className="text-xs font-black text-amber-300 truncate max-w-full text-center">
                          {contributors[0].name}
                        </span>
                        <span className="text-[11px] font-mono font-black text-amber-400">
                          {contributors[0].totalCoins.toLocaleString()} L
                        </span>
                        <div className="w-full h-20 bg-gradient-to-t from-amber-600/40 to-amber-500/20 rounded-t-xl mt-2 flex items-center justify-center font-black text-amber-300 text-xs border-t-2 border-amber-400 shadow-lg">
                          🥇 1st
                        </div>
                      </>
                    ) : null}
                  </div>

                  {/* 3rd Place (Bronze) */}
                  <div className="flex flex-col items-center flex-1 max-w-[105px]">
                    {contributors[2] ? (
                      <>
                        <div className="relative mb-2">
                          <Avatar className="h-12 w-12 border-2 border-amber-700 shadow-md">
                            <AvatarImage src={contributors[2].avatarUrl} alt={contributors[2].name} />
                            <AvatarFallback className="bg-amber-900 text-white font-bold text-xs">
                              {contributors[2].name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 bg-amber-700 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow">
                            3
                          </span>
                        </div>
                        <span className="text-xs font-bold text-white truncate max-w-full text-center">
                          {contributors[2].name}
                        </span>
                        <span className="text-[10px] font-mono font-extrabold text-amber-500">
                          {contributors[2].totalCoins.toLocaleString()} L
                        </span>
                        <div className="w-full h-10 bg-gradient-to-t from-amber-950/60 to-amber-900/40 rounded-t-xl mt-2 flex items-center justify-center font-black text-amber-600 text-xs border-t border-amber-700/40">
                          🥉 3rd
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-20 flex flex-col items-center justify-end opacity-40">
                        <span className="text-[10px] text-slate-500 mb-1">Open</span>
                        <div className="w-full h-10 bg-slate-900 rounded-t-xl border-t border-white/5 flex items-center justify-center text-[11px] text-slate-600">
                          🥉
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ranks 4+ List */}
                <div className="space-y-1.5 pt-1">
                  {contributors.slice(3).map((c, idx) => (
                    <div
                      key={c.uid}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-400 w-5 text-center">
                          #{idx + 4}
                        </span>
                        <Avatar className="h-7 w-7 border border-white/10">
                          <AvatarImage src={c.avatarUrl} alt={c.name} />
                          <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                            {c.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-white truncate max-w-[160px]">
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono font-extrabold text-amber-400">
                        <span>{c.totalCoins.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">L</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 shrink-0 flex items-center justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setIsContributorsModalOpen(false);
                  setIsGiftModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl h-8 px-3"
              >
                Send Gift 🎁
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 📌 Host Pin Announcement Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-white/15 rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
                  <Pin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Pin Stream Announcement</h3>
                  <p className="text-[11px] text-slate-400">Stays pinned at the top of the chat</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPinModalOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3.5 mb-5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Notice Text</label>
                <Input
                  type="text"
                  value={pinInputText}
                  onChange={(e) => setPinInputText(e.target.value)}
                  maxLength={140}
                  placeholder="e.g. Welcome everyone! Drop your song requests below 🎸"
                  className="bg-slate-900 border-white/15 text-white placeholder:text-slate-500 rounded-xl h-11 text-xs focus:border-amber-500"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block mb-1.5">Quick Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Welcome everyone! Say hi in chat 👋',
                    'Subathon in progress! Goal reward at 5k coins 🎁',
                    'Q&A Session: Drop your questions below 👇',
                    'Follow my profile for daily live alerts! ✨',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPinInputText(preset)}
                      className="text-[10px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white px-2.5 py-1 rounded-full text-left transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              {pinnedComment && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await handleUnpinNotice();
                    setIsPinModalOpen(false);
                  }}
                  className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-bold rounded-xl h-10 px-4"
                >
                  Unpin Current
                </Button>
              )}
              <Button
                type="button"
                disabled={!pinInputText.trim()}
                onClick={handleSavePinnedNotice}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold text-xs rounded-xl h-10 px-5 shadow-lg"
              >
                Pin Notice 📌
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 Host End Stream Confirmation Modal */}
      {isEndConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="h-14 w-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto mb-3 shadow-inner">
              <Power className="h-7 w-7 animate-pulse" />
            </div>
            <h3 className="font-black text-white text-base sm:text-lg mb-1.5">End Live Stream?</h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Are you sure you want to end your broadcast? This will disconnect all active viewers and conclude your stream across Lonkind.
            </p>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={() => setIsEndConfirmModalOpen(false)}
                className="w-1/2 border-white/15 text-slate-300 hover:text-white hover:bg-white/10 text-xs font-bold rounded-xl h-11"
              >
                Continue Live
              </Button>
              <Button
                onClick={() => {
                  setIsEndConfirmModalOpen(false);
                  handleEndStream();
                }}
                className="w-1/2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs rounded-xl h-11 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
              >
                End Now 🔴
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ⚔️ PK Battle MVP Gifter Spotlight & Loser Penalty Spin Wheel Modal */}
      {isPkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-amber-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(245,158,11,0.35)] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚔️</span>
                <div>
                  <h3 className="font-black text-white text-base">PK Battle Arena &amp; Penalty Wheel</h3>
                  <p className="text-[11px] text-amber-300 font-semibold">
                    {pkBattleScore.host1Score >= pkBattleScore.host2Score
                      ? `🏆 ${validUserName} is Leading (${pkBattleScore.host1Score.toLocaleString()} vs ${pkBattleScore.host2Score.toLocaleString()})`
                      : `🔥 Challenger is Leading (${pkBattleScore.host2Score.toLocaleString()} vs ${pkBattleScore.host1Score.toLocaleString()})`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPkModalOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* #1 MVP Gifter Spotlight Card */}
            <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-purple-600/20 border border-amber-400/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12 border-2 border-amber-400 shadow-lg">
                    <AvatarImage src={contributors[0]?.avatarUrl} alt={contributors[0]?.name || 'MVP'} />
                    <AvatarFallback className="bg-amber-600 text-black font-black text-sm">
                      {contributors[0]?.name ? contributors[0].name.charAt(0) : '👑'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -top-2 -right-1 text-base">👑</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block">
                    PK BATTLE #1 MVP PROTECTOR
                  </span>
                  <span className="text-sm font-black text-white">
                    {contributors[0] ? `@${contributors[0].name}` : 'No MVP Yet — Send a Gift!'}
                  </span>
                  {contributors[0] && (
                    <span className="block text-[11px] font-mono font-bold text-amber-400">
                      {contributors[0].totalCoins.toLocaleString()} L Contributed
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setIsPkModalOpen(false);
                  setIsGiftModalOpen(true);
                }}
                className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-xs rounded-xl h-9 px-3 shadow-md"
              >
                Boost PK 🔥
              </Button>
            </div>

            {/* Loser Penalty Spin Wheel Section */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-center space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs font-black text-rose-400 uppercase tracking-wider">
                <span>🎡 Loser Penalty Spin Wheel</span>
              </div>

              <div
                className={`mx-auto w-24 h-24 rounded-full border-4 border-amber-400 bg-gradient-to-tr from-rose-600 via-purple-600 to-amber-500 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(244,63,94,0.5)] ${
                  pkWheelSpinning ? 'animate-spin' : ''
                }`}
              >
                🎯
              </div>

              {selectedPenalty ? (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-white font-black text-xs sm:text-sm animate-in zoom-in-95 duration-200">
                  {selectedPenalty}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Spin the wheel to pick the losing host&apos;s live stream dare!
                </p>
              )}

              <Button
                onClick={handleSpinPenaltyWheel}
                disabled={pkWheelSpinning}
                className="w-full bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs rounded-xl h-10 shadow-lg"
              >
                {pkWheelSpinning ? 'Spinning Wheel... 🎡' : 'Spin Penalty Wheel Now 🎡'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
