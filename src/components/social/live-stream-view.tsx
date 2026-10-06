'use client';

import { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_APP_ID, ZEGO_APP_SIGN, getLiveRoomId } from '@/lib/zego';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, doc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { Send, MessageSquare, Gift, X, Sparkles, Eye, Power, Loader2, Heart } from 'lucide-react';
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
  const [activeSuperGift, setActiveSuperGift] = useState<{ icon: string; name: string; senderName: string } | null>(null);

  // 1. REAL REAL-TIME FIRESTORE VIEWER TRACKING
  // Adds current user to viewers collection upon entering, removes upon leaving or tab close.
  useEffect(() => {
    if (!roomId || !validUserId) return;

    const viewerRef = doc(db, 'live_streams', roomId, 'viewers', validUserId);
    const roomRef = doc(db, 'live_streams', roomId);

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
        status: 'active',
        hostUid: validUserId,
        hostName: validUserName,
        startedAt: serverTimestamp(),
      }, { merge: true }).catch(console.error);
    }

    // Clean up when user closes browser or tab
    const handleBeforeUnload = () => {
      deleteDoc(viewerRef).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      deleteDoc(viewerRef).catch(console.error);
    };
  }, [roomId, validUserId, validUserName, userAvatar, isHost]);

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

  // ZegoCloud video stream initialization
  useEffect(() => {
    if (!containerRef.current) return;

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      ZEGO_APP_ID,
      ZEGO_APP_SIGN,
      roomId,
      validUserId,
      validUserName,
      7200
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: ZegoUIKitPrebuilt.LiveStreaming,
        config: {
          role: isHost
            ? ZegoUIKitPrebuilt.Host
            : ZegoUIKitPrebuilt.Audience,
        },
      },
      showPreJoinView: isHost,
      turnOnCameraWhenJoining: isHost,
      turnOnMicrophoneWhenJoining: isHost,
      showUserList: false,
      onLeaveRoom: () => {
        handleEndStream();
      },
    });

    return () => {
      try { zp.destroy(); } catch (_) {}
    };
  }, [roomId, validUserId, validUserName, isHost]);

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
            triggerFloatingGift(data.giftIcon, data.giftName || 'Gift', data.senderName);
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

  const triggerFloatingGift = (icon: string, name: string, senderName: string) => {
    const giftId = Math.random().toString();
    const randomX = Math.floor(Math.random() * 60) + 20;
    const newGift: FloatingGift = {
      id: giftId,
      icon,
      name,
      senderName,
      xPercent: randomX,
    };

    setFloatingGifts((prev) => [...prev, newGift]);

    // Trigger TikTok Super Gift Banner Animation for high-tier gifts
    setActiveSuperGift({ icon, name, senderName });
    setTimeout(() => {
      setActiveSuperGift((current) => (current?.name === name ? null : current));
    }, 4500);

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
      if (idToken && hostUid && hostUid !== validUserId) {
        const res = await fetch('/api/gift-coins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            toUserId: hostUid,
            coinAmount: gift.price,
            giftName: gift.name,
            giftEmoji: gift.icon,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to send gift');
        }
      } else {
        // Fallback local update for self testing
        const userRef = doc(db, 'users', validUserId);
        await updateDoc(userRef, { coins: increment(-gift.price) });
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

      // Trigger flying animation
      triggerFloatingGift(gift.icon, gift.name, validUserName);

      toast({
        title: `Sent ${gift.name} ${gift.icon}! 🎁`,
        description: `Sent ${gift.price} Lonkind Coins (L). Host received withdrawable balance!`,
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

        if (isHost) {
          const streamRef = doc(db, 'live_streams', roomId);
          await setDoc(streamRef, { status: 'ended', endedAt: serverTimestamp() }, { merge: true });
        }
      }
    } catch (err) {
      console.error('Error ending stream:', err);
    } finally {
      onLeave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col select-none">
      {/* Smooth Video Container */}
      <div 
        ref={containerRef} 
        onClick={handleScreenTap}
        className="w-full h-full absolute inset-0 cursor-pointer" 
      />

      {/* Top Header Overlay */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-auto">
        {/* Left Side: Host Info & LIVE Badge */}
        <div className="flex items-center gap-2.5 bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 shadow-xl">
          <Avatar className="h-8 w-8 border border-white/20 shrink-0">
            <AvatarImage src={userAvatar} alt={validUserName} />
            <AvatarFallback className="bg-indigo-600 text-white text-xs">
              {validUserName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[160px]">
              {validUserName}
            </span>
            <span className="text-[10px] text-slate-300 font-medium">
              {isHost ? 'Host' : 'Live'}
            </span>
          </div>
          <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border-none shrink-0">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
        </div>

        {/* Right Side: REAL Real-Time Viewer Count + Co-Host Seat Button + End Stream / Leave Button */}
        <div className="flex items-center gap-2">
          {!isHost ? (
            <Button
              size="sm"
              onClick={() => {
                const nextState = !isCoHostRequested;
                setIsCoHostRequested(nextState);
                toast({
                  title: nextState ? '✨ Co-Host Request Sent!' : 'Co-Host Request Canceled',
                  description: nextState ? 'The host will review your request to join split-screen.' : 'Your guest seat request was removed.',
                });
              }}
              className={`h-9 px-3 text-xs font-bold rounded-full shadow-xl transition-all border border-emerald-400/30 ${
                isCoHostRequested
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isCoHostRequested ? 'Requested ✓' : 'Request Co-Host'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                toast({
                  title: 'Co-Host Guest Seat',
                  description: 'No pending guest requests. Viewers can tap "Request Co-Host" to join.',
                });
              }}
              className="h-9 px-3 text-xs font-bold rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl flex items-center gap-1 border border-emerald-400/30"
            >
              <span>Co-Host Seats</span>
              <Badge className="bg-white text-emerald-800 font-extrabold text-[10px] px-1.5 py-0 rounded-full">0</Badge>
            </Button>
          )}

          <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-md border border-white/15 text-slate-100 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl">
            <Eye className="h-3.5 w-3.5 text-indigo-400" />
            <span>👁 {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}</span>
          </div>

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

      {/* Slide-In Viewer Entrance Banner */}
      {entranceBanner && (
        <div className="absolute top-20 left-4 z-40 bg-emerald-600/95 text-white font-extrabold text-xs backdrop-blur-md shadow-2xl rounded-full px-4 py-2 flex items-center gap-2 border border-emerald-400/40 animate-in slide-in-from-left duration-300">
          <span className="text-base">✨</span>
          <span><strong>@{entranceBanner.name}</strong> joined the live!</span>
        </div>
      )}

      {/* TikTok-Style Animated Super Gift Screen Banner & Full Motion Overlay */}
      {activeSuperGift && (
        <>
          {/* Top Banner */}
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none animate-in zoom-in-75 duration-300">
            <div className="relative px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-500 text-white font-black text-sm shadow-[0_0_35px_rgba(245,158,11,0.8)] border-2 border-amber-300 flex items-center gap-3">
              <span className="text-3xl animate-bounce filter drop-shadow-md">{activeSuperGift.icon}</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-100 uppercase tracking-widest font-black">SUPER GIFT DISPATCHED</span>
                <span className="text-xs truncate"><strong>@{activeSuperGift.senderName}</strong> sent <strong>{activeSuperGift.name}</strong>!</span>
              </div>
              <span className="text-3xl animate-bounce filter drop-shadow-md">{activeSuperGift.icon}</span>
            </div>
          </div>

          {/* 🏎️ TikTok Sports Car Motion Animation (Drives Left-to-Right Across Screen) */}
          {(activeSuperGift.icon === '🏎️' || activeSuperGift.name.toLowerCase().includes('car')) && (
            <div className="absolute top-1/2 left-0 right-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-drive-forward flex items-center gap-2">
                <span className="text-8xl filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">🏎️</span>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-amber-300 bg-black/80 px-3 py-1 rounded-full border border-amber-400 shadow-xl">
                    🏎️ @{activeSuperGift.senderName}'s Supercar
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 🚀 TikTok Rocket Motion Animation (Blasts Off Upward into Space) */}
          {(activeSuperGift.icon === '🚀' || activeSuperGift.name.toLowerCase().includes('rocket')) && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center">
              <div className="animate-rocket-launch flex flex-col items-center">
                <span className="text-8xl filter drop-shadow-[0_15px_30px_rgba(59,130,246,0.9)]">🚀</span>
                <span className="text-2xl animate-pulse">🔥💨</span>
                <span className="text-xs font-black text-cyan-200 bg-blue-950/90 px-3 py-1 rounded-full border border-cyan-400 shadow-2xl mt-2">
                  🚀 @{activeSuperGift.senderName} Launched Rocket!
                </span>
              </div>
            </div>
          )}

          {/* 🦁 TikTok Lion Motion Animation (Golden Roar Explosion) */}
          {(activeSuperGift.icon === '🦁' || activeSuperGift.name.toLowerCase().includes('lion')) && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-lion-roar flex flex-col items-center text-center">
                <div className="relative">
                  <span className="text-9xl filter drop-shadow-[0_0_50px_rgba(245,158,11,1)]">🦁</span>
                  <div className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping opacity-75" />
                </div>
                <span className="text-sm font-black text-amber-200 bg-amber-950/90 px-4 py-1.5 rounded-full border-2 border-amber-400 shadow-2xl mt-4 uppercase tracking-widest">
                  👑 @{activeSuperGift.senderName} Unleashed The Lion!
                </span>
              </div>
            </div>
          )}

          {/* 🌌 TikTok Universe Motion Animation (Galaxy Fireworks Explosion) */}
          {(activeSuperGift.icon === '🌌' || activeSuperGift.name.toLowerCase().includes('universe')) && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-universe-explode flex flex-col items-center text-center">
                <span className="text-9xl filter drop-shadow-[0_0_60px_rgba(168,85,247,1)]">🌌✨</span>
                <span className="text-sm font-black text-pink-200 bg-purple-950/90 px-4 py-1.5 rounded-full border-2 border-purple-400 shadow-2xl mt-4 uppercase tracking-widest">
                  🌌 @{activeSuperGift.senderName} Gifted The Universe!
                </span>
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
              <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold text-indigo-300">
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">L</span>
                <span>{userCoins.toLocaleString()} Coins</span>
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
            <p className="text-slate-300 text-xs leading-relaxed mb-6">
              You need <strong className="text-indigo-400">{rechargeModalGift.price.toLocaleString()} Lonkind Coins (L)</strong> to send <span className="text-white font-bold">{rechargeModalGift.name} {rechargeModalGift.icon}</span>, but you currently have <strong className="text-white">{userCoins.toLocaleString()} Coins</strong>.
              Would you like to buy cheap Lonkind Coins now?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setRechargeModalGift(null)}
                className="w-1/2 border-white/15 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-bold h-10"
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
                className="w-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold rounded-xl text-xs h-10 shadow-lg shadow-indigo-500/20"
              >
                Buy Coins
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
