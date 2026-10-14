'use client';

import { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_APP_ID, ZEGO_APP_SIGN, getLiveRoomId, getZegoServerSecret, setZegoServerSecret, isValidZegoSecret } from '@/lib/zego';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, doc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { Send, MessageSquare, Gift, X, Sparkles, Eye, Power, Loader2, Heart, KeyRound, ShieldAlert, ExternalLink, Video, VideoOff, Mic, MicOff, Radio, Flame, Music, Gamepad2, Check, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface LiveMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type?: 'text' | 'gift';
  giftIcon?: string;
  giftName?: string;
  timestamp: any;
}

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

export const GIFT_CATALOG = [
  { id: 'rose', name: 'Rose', icon: '🌹', price: 10, color: 'from-pink-500 to-rose-600' },
  { id: 'star', name: 'Star', icon: '⭐', price: 50, color: 'from-indigo-500 to-purple-600' },
  { id: 'coffee', name: 'Coffee', icon: '☕', price: 100, color: 'from-amber-600 to-amber-800' },
  { id: 'heart', name: 'Heart', icon: '❤️', price: 500, color: 'from-rose-600 to-red-600' },
  { id: 'diamond', name: 'Diamond', icon: '💎', price: 1500, color: 'from-cyan-400 to-blue-600' },
  { id: 'crown', name: 'Crown', icon: '👑', price: 5000, color: 'from-amber-400 to-yellow-600' },
  { id: 'lion', name: 'Lion', icon: '🦁', price: 20000, color: 'from-amber-500 via-orange-600 to-yellow-500', isSuper: true },
  { id: 'car', name: 'Sports Car', icon: '🏎️', price: 50000, color: 'from-purple-600 to-indigo-700', isSuper: true },
  { id: 'rocket', name: 'Rocket', icon: '🚀', price: 100000, color: 'from-blue-600 to-cyan-500', isSuper: true },
  { id: 'universe', name: 'Universe', icon: '🌌', price: 500000, color: 'from-indigo-600 via-purple-600 to-pink-600', isSuper: true },
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
}

export function playLonkindSoundEffect(type: 'applause' | 'cheer' | 'airhorn' | 'fanfare' | 'bell') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

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

export default function LiveStreamView({
  hostUid,
  userId,
  userName,
  userAvatar,
  isHost,
  onLeave,
  userCoins: initialCoins = 0,
  onGoToWallet,
}: LiveStreamViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const roomId = getLiveRoomId(hostUid || userId || 'default_host');
  const validUserId = userId || `user_${Math.floor(Math.random() * 100000)}`;
  const validUserName = userName || 'Guest User';

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
  const [isScreenShaking, setIsScreenShaking] = useState(false);

  // Authentication & Zego Connection State
  const [serverSecret, setServerSecret] = useState<string>(() => getZegoServerSecret());
  const [showSecretModal, setShowSecretModal] = useState<boolean>(() => !isValidZegoSecret(getZegoServerSecret()));
  const [secretInputValue, setSecretInputValue] = useState<string>('');
  const [isSavingSecret, setIsSavingSecret] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const hasJoinedRoomRef = useRef(false);

  // Auto-fetch configured secret from server on mount if not in localStorage
  useEffect(() => {
    if (!isValidZegoSecret(serverSecret)) {
      fetch('/api/live/zego-config')
        .then((res) => res.json())
        .then((data) => {
          if (data?.configured && data?.serverSecret && isValidZegoSecret(data.serverSecret)) {
            setZegoServerSecret(data.serverSecret);
            setServerSecret(data.serverSecret);
            setShowSecretModal(false);
            setConnectionError(null);
          }
        })
        .catch(() => {});
    }
  }, [serverSecret]);

  const handleSaveSecret = async () => {
    const trimmed = secretInputValue.trim();
    if (!isValidZegoSecret(trimmed)) {
      toast({
        variant: 'destructive',
        title: 'Invalid ServerSecret Format',
        description: 'The ServerSecret must be exactly 32 alphanumeric characters from your ZEGOCLOUD Console.',
      });
      return;
    }

    setIsSavingSecret(true);
    setZegoServerSecret(trimmed);
    setServerSecret(trimmed);
    setShowSecretModal(false);
    setConnectionError(null);

    try {
      await fetch('/api/live/zego-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverSecret: trimmed }),
      });
    } catch (_) {}

    setIsSavingSecret(false);
    toast({
      title: 'Credentials Saved! 🚀',
      description: 'Connecting to live room...',
    });
  };

  // Lonkind 1v1 PK Battle State
  const [pkBattleScore, setPkBattleScore] = useState<{ host1Score: number; host2Score: number; active: boolean }>({
    host1Score: 1250,
    host2Score: 980,
    active: true,
  });

  // Lonkind Video AR Filter & Sound Effects State
  const [activeFilter, setActiveFilter] = useState<'normal' | 'sparkles' | 'warm' | 'neon' | 'vintage' | 'golden'>('normal');
  const [streamHostInfo, setStreamHostInfo] = useState<{ name: string; avatar?: string; uid: string } | null>(null);

  // Listen to live stream document for real-time host info
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'live_streams', roomId);
    const unsub = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.hostName) {
          setStreamHostInfo({
            name: data.hostName,
            avatar: data.hostAvatar,
            uid: data.hostUid,
          });
        }
      }
    });
    return () => unsub();
  }, [roomId]);

  // 1. REAL REAL-TIME FIRESTORE VIEWER TRACKING & STREAM REGISTRATION
  useEffect(() => {
    if (!roomId || !validUserId) return;
    if (isHost && !hasStartedLive) return;

    const viewerRef = doc(db, 'live_streams', roomId, 'viewers', validUserId);
    const roomRef = doc(db, 'live_streams', roomId);
    const actualHostUid = (hostUid || validUserId).replace(/^live_/, '');

    // Register active viewer entry in Firestore
    setDoc(viewerRef, {
      uid: validUserId,
      name: validUserName,
      avatarUrl: userAvatar || '',
      joinedAt: serverTimestamp(),
    }, { merge: true }).catch(console.error);

    // Update stream status to active if host
    if (isHost) {
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
  }, [roomId, validUserId, validUserName, userAvatar, isHost, hostUid, hasStartedLive, streamTitle, streamCategory, streamMode]);

  // 2. REAL-TIME VIEWERS COUNT & ENTRANCE BANNER LISTENER
  useEffect(() => {
    if (!roomId) return;
    const viewersCol = collection(db, 'live_streams', roomId, 'viewers');

    const unsubscribe = onSnapshot(viewersCol, (snapshot) => {
      setViewerCount(Math.max(1, snapshot.size));

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && change.doc.id !== validUserId) {
          const data = change.doc.data();
          if (data.name) {
            setEntranceBanner({ name: data.name, avatarUrl: data.avatarUrl });
            setTimeout(() => setEntranceBanner(null), 3500);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [roomId, validUserId]);

  // 3. REAL-TIME CO-HOST REQUESTS & ACCEPTANCE LISTENER
  useEffect(() => {
    if (!roomId || !validUserId) return;
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
  }, [roomId, validUserId, isHost, isCoHostAccepted]);

  const handleToggleCoHostRequest = async () => {
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

  // ZegoCloud video stream initialization with Cross-Platform PC & Mobile Co-Host scenario
  useEffect(() => {
    if (!containerRef.current) return;
    if (isHost && !hasStartedLive) return; // Wait until host customizes and clicks "Go Live Now"
    if (!serverSecret || !isValidZegoSecret(serverSecret)) {
      setShowSecretModal(true);
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    let zpInstance: any = null;

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        ZEGO_APP_ID,
        serverSecret,
        roomId,
        validUserId,
        validUserName,
        7200
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpInstance = zp;

      const currentRole = isHost
        ? ZegoUIKitPrebuilt.Host
        : isCoHostAccepted
        ? ZegoUIKitPrebuilt.Cohost
        : ZegoUIKitPrebuilt.Audience;

      zp.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role: currentRole,
          },
        },
        showPreJoinView: false,
        turnOnCameraWhenJoining: (isHost || isCoHostAccepted) && streamMode === 'video' && isCameraEnabled,
        turnOnMicrophoneWhenJoining: (isHost || isCoHostAccepted) && isMicEnabled,
        showUserList: false,
        onJoinRoom: () => {
          hasJoinedRoomRef.current = true;
          setIsConnecting(false);
          setConnectionError(null);
        },
        onLeaveRoom: () => {
          if (hasJoinedRoomRef.current) {
            handleEndStream();
          } else {
            console.warn('Zego onLeaveRoom triggered before successful join. Token or network error.');
            setIsConnecting(false);
            setConnectionError('Failed to join room: token authentication error. Please verify your 32-character ServerSecret from ZEGOCLOUD Console.');
            setShowSecretModal(true);
          }
        },
      });
    } catch (err: any) {
      console.error('Error during ZegoUIKit initialization:', err);
      setIsConnecting(false);
      setConnectionError(err.message || 'Error initializing live stream.');
      setShowSecretModal(true);
    }

    return () => {
      try { zpInstance?.destroy(); } catch (_) {}
    };
  }, [roomId, validUserId, validUserName, isHost, isCoHostAccepted, serverSecret, hasStartedLive, streamMode, isCameraEnabled, isMicEnabled]);

  // Firestore real-time live chat & gift listener
  useEffect(() => {
    if (!roomId) return;
    const chatRef = collection(db, 'live_streams', roomId, 'chat');
    const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: LiveMessage[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as LiveMessage;
          if (data.type === 'gift' && data.giftIcon) {
            if (data.senderId !== validUserId) {
              const matchedGift = GIFT_CATALOG.find(g => g.name === data.giftName || g.icon === data.giftIcon) || {
                id: 'gift',
                name: data.giftName || 'Gift',
                icon: data.giftIcon,
                price: 100,
                color: 'from-indigo-500 to-purple-600',
              };
              triggerGiftingMoment(matchedGift, data.senderName, data.senderAvatar);
            }
          }
        }
      });

      snapshot.docs.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as LiveMessage);
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

  const triggerGiftingMoment = (gift: typeof GIFT_CATALOG[0], senderName: string, senderAvatar?: string) => {
    // 1. Combo calculation
    let currentCombo = 1;
    setGiftCombo((prev) => {
      const isSame = prev.giftId === gift.id;
      const count = isSame ? prev.count + 1 : 1;
      currentCombo = count;
      return { giftId: gift.id, count };
    });

    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setGiftCombo({ giftId: '', count: 1 });
    }, 4500);

    // 2. VIP Slide-in Banner (Left-to-Right TikTok Pill)
    setVipBanner({
      senderName,
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

    // 3. Center Screen Showcase Animation
    setActiveCenterGift({
      gift,
      senderName,
      combo: currentCombo,
    });

    setTimeout(() => {
      setActiveCenterGift((curr) => (curr?.gift.id === gift.id ? null : curr));
    }, 3600);

    // 4. Confetti & Particle Celebrations using canvas-confetti
    try {
      if (gift.id === 'rose' || gift.id === 'heart') {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#f43f5e', '#e11d48', '#fda4af', '#fb7185'],
        });
      } else if (gift.id === 'star' || gift.id === 'coffee') {
        confetti({
          particleCount: 65,
          spread: 85,
          origin: { y: 0.65 },
          colors: ['#facc15', '#eab308', '#fbbf24', '#ffffff'],
        });
      } else if (gift.id === 'diamond') {
        confetti({
          particleCount: 65,
          angle: 60,
          spread: 75,
          origin: { x: 0, y: 0.7 },
          colors: ['#06b6d4', '#38bdf8', '#ffffff'],
        });
        confetti({
          particleCount: 65,
          angle: 120,
          spread: 75,
          origin: { x: 1, y: 0.7 },
          colors: ['#06b6d4', '#38bdf8', '#ffffff'],
        });
      } else if (gift.id === 'crown') {
        confetti({
          particleCount: 130,
          spread: 130,
          origin: { y: 0.4 },
          colors: ['#fbbf24', '#f59e0b', '#d97706', '#ef4444', '#ffffff'],
        });
      } else if (gift.isSuper) {
        const end = Date.now() + 1800;
        const interval: any = setInterval(() => {
          if (Date.now() > end) return clearInterval(interval);
          confetti({
            startVelocity: 35,
            spread: 360,
            ticks: 70,
            origin: { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.4 + 0.2 },
            colors: ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'],
          });
        }, 220);
      }
    } catch (_) {}

    // 5. Screen Haptic Shake for high-value gifts
    if (gift.price >= 1500) {
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 550);
    }

    // 6. Sound Effects
    if (gift.isSuper) {
      playLonkindSoundEffect('fanfare');
    } else if (gift.price >= 1500) {
      playLonkindSoundEffect('bell');
    } else if (gift.price >= 100) {
      playLonkindSoundEffect('cheer');
    } else {
      playLonkindSoundEffect('applause');
    }

    // Vertical floating gift pill
    const giftId = Math.random().toString();
    const randomX = Math.floor(Math.random() * 40) + 30;
    setFloatingGifts((prev) => [...prev, { id: giftId, icon: gift.icon, name: gift.name, senderName, xPercent: randomX }]);
    setTimeout(() => {
      setFloatingGifts((prev) => prev.filter((g) => g.id !== giftId));
    }, 2800);
  };

  const handleSendMessage = async () => {
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
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send live message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGift = async (gift: typeof GIFT_CATALOG[0]) => {
    // Check if user has enough coins
    if (userCoins < gift.price) {
      setRechargeModalGift(gift);
      return;
    }

    setIsSending(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const targetHostUid = (hostUid || validUserId).replace(/^live_/, '');

      if (idToken) {
        const res = await fetch('/api/gift-coins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            toUserId: targetHostUid,
            coinAmount: gift.price,
            giftName: gift.name,
            giftEmoji: gift.icon,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to send gift');
        }
      }

      // Log gift to Firestore chat stream
      const chatRef = collection(db, 'live_streams', roomId, 'chat');
      await addDoc(chatRef, {
        senderId: validUserId,
        senderName: validUserName,
        senderAvatar: userAvatar || '',
        text: `sent ${gift.name} ${gift.icon}!`,
        type: 'gift',
        giftIcon: gift.icon,
        giftName: gift.name,
        timestamp: serverTimestamp(),
      });

      // Trigger immersive gifting moment (confetti, VIP banner, center animation, combo streak, sound effects)
      triggerGiftingMoment(gift, validUserName, userAvatar);

      // Increment PK Battle score points
      setPkBattleScore(prev => ({
        ...prev,
        host1Score: prev.host1Score + gift.price,
      }));

      toast({
        title: `Sent ${gift.name} ${gift.icon}! 🎁`,
        description: `Sent ${gift.price} Lonkind Coins (L)!`,
      });

      setIsGiftModalOpen(false);
    } catch (err: any) {
      console.error('Failed to send gift:', err);
      toast({
        variant: 'destructive',
        title: 'Gift Error',
        description: err.message || 'Could not send gift. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleEndStream = async () => {
    try {
      if (validUserId && roomId) {
        // Delete viewer tracking document
        const viewerRef = doc(db, 'live_streams', roomId, 'viewers', validUserId);
        await deleteDoc(viewerRef).catch(() => {});

        // Only mark stream ended in Firestore if user is host and had successfully joined
        if (isHost && hasJoinedRoomRef.current) {
          const streamRef = doc(db, 'live_streams', roomId);
          await setDoc(streamRef, { status: 'ended', endedAt: serverTimestamp() }, { merge: true }).catch(() => {});
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
      {/* Smooth Video Container */}
      <div 
        ref={containerRef} 
        onClick={handleScreenTap}
        className={`w-full h-full absolute inset-0 cursor-pointer transition-all duration-300 ${streamMode === 'audio' ? 'opacity-0 pointer-events-none' : ''} ${
          activeFilter === 'sparkles' ? 'brightness-110 contrast-105' :
          activeFilter === 'warm' ? 'sepia-[0.2] hue-rotate-15' :
          activeFilter === 'neon' ? 'saturate-200 contrast-125' :
          activeFilter === 'vintage' ? 'sepia-[0.4] contrast-90 brightness-95' :
          activeFilter === 'golden' ? 'brightness-115 sepia-[0.25]' : ''
        }`} 
      />

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

      {/* Top Header Overlay */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-auto">
        {/* Left Side: Host Info & LIVE Badge */}
        <div className="flex items-center gap-2.5 bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 shadow-xl">
          <Avatar className="h-8 w-8 border border-white/20 shrink-0">
            <AvatarImage src={hostDisplayAvatar} alt={hostDisplayName} />
            <AvatarFallback className="bg-indigo-600 text-white text-xs">
              {hostDisplayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[150px]">
              {hostDisplayName}
            </span>
            <span className="text-[10px] text-indigo-300 font-medium truncate max-w-[100px] sm:max-w-[150px]">
              {streamTitle || (isHost ? 'Host (You)' : 'Live Host')}
            </span>
          </div>
          <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border-none shrink-0">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
          {streamCategory && (
            <Badge className="hidden sm:inline-flex bg-white/15 text-white text-[9px] font-semibold px-1.5 py-0 rounded-full capitalize">
              {streamCategory}
            </Badge>
          )}
        </div>

        {/* Right Side: REAL Real-Time Viewer Count + Co-Host Seat Button + End Stream / Leave Button */}
        <div className="flex items-center gap-2">
          {!isHost ? (
            <Button
              size="sm"
              onClick={handleToggleCoHostRequest}
              className={`h-9 px-3 text-xs font-bold rounded-full shadow-xl transition-all border border-emerald-400/30 ${
                isCoHostAccepted
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : isCoHostRequested
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isCoHostAccepted ? 'Co-Host Active 🎙️' : isCoHostRequested ? 'Requested ✓' : 'Request Co-Host'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsHostRequestsModalOpen(true)}
              className="h-9 px-3 text-xs font-bold rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl flex items-center gap-1 border border-emerald-400/30"
            >
              <span>Co-Host Seats</span>
              <Badge className="bg-white text-emerald-800 font-extrabold text-[10px] px-1.5 py-0 rounded-full">
                {coHostRequests.filter(r => r.status === 'pending').length}
              </Badge>
            </Button>
          )}

          <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-md border border-white/15 text-slate-100 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl">
            <Eye className="h-3.5 w-3.5 text-indigo-400" />
            <span>👁 {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}</span>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setSecretInputValue(serverSecret || '');
              setShowSecretModal(true);
            }}
            title="ZEGOCLOUD Credentials Settings"
            className="h-9 w-9 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={handleEndStream}
            className={`h-9 px-3.5 text-xs font-bold rounded-full shadow-xl transition-all flex items-center gap-1.5 border border-white/20 ${
              isHost
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {isHost ? 'End Stream' : 'Leave'}
          </Button>
        </div>
      </div>

      {/* ⚔️ Lonkind 1v1 PK Battle Top Progress Bar Widget */}
      {pkBattleScore.active && (
        <div className="absolute top-16 left-4 right-4 z-30 flex flex-col items-center pointer-events-auto max-w-md mx-auto">
          <div className="w-full bg-slate-950/85 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-black mb-1.5 px-1">
              <div className="flex items-center gap-1.5 text-blue-400">
                <Avatar className="h-5 w-5 border border-blue-400">
                  <AvatarImage src={userAvatar} alt={validUserName} />
                  <AvatarFallback className="bg-blue-600 text-white text-[9px]">{validUserName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[90px]">{validUserName}</span>
                <Badge className="bg-blue-600/80 text-white font-black text-[10px] px-1.5 py-0">{pkBattleScore.host1Score.toLocaleString()} pts</Badge>
              </div>

              <div className="flex items-center gap-1 bg-gradient-to-r from-blue-600 via-purple-600 to-rose-600 px-2 py-0.5 rounded-full text-white font-black text-[10px] tracking-widest shadow-md">
                <span>⚔️ PK BATTLE</span>
              </div>

              <div className="flex items-center gap-1.5 text-rose-400">
                <Badge className="bg-rose-600/80 text-white font-black text-[10px] px-1.5 py-0">{pkBattleScore.host2Score.toLocaleString()} pts</Badge>
                <span className="truncate max-w-[90px]">Opponent Host</span>
                <Avatar className="h-5 w-5 border border-rose-400">
                  <AvatarFallback className="bg-rose-600 text-white text-[9px]">OH</AvatarFallback>
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
          </div>
        </div>
      )}

      {/* 🎺 Sound Effects & 🎨 AR Video Filter Floating Quick Selector Toolbar */}
      <div className="absolute top-36 left-4 z-30 flex flex-col gap-2 pointer-events-auto">
        <div className="bg-slate-950/80 backdrop-blur-md border border-white/15 p-2 rounded-2xl flex flex-col gap-1.5 shadow-2xl">
          <span className="text-[10px] font-black text-slate-300 px-1 uppercase tracking-wider">Sounds 🎺</span>
          <div className="flex items-center gap-1">
            <button onClick={() => playLonkindSoundEffect('airhorn')} title="Airhorn" className="h-7 w-7 rounded-lg bg-indigo-600/60 hover:bg-indigo-500 text-white flex items-center justify-center text-xs transition-transform active:scale-95 shadow">🎺</button>
            <button onClick={() => playLonkindSoundEffect('cheer')} title="Cheer" className="h-7 w-7 rounded-lg bg-emerald-600/60 hover:bg-emerald-500 text-white flex items-center justify-center text-xs transition-transform active:scale-95 shadow">🥳</button>
            <button onClick={() => playLonkindSoundEffect('fanfare')} title="Fanfare" className="h-7 w-7 rounded-lg bg-amber-600/60 hover:bg-amber-500 text-white flex items-center justify-center text-xs transition-transform active:scale-95 shadow">🎉</button>
            <button onClick={() => playLonkindSoundEffect('bell')} title="Bell" className="h-7 w-7 rounded-lg bg-purple-600/60 hover:bg-purple-500 text-white flex items-center justify-center text-xs transition-transform active:scale-95 shadow">🔔</button>
          </div>
        </div>

        <div className="bg-slate-950/80 backdrop-blur-md border border-white/15 p-2 rounded-2xl flex flex-col gap-1.5 shadow-2xl">
          <span className="text-[10px] font-black text-slate-300 px-1 uppercase tracking-wider">AR Filters 🎨</span>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'normal', name: 'Off', icon: '🚫' },
              { id: 'sparkles', name: 'Sparkles', icon: '✨' },
              { id: 'warm', name: 'Warm', icon: '☀️' },
              { id: 'neon', name: 'Neon', icon: '⚡' },
              { id: 'vintage', name: 'Vintage', icon: '📜' },
              { id: 'golden', name: 'Golden', icon: '🌟' },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id as any)}
                className={`h-7 px-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-0.5 border transition-all ${
                  activeFilter === filter.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-white/40 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                }`}
              >
                <span>{filter.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Slide-In Viewer Entrance Banner */}
      {entranceBanner && (
        <div className="absolute top-20 left-4 z-40 bg-emerald-600/95 text-white font-extrabold text-xs backdrop-blur-md shadow-2xl rounded-full px-4 py-2 flex items-center gap-2 border border-emerald-400/40 animate-in slide-in-from-left duration-300">
          <span className="text-base">✨</span>
          <span><strong>@{entranceBanner.name}</strong> joined the live!</span>
        </div>
      )}

      {/* Sliding VIP Gift Pill (TikTok-style Left-to-Right) */}
      {vipBanner && (
        <div className="absolute top-28 left-4 z-40 pointer-events-none animate-vip-slide">
          <div className="bg-gradient-to-r from-amber-500/90 via-purple-600/90 to-pink-600/90 backdrop-blur-md border border-white/30 rounded-full pl-1.5 pr-4 py-1.5 shadow-[0_0_25px_rgba(236,72,153,0.5)] flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border-2 border-white/60 shadow shrink-0">
              <AvatarImage src={vipBanner.senderAvatar} alt={vipBanner.senderName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                {vipBanner.senderName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-white truncate max-w-[120px]">
                @{vipBanner.senderName}
              </span>
              <span className="text-[10px] text-amber-200 font-semibold truncate">
                Sent {vipBanner.giftName}
              </span>
            </div>
            <span className="text-2xl filter drop-shadow animate-bounce">
              {vipBanner.giftIcon}
            </span>
            {vipBanner.combo > 1 && (
              <div className="flex items-center gap-0.5 bg-amber-400 text-black font-black text-xs px-2 py-0.5 rounded-full shadow-lg animate-combo-bounce">
                <Flame className="h-3 w-3 fill-rose-600 text-rose-600" />
                <span>x{vipBanner.combo}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🌟 Center Screen Gifting Showcase Overlay for All Gift Tiers */}
      {activeCenterGift && (
        <>
          {activeCenterGift.gift.id === 'crown' && (
            <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center animate-crown-drop">
              <span className="text-9xl filter drop-shadow-[0_0_50px_rgba(245,158,11,1)]">👑</span>
              <div className="mt-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-sm px-6 py-2 rounded-full shadow-2xl uppercase tracking-wider flex items-center gap-2">
                <span>👑 @{activeCenterGift.senderName} gifted Royal Crown!</span>
                {activeCenterGift.combo > 1 && (
                  <span className="bg-black text-amber-400 px-2 py-0.5 rounded-full text-xs">x{activeCenterGift.combo}</span>
                )}
              </div>
            </div>
          )}

          {activeCenterGift.gift.id === 'diamond' && (
            <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center animate-diamond-radiance">
              <span className="text-9xl filter drop-shadow-[0_0_60px_rgba(6,182,212,1)]">💎</span>
              <div className="mt-4 bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-black text-sm px-6 py-2 rounded-full shadow-2xl uppercase tracking-wider flex items-center gap-2">
                <span>💎 @{activeCenterGift.senderName} gifted Diamond Radiance!</span>
                {activeCenterGift.combo > 1 && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">x{activeCenterGift.combo}</span>
                )}
              </div>
            </div>
          )}

          {activeCenterGift.gift.id === 'car' && (
            <div className="absolute top-1/2 left-0 right-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="animate-drive-forward flex items-center gap-3">
                <span className="text-9xl filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)]">🏎️</span>
                <span className="text-sm font-black text-amber-300 bg-black/85 px-4 py-1.5 rounded-full border border-amber-400 shadow-2xl whitespace-nowrap">
                  🏎️ @{activeCenterGift.senderName}'s Supercar Drift!
                </span>
              </div>
            </div>
          )}

          {activeCenterGift.gift.id === 'rocket' && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center">
              <div className="animate-rocket-launch flex flex-col items-center">
                <span className="text-9xl filter drop-shadow-[0_20px_40px_rgba(59,130,246,0.9)]">🚀</span>
                <span className="text-3xl animate-pulse">🔥💨</span>
                <span className="text-sm font-black text-cyan-200 bg-blue-950/90 px-4 py-1.5 rounded-full border border-cyan-400 shadow-2xl mt-2 whitespace-nowrap">
                  🚀 @{activeCenterGift.senderName} Blasted Off Rocket!
                </span>
              </div>
            </div>
          )}

          {activeCenterGift.gift.id === 'lion' && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="animate-lion-roar flex flex-col items-center text-center">
                <div className="relative">
                  <span className="text-9xl filter drop-shadow-[0_0_60px_rgba(245,158,11,1)]">🦁</span>
                  <div className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping opacity-75" />
                </div>
                <span className="text-sm font-black text-amber-200 bg-amber-950/90 px-5 py-2 rounded-full border-2 border-amber-400 shadow-2xl mt-4 uppercase tracking-widest whitespace-nowrap">
                  👑 @{activeCenterGift.senderName} Unleashed The Lion!
                </span>
              </div>
            </div>
          )}

          {activeCenterGift.gift.id === 'universe' && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="animate-universe-explode flex flex-col items-center text-center">
                <span className="text-9xl filter drop-shadow-[0_0_80px_rgba(168,85,247,1)]">🌌✨</span>
                <span className="text-sm font-black text-pink-200 bg-purple-950/90 px-5 py-2 rounded-full border-2 border-purple-400 shadow-2xl mt-4 uppercase tracking-widest whitespace-nowrap">
                  🌌 @{activeCenterGift.senderName} Gifted The Universe!
                </span>
              </div>
            </div>
          )}

          {!['crown', 'diamond', 'car', 'rocket', 'lion', 'universe'].includes(activeCenterGift.gift.id) && (
            <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center animate-in zoom-in-75 fade-in duration-200">
              <div className="flex flex-col items-center">
                <span className="text-8xl filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)] animate-bounce">
                  {activeCenterGift.gift.icon}
                </span>
                <div className="mt-3 bg-slate-950/85 backdrop-blur-md border border-white/20 text-white font-extrabold text-xs px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2">
                  <span>@{activeCenterGift.senderName} sent {activeCenterGift.gift.name}</span>
                  {activeCenterGift.combo > 1 && (
                    <span className="bg-gradient-to-r from-amber-400 to-rose-500 text-black font-black px-2 py-0.5 rounded-full text-xs animate-combo-bounce">
                      x{activeCenterGift.combo}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Animated Flying Gifts Overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {floatingGifts.map((gift) => (
          <div
            key={gift.id}
            style={{ left: `${gift.xPercent}%`, bottom: '20%' }}
            className="absolute flex flex-col items-center animate-float-up"
          >
            <span className="text-6xl filter drop-shadow-[0_12px_20px_rgba(0,0,0,0.6)]">
              {gift.icon}
            </span>
            <span className="text-[10px] font-extrabold text-white bg-indigo-600/90 backdrop-blur-md px-2.5 py-0.5 rounded-full shadow-lg mt-1 whitespace-nowrap border border-white/20">
              {gift.senderName}
            </span>
          </div>
        ))}

        {/* TikTok-Style Screen Tap Floating Hearts Overlay */}
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

      {/* Floating Semi-Transparent Live Chat Overlay */}
      <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-80 max-h-[50vh] md:max-h-[420px] z-20 flex flex-col bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-3 pointer-events-auto">
        {/* Chat Header */}
        <div className="flex items-center gap-2 px-2 pb-2 border-b border-white/10 mb-2 shrink-0">
          <MessageSquare className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold text-white tracking-wide uppercase">Live Chat</span>
          
          <Button
            size="sm"
            onClick={() => setIsGiftModalOpen(true)}
            className="ml-auto h-7 px-2.5 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-[11px] rounded-full shadow-md flex items-center gap-1.5 border border-white/20 transform hover:scale-105 transition-all"
          >
            <Gift className="h-3.5 w-3.5" />
            Send Gift
          </Button>
        </div>

        {/* Message Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar min-h-[120px]">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-6">
              Welcome to the live stream! Say hello 👋
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 text-xs">
                <Avatar className="h-6 w-6 border border-white/10 shrink-0 mt-0.5">
                  <AvatarImage src={msg.senderAvatar} alt={msg.senderName} />
                  <AvatarFallback className="bg-indigo-600 text-white text-[10px]">
                    {msg.senderName ? msg.senderName.charAt(0) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-indigo-300 truncate text-[11px]">
                    {msg.senderName}
                  </span>
                  {msg.type === 'gift' ? (
                    <span className="inline-flex items-center gap-1 text-indigo-200 font-bold bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30 text-[11px] mt-0.5">
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      {msg.text}
                    </span>
                  ) : (
                    <span className="text-slate-100 break-words leading-relaxed">
                      {msg.text}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10 shrink-0 mt-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="h-9 text-xs bg-white/10 border-white/10 text-white placeholder:text-slate-400 rounded-xl focus-visible:ring-indigo-500"
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isSending}
            className="h-9 w-9 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md"
          >
            <Send className="h-4 w-4" />
          </Button>
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

            {/* Gift Cards Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto pr-1 no-scrollbar p-1 mb-3">
              {GIFT_CATALOG.map((gift) => (
                <button
                  key={gift.id}
                  disabled={isSending}
                  onClick={() => handleSendGift(gift)}
                  className={`flex flex-col items-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border ${
                    gift.isSuper ? 'border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-white/10 hover:border-indigo-400/50'
                  } transition-all group text-center transform hover:scale-105 active:scale-95 disabled:opacity-50 relative`}
                >
                  {gift.isSuper && (
                    <span className="absolute -top-1.5 -right-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase shadow">
                      SUPER
                    </span>
                  )}
                  <span className="text-4xl mb-1 group-hover:scale-110 transition-transform">
                    {gift.icon}
                  </span>
                  <span className="font-bold text-white text-xs mb-1 truncate w-full">{gift.name}</span>
                  <Badge className={`bg-gradient-to-r ${gift.color} text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border-none shadow-sm flex items-center gap-1`}>
                    <span className="font-black">L</span> {gift.price.toLocaleString()}
                  </Badge>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-center text-slate-400 shrink-0 border-t border-white/10 pt-3">
              Gifts send flying animations & credit the creator's Lonkind account balance instantly! 💸
            </p>
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

      {/* 🔐 ZEGOCLOUD ServerSecret Setup & Error Recovery Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-white relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Live Stream Authentication</span>
                  <Badge className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono">
                    AppID: {ZEGO_APP_ID}
                  </Badge>
                </h3>
                <p className="text-xs text-slate-400">ZEGOCLOUD 32-Character ServerSecret Configuration</p>
              </div>
            </div>

            {/* Error banner if connection failed */}
            {connectionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Authentication Error</p>
                  <p className="text-[11px] text-rose-300/90">{connectionError}</p>
                </div>
              </div>
            )}

            {/* Explanatory description */}
            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 mb-4">
              <p className="leading-relaxed">
                ZEGOCLOUD requires your project&apos;s <strong className="text-amber-300 font-semibold">32-character ServerSecret</strong> from the ZEGOCLOUD Console to authenticate WebRTC live video streams. (The 64-character AppSign is only for native mobile SDKs).
              </p>
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <span>How to find your ServerSecret:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-400">
                  <li>
                    Open{' '}
                    <a
                      href="https://console.zegocloud.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-0.5 font-medium"
                    >
                      console.zegocloud.com <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </li>
                  <li>Go to <strong>Project Management</strong> &rarr; Click project (AppID: <code>{ZEGO_APP_ID}</code>)</li>
                  <li>Under <strong>Project Information</strong>, click the 👁️ icon next to <strong>ServerSecret</strong> (32 characters)</li>
                  <li>Copy and paste it below.</li>
                </ol>
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-1.5 mb-5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">ServerSecret (32 Characters)</label>
                <span
                  className={`text-[11px] font-mono font-medium ${
                    secretInputValue.trim().length === 32
                      ? 'text-emerald-400'
                      : secretInputValue.trim().length > 0
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {secretInputValue.trim().length} / 32 chars
                </span>
              </div>
              <Input
                type="text"
                placeholder="e.g. 9a4fe8923412ab34cd5678ef01234567"
                value={secretInputValue}
                onChange={(e) => setSecretInputValue(e.target.value.trim())}
                className="bg-slate-950 border-slate-700 font-mono text-xs text-white placeholder:text-slate-600 focus:border-indigo-500"
              />
              {secretInputValue.trim().length === 64 && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                  ⚠️ This is a 64-character AppSign. Please use the 32-character ServerSecret instead.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSecretModal(false);
                  onLeave();
                }}
                className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
              >
                Return to Home Feed
              </Button>
              <Button
                size="sm"
                disabled={secretInputValue.trim().length !== 32 || isSavingSecret}
                onClick={handleSaveSecret}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                {isSavingSecret ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Save &amp; Connect Stream</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
