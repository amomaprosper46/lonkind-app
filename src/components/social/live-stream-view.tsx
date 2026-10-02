'use client';

import { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_APP_ID, ZEGO_APP_SIGN, getLiveRoomId } from '@/lib/zego';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Send, MessageSquare, Gift, X, Sparkles, Eye, Power, Coins, Loader2 } from 'lucide-react';
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

const GIFT_CATALOG = [
  { id: 'star', name: 'Star', icon: '⭐', price: 10, color: 'from-amber-400 to-yellow-500' },
  { id: 'heart', name: 'Heart', icon: '❤️', price: 50, color: 'from-rose-500 to-pink-500' },
  { id: 'diamond', name: 'Diamond', icon: '💎', price: 100, color: 'from-cyan-400 to-blue-500' },
  { id: 'crown', name: 'Crown', icon: '👑', price: 500, color: 'from-amber-300 to-amber-600' },
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
  const [viewerCount, setViewerCount] = useState(14);
  const [userCoins, setUserCoins] = useState(initialCoins);

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

  // Dynamic viewer count simulation (-1, 0, or +1 every 4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(8, prev + delta);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

    setTimeout(() => {
      setFloatingGifts((prev) => prev.filter((g) => g.id !== giftId));
    }, 2500);
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
    // 1. Check if user has enough coins
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
        // Fallback local update for self-testing
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
        title: `Sent ${gift.name} ${gift.icon}!`,
        description: `Successfully sent gift worth ${gift.price} coins.`,
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
      if (isHost && roomId) {
        const streamRef = doc(db, 'live_streams', roomId);
        await setDoc(streamRef, { status: 'ended', endedAt: serverTimestamp() }, { merge: true });
      }
    } catch (err) {
      console.error('Error ending stream:', err);
    } finally {
      onLeave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col">
      {/* Video Container */}
      <div ref={containerRef} className="w-full h-full absolute inset-0" />

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

        {/* Right Side: Viewer Count + End Stream / Leave Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-md border border-white/15 text-slate-100 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl">
            <Eye className="h-3.5 w-3.5 text-indigo-400" />
            <span>👁 {viewerCount} viewers</span>
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

      {/* Floating Animated Flying Gifts Overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {floatingGifts.map((gift) => (
          <div
            key={gift.id}
            style={{ left: `${gift.xPercent}%`, bottom: '20%' }}
            className="absolute flex flex-col items-center animate-float-up"
          >
            <span className="text-5xl filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]">
              {gift.icon}
            </span>
            <span className="text-[10px] font-extrabold text-white bg-indigo-600/90 backdrop-blur-md px-2 py-0.5 rounded-full shadow-lg mt-1 whitespace-nowrap border border-white/20">
              {gift.senderName}
            </span>
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
            className="ml-auto h-7 px-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold text-[11px] rounded-full shadow-md flex items-center gap-1.5 border border-white/20 transform hover:scale-105 transition-all"
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
                    <span className="inline-flex items-center gap-1 text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 text-[11px] mt-0.5">
                      <Sparkles className="h-3 w-3 text-amber-400" />
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
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-950 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Send Virtual Gift</h3>
              </div>
              
              {/* Coin Balance Badge */}
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold text-amber-300">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
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
            <div className="grid grid-cols-2 gap-3 mb-4">
              {GIFT_CATALOG.map((gift) => (
                <button
                  key={gift.id}
                  disabled={isSending}
                  onClick={() => handleSendGift(gift)}
                  className="flex flex-col items-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/50 transition-all group text-center transform hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <span className="text-4xl mb-1 group-hover:scale-110 transition-transform">
                    {gift.icon}
                  </span>
                  <span className="font-bold text-white text-xs mb-1">{gift.name}</span>
                  <Badge className={`bg-gradient-to-r ${gift.color} text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border-none shadow-sm`}>
                    🪙 {gift.price} Coins
                  </Badge>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-center text-slate-400">
              Gifts send a flying animation on screen & alert everyone in chat! ✨
            </p>
          </div>
        </div>
      )}

      {/* Insufficient Coins / Recharge Prompt Modal */}
      {rechargeModalGift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-white/15 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Coins className="h-7 w-7 text-amber-400" />
            </div>

            <h3 className="font-extrabold text-white text-lg mb-2">Insufficient Coins</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-6">
              You need <strong className="text-amber-400">{rechargeModalGift.price} Coins</strong> to send <span className="text-white font-bold">{rechargeModalGift.name} {rechargeModalGift.icon}</span>, but you currently have <strong className="text-white">{userCoins.toLocaleString()} Coins</strong>.
              Would you like to recharge your balance now?
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
                className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold rounded-xl text-xs h-10 shadow-lg shadow-amber-500/20"
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
