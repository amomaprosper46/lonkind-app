'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

const LiveStreamView = dynamic(() => import('@/components/social/live-stream-view'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3 text-white">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      <p className="text-xs font-bold text-zinc-400">Connecting to Lonkind Live Room...</p>
    </div>
  ),
});

interface LiveStreamPageClientProps {
  hostUid: string;
}

export default function LiveStreamPageClient({ hostUid }: LiveStreamPageClientProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    handle: string;
    avatarUrl: string;
    coins: number;
  } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!fbUser?.uid) {
      setUserProfile(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data() || {};
        setUserProfile({
          name: d.name || fbUser.displayName || 'Lonkind User',
          handle: d.handle || '',
          avatarUrl: d.avatarUrl || fbUser.photoURL || '',
          coins: Number(d.coins || 0),
        });
      }
    });
    return () => unsub();
  }, [fbUser?.uid, fbUser?.displayName, fbUser?.photoURL]);

  if (!authReady) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-xs font-bold text-zinc-400">Loading Live Stream...</p>
      </div>
    );
  }

  const cleanHostUid = hostUid.replace(/^live_/, '');
  const isHost = Boolean(fbUser?.uid && fbUser.uid === cleanHostUid);

  return (
    <LiveStreamView
      hostUid={cleanHostUid}
      userId={fbUser?.uid || ''}
      userName={userProfile?.name || fbUser?.displayName || 'Guest Viewer'}
      userHandle={userProfile?.handle || ''}
      userAvatar={userProfile?.avatarUrl || fbUser?.photoURL || ''}
      isHost={isHost}
      isGuest={!fbUser}
      userCoins={userProfile?.coins || 0}
      onLeave={() => router.push('/')}
      onGoToWallet={() => router.push('/settings/wallet')}
      onRequireAuth={() => router.push(`/?live=${encodeURIComponent(cleanHostUid)}`)}
    />
  );
}
