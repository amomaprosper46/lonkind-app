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
  const roomId = getLiveRoomId(hostUid);

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
  }, [roomId, userId, userName, isHost, onLeave]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
