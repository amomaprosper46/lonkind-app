'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, PhoneOff, Mic, MicOff, Video, VideoOff, RefreshCw, Loader2 } from 'lucide-react';

interface UserProfile {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
}

interface CallViewProps {
  roomId: string;
  userId: string;
  userName: string;
  callType: 'audio' | 'video';
  callTargetUser: UserProfile;
  onEndCall: () => void;
}

const FREE_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export default function CallView({
  roomId,
  userId,
  userName,
  callType,
  callTargetUser,
  onEndCall,
}: CallViewProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(callType === 'video');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const signalingRoomId = `call_${roomId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const isPoliteCaller = userId < (callTargetUser?.uid || '');

  useEffect(() => {
    let isCancelled = false;
    let unsub: (() => void) | null = null;
    const myDocRef = doc(db, 'live_streams', signalingRoomId, 'viewers', userId);

    const startCall = async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: true,
        });
      } catch (err) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (audioErr: any) {
          if (!isCancelled) {
            setAuthError('Please allow microphone/camera permissions to join the call.');
          }
          return;
        }
      }

      if (isCancelled || !stream) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(FREE_RTC_CONFIG);
      peerRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream!);
      });

      const remoteStream = new MediaStream();
      pc.ontrack = (event) => {
        if (event.streams?.[0]) {
          event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
        } else if (event.track) {
          remoteStream.addTrack(event.track);
        }
        setIsConnected(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
      };

      const myCandidates: any[] = [];
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          myCandidates.push(event.candidate.toJSON());
          setDoc(myDocRef, { candidates: myCandidates }, { merge: true }).catch(() => {});
        }
      };

      await setDoc(
        myDocRef,
        {
          uid: userId,
          name: userName,
          joinedAt: serverTimestamp(),
          candidates: [],
        },
        { merge: true }
      );

      let addedRemoteCands = 0;
      let hasCreatedOffer = false;

      const viewersCol = collection(db, 'live_streams', signalingRoomId, 'viewers');
      unsub = onSnapshot(viewersCol, async (snapshot) => {
        if (isCancelled) return;

        for (const docSnap of snapshot.docs) {
          if (docSnap.id === userId) continue;
          const remoteData = docSnap.data();

          // Create offer if we are the deterministic initiator or if remote joined without an offer
          if (isPoliteCaller && !hasCreatedOffer && !remoteData.offer && !pc.localDescription) {
            hasCreatedOffer = true;
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await setDoc(myDocRef, { offer: { type: offer.type, sdp: offer.sdp } }, { merge: true });
            } catch (e) {
              console.warn('Error creating call offer:', e);
            }
          }

          // If remote posted an offer and we haven't set remote description yet
          if (remoteData.offer && !pc.currentRemoteDescription) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(remoteData.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await setDoc(myDocRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });
            } catch (e) {
              console.warn('Error answering call offer:', e);
            }
          }

          // If remote posted an answer to our offer
          if (remoteData.answer && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(remoteData.answer));
            } catch (e) {
              console.warn('Error setting call remote answer:', e);
            }
          }

          // Add remote ICE candidates
          const remoteCands = Array.isArray(remoteData.candidates) ? remoteData.candidates : [];
          if (remoteCands.length > addedRemoteCands && pc.remoteDescription) {
            for (let i = addedRemoteCands; i < remoteCands.length; i++) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(remoteCands[i]));
              } catch (_) {}
            }
            addedRemoteCands = remoteCands.length;
          }
        }
      });
    };

    startCall();

    return () => {
      isCancelled = true;
      if (unsub) unsub();
      deleteDoc(myDocRef).catch(() => {});
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerRef.current) {
        try {
          peerRef.current.close();
        } catch (_) {}
        peerRef.current = null;
      }
    };
  }, [signalingRoomId, userId, userName, callType, isPoliteCaller]);

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const toggleCam = () => {
    const next = !isCamOn;
    setIsCamOn(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const flipCam = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = s.getVideoTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = isCamOn;
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
        localStreamRef.current.addTrack(newTrack);
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      const sender = peerRef.current?.getSenders().find((x) => x.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(newTrack).catch(() => {});
      }
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden select-none">
      {authError ? (
        <div className="max-w-md w-full mx-4 p-6 bg-slate-900/95 border border-red-500/40 rounded-2xl text-center shadow-2xl text-white">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">Call Permission Required</h3>
          <p className="text-sm text-slate-300 mb-6">{authError}</p>
          <Button
            onClick={onEndCall}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2 rounded-full flex items-center gap-2 mx-auto"
          >
            <PhoneOff className="h-4 w-4" /> End Call
          </Button>
        </div>
      ) : (
        <>
          {/* Remote Video / Audio Avatar Stage */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${
              callType === 'video' && isConnected ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />

          {(callType === 'audio' || !isConnected) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/60 via-slate-950 to-black p-6 text-center">
              <div className="relative flex items-center justify-center mb-5">
                <div className="absolute h-36 w-36 rounded-full bg-indigo-500/20 animate-ping" />
                <Avatar className="h-28 w-28 border-4 border-indigo-400 shadow-2xl">
                  <AvatarImage src={callTargetUser?.avatarUrl} alt={callTargetUser?.name} />
                  <AvatarFallback className="bg-indigo-600 text-white text-3xl font-bold">
                    {callTargetUser?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h2 className="text-xl font-black text-white mb-1">{callTargetUser?.name || 'Lonkind User'}</h2>
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold">
                {!isConnected && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isConnected ? 'Connected · HD Voice' : 'Calling...'}</span>
              </div>
            </div>
          )}

          {/* Local Self-View PiP (when in video call) */}
          {callType === 'video' && (
            <div className="absolute top-6 right-4 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-900 z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''} ${
                  isCamOn ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          )}

          {/* Bottom Call Controls */}
          <div className="absolute bottom-8 left-0 right-0 z-30 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={toggleMic}
              className={`h-12 w-12 rounded-full flex items-center justify-center border shadow-xl transition-all ${
                isMicOn
                  ? 'bg-slate-900/90 text-white border-white/20'
                  : 'bg-rose-600 text-white border-rose-400'
              }`}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            {callType === 'video' && (
              <>
                <button
                  type="button"
                  onClick={toggleCam}
                  className={`h-12 w-12 rounded-full flex items-center justify-center border shadow-xl transition-all ${
                    isCamOn
                      ? 'bg-slate-900/90 text-white border-white/20'
                      : 'bg-rose-600 text-white border-rose-400'
                  }`}
                >
                  {isCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={flipCam}
                  className="h-12 w-12 rounded-full bg-slate-900/90 text-white border border-white/20 flex items-center justify-center shadow-xl"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onEndCall}
              className="h-12 px-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center gap-2 shadow-2xl border border-rose-400/50"
            >
              <PhoneOff className="h-5 w-5" />
              <span>End</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
