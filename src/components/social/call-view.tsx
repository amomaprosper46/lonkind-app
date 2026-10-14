'use client';

import { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_APP_ID, getZegoServerSecret, isValidZegoSecret } from '@/lib/zego';
import { Button } from '@/components/ui/button';
import { AlertTriangle, PhoneOff } from 'lucide-react';

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

export default function CallView({ roomId, userId, userName, callType, onEndCall }: CallViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRoomRef = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const secret = getZegoServerSecret();
    if (!isValidZegoSecret(secret)) {
      setAuthError('ZEGOCLOUD 32-character ServerSecret is required to connect audio/video calls.');
      return;
    }

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        ZEGO_APP_ID,
        secret,
        roomId,
        userId,
        userName,
        7200
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);

      zp.joinRoom({
        container: containerRef.current,
        sharedLinks: [],
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        turnOnCameraWhenJoining: callType === 'video',
        turnOnMicrophoneWhenJoining: true,
        showPreJoinView: false,
        onJoinRoom: () => {
          hasJoinedRoomRef.current = true;
          setAuthError(null);
        },
        onLeaveRoom: () => {
          if (hasJoinedRoomRef.current) {
            onEndCall();
          } else {
            setAuthError('Connection failed or rejected by ZEGOCLOUD server.');
          }
        },
      });

      return () => {
        try { zp.destroy(); } catch (_) {}
      };
    } catch (e: any) {
      console.error('Call initialization error:', e);
      setAuthError(e.message || 'Call failed to initialize.');
    }
  }, [roomId, userId, userName, callType, onEndCall]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {authError ? (
        <div className="max-w-md w-full mx-4 p-6 bg-slate-900/95 border border-red-500/40 rounded-2xl text-center shadow-2xl text-white">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">Call Connection Error</h3>
          <p className="text-sm text-slate-300 mb-6">{authError}</p>
          <Button onClick={onEndCall} className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2 rounded-full flex items-center gap-2 mx-auto">
            <PhoneOff className="h-4 w-4" /> End Call
          </Button>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}
    </div>
  );
}
