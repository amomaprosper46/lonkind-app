'use client';

import { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_APP_ID, ZEGO_APP_SIGN } from '@/lib/zego';

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

  useEffect(() => {
    if (!containerRef.current) return;

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      ZEGO_APP_ID,
      ZEGO_APP_SIGN,
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
      onLeaveRoom: () => {
        onEndCall();
      },
    });

    return () => {
      try { zp.destroy(); } catch (_) {}
    };
  }, [roomId, userId, userName, callType, onEndCall]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
