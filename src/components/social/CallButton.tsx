'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Phone } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { getCallRoomId } from '@/lib/zego';
import { sendPushNotification } from '@/app/actions/sendNotification';
import dynamic from 'next/dynamic';

const CallView = dynamic(() => import('./call-view'), { ssr: false });

interface CallButtonProps {
  targetUserId?: string;
  targetUserName?: string;
  targetUserAvatar?: string;
  conversationId?: string | null;
  compact?: boolean;
}

export function CallButton({
  targetUserId,
  targetUserName = 'User',
  targetUserAvatar = '',
  conversationId,
  compact = false,
}: CallButtonProps) {
  const [user] = useAuthState(auth);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);

  if (!targetUserId || !user) return null;

  const roomId = getCallRoomId(user.uid, targetUserId);
  const incomingCallDocId = roomId.replace(/[^a-zA-Z0-9_]/g, '_');

  const startCallSession = async (type: 'audio' | 'video') => {
    setCallType(type);

    try {
      // 1. Ring the recipient in real time via Firestore incomingCalls subcollection
      const incomingCallRef = doc(db, 'users', targetUserId, 'incomingCalls', incomingCallDocId);
      await setDoc(incomingCallRef, {
        roomId,
        callType: type,
        callerUid: user.uid,
        callerName: user.displayName || 'Lonkind Member',
        callerAvatar: user.photoURL || '',
        status: 'ringing',
        createdAt: serverTimestamp(),
      });

      // 2. Log call event inside the conversation thread if conversationId is known
      if (conversationId) {
        await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
          senderId: user.uid,
          text: type === 'video' ? '📹 Started a video call' : '📞 Started an audio call',
          type: 'text',
          isCallEvent: true,
          callType: type,
          timestamp: serverTimestamp(),
        }).catch(() => {});
      }

      // 3. Send push notification
      sendPushNotification(
        targetUserId,
        type === 'video'
          ? `📹 Incoming Video Call from ${user.displayName || 'Someone'}`
          : `📞 Incoming Audio Call from ${user.displayName || 'Someone'}`,
        'Tap to answer the call on Lonkind.',
        { url: `/?view=messages`, type: 'incoming_call', roomId, callType: type }
      ).catch(() => {});
    } catch (err) {
      console.warn('Could not write incoming call signal:', err);
    }
  };

  const endCallSession = async () => {
    setCallType(null);
    try {
      const incomingCallRef = doc(db, 'users', targetUserId, 'incomingCalls', incomingCallDocId);
      await deleteDoc(incomingCallRef);
    } catch (_) {}
  };

  return (
    <>
      <div className="flex gap-1.5 items-center shrink-0">
        <Button
          variant="ghost"
          size="icon"
          title={`Audio Call ${targetUserName}`}
          onClick={(e) => {
            e.stopPropagation();
            startCallSession('audio');
          }}
          className={
            compact
              ? 'h-7 w-7 rounded-full text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              : 'h-9 w-9 rounded-full text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20'
          }
        >
          <Phone className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={`Video Call ${targetUserName}`}
          onClick={(e) => {
            e.stopPropagation();
            startCallSession('video');
          }}
          className={
            compact
              ? 'h-7 w-7 rounded-full text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
              : 'h-9 w-9 rounded-full text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/20'
          }
        >
          <Video className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
          onEndCall={endCallSession}
        />
      )}
    </>
  );
}
