'use client';

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';
import dynamic from 'next/dynamic';

const CallView = dynamic(() => import('./call-view'), { ssr: false });

interface IncomingCallDoc {
  id: string;
  roomId: string;
  callType: 'audio' | 'video';
  callerUid: string;
  callerName: string;
  callerAvatar: string;
  status: string;
  createdAt?: any;
}

function IncomingCallCard({
  call,
  onAccept,
  onDecline,
}: {
  call: IncomingCallDoc;
  onAccept: (call: IncomingCallDoc) => void;
  onDecline: (call: IncomingCallDoc) => void;
}) {
  const liveCaller = useLiveUserProfile(call.callerUid, call.callerAvatar, call.callerName);

  // Subtle Web Audio chime while ringing
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let interval: NodeJS.Timeout | null = null;

    const playRingTone = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!ctx) ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.18); // A5

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.46);
      } catch (_) {}
    };

    playRingTone();
    interval = setInterval(playRingTone, 2200);

    return () => {
      if (interval) clearInterval(interval);
      if (ctx) ctx.close().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] w-[92vw] max-w-md rounded-2xl border border-indigo-500/40 bg-slate-950/95 backdrop-blur-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950">
              <AvatarImage src={liveCaller.avatarUrl} alt={liveCaller.name} />
              <AvatarFallback className="bg-indigo-600 text-white font-bold">
                {liveCaller.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
              {call.callType === 'video' ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-white truncate">{liveCaller.name}</p>
            <p className="text-xs text-emerald-400 font-semibold animate-pulse">
              {call.callType === 'video' ? 'Incoming Video Call…' : 'Incoming Audio Call…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDecline(call)}
            className="rounded-full h-10 w-10 p-0 bg-rose-600 hover:bg-rose-500"
            title="Decline Call"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(call)}
            className="rounded-full h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-lg shadow-emerald-600/30"
          >
            {call.callType === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            Answer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IncomingCallOverlay({
  currentUserUid,
  currentUserName,
}: {
  currentUserUid?: string;
  currentUserName?: string;
}) {
  const [incomingCalls, setIncomingCalls] = useState<IncomingCallDoc[]>([]);
  const [activeCall, setActiveCall] = useState<IncomingCallDoc | null>(null);

  useEffect(() => {
    if (!currentUserUid) return;
    const ref = collection(db, 'users', currentUserUid, 'incomingCalls');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const now = Date.now();
        const list: IncomingCallDoc[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const createdMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : now;
          // Ignore stale call documents older than 90 seconds
          if (now - createdMs < 90_000 && data.status === 'ringing') {
            list.push({ id: d.id, ...(data as any) });
          }
        });
        setIncomingCalls(list);
      },
      () => {}
    );
    return () => unsub();
  }, [currentUserUid]);

  const handleAccept = async (call: IncomingCallDoc) => {
    setActiveCall(call);
    if (currentUserUid) {
      deleteDoc(doc(db, 'users', currentUserUid, 'incomingCalls', call.id)).catch(() => {});
    }
  };

  const handleDecline = async (call: IncomingCallDoc) => {
    if (currentUserUid) {
      deleteDoc(doc(db, 'users', currentUserUid, 'incomingCalls', call.id)).catch(() => {});
    }
  };

  if (!currentUserUid) return null;

  return (
    <>
      {!activeCall && incomingCalls.length > 0 && (
        <IncomingCallCard
          call={incomingCalls[0]}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}

      {activeCall && (
        <CallView
          roomId={activeCall.roomId}
          userId={currentUserUid}
          userName={currentUserName || 'Me'}
          callType={activeCall.callType}
          callTargetUser={{
            uid: activeCall.callerUid,
            name: activeCall.callerName,
            handle: '',
            avatarUrl: activeCall.callerAvatar,
          }}
          onEndCall={() => setActiveCall(null)}
        />
      )}
    </>
  );
}
