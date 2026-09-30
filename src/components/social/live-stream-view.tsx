'use client';

import { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_APP_ID, ZEGO_APP_SIGN, getLiveRoomId } from '@/lib/zego';

interface LiveStreamViewProps {
  hostUid: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isHost: boolean;
  onLeave: () => void;
}

export default function LiveStreamView({
  hostUid,
  userId,
  userName,
  isHost,
  onLeave,
}: LiveStreamViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomId = getLiveRoomId(hostUid || userId || 'default_host');
  const validUserId = userId || `user_${Math.floor(Math.random() * 100000)}`;
  const validUserName = userName || 'Guest User';

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('Zego Live Streaming setup:', { ZEGO_APP_ID, roomId, validUserId, validUserName, isHost });

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
      onLeaveRoom: () => {
        onLeave();
      },
    });

    return () => {
      try { zp.destroy(); } catch (_) {}
    };
  }, [roomId, validUserId, validUserName, isHost, onLeave]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
