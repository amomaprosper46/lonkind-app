'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Phone } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { getCallRoomId } from '@/lib/zego';
import dynamic from 'next/dynamic';

const CallView = dynamic(() => import('./call-view'), { ssr: false });

interface CallButtonProps {
  targetUserId?: string;
  targetUserName?: string;
  targetUserAvatar?: string;
}

export function CallButton({ targetUserId, targetUserName = 'User', targetUserAvatar = '' }: CallButtonProps) {
  const [user] = useAuthState(auth);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);

  if (!targetUserId || !user) return null;

  const roomId = getCallRoomId(user.uid, targetUserId);

  return (
    <>
      <div className="flex gap-2 items-center mr-2">
        <Button
          variant="ghost"
          size="icon"
          title="Audio Call"
          onClick={() => setCallType('audio')}
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Video Call"
          onClick={() => setCallType('video')}
        >
          <Video className="h-4 w-4" />
        </Button>
      </div>

      {callType && (
        <CallView
          roomId={roomId}
          userId={user.uid}
          userName={user.displayName || 'Me'}
          callType={callType}
          callTargetUser={{
            uid: targetUserId,
            name: targetUserName,
            handle: '',
            avatarUrl: targetUserAvatar,
          }}
          onEndCall={() => setCallType(null)}
        />
      )}
    </>
  );
}
