'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface LiveUserProfile {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
  isProfessional?: boolean;
}

interface CacheEntry {
  profile: LiveUserProfile | null;
  listeners: Set<(profile: LiveUserProfile | null) => void>;
  unsubscribeFirestore: (() => void) | null;
}

/**
 * Shared module-level real-time cache for `users/{uid}` documents.
 * Ensures that even if 50 historical posts/comments/messages from the same user
 * are rendered on screen, only ONE Firestore `onSnapshot` listener is opened per `uid`,
 * and every post (even from years ago) immediately reflects the user's latest avatar, name, and handle.
 */
const liveProfileCache = new Map<string, CacheEntry>();

function subscribeToUserProfile(
  uid: string,
  callback: (profile: LiveUserProfile | null) => void
): () => void {
  let entry = liveProfileCache.get(uid);

  if (!entry) {
    entry = {
      profile: null,
      listeners: new Set(),
      unsubscribeFirestore: null,
    };
    liveProfileCache.set(uid, entry);

    const userRef = doc(db, 'users', uid);
    entry.unsubscribeFirestore = onSnapshot(
      userRef,
      (snap) => {
        const currentEntry = liveProfileCache.get(uid);
        if (!currentEntry) return;
        if (snap.exists()) {
          const data = snap.data();
          currentEntry.profile = {
            uid,
            name: data.name || '',
            handle: data.handle || '',
            avatarUrl: data.avatarUrl || '',
            isProfessional: data.isProfessional,
          };
        }
        currentEntry.listeners.forEach((listener) => listener(currentEntry.profile));
      },
      () => {
        // Ignore permission or transient offline errors; fallback values will be used
      }
    );
  }

  entry.listeners.add(callback);
  if (entry.profile) {
    callback(entry.profile);
  }

  return () => {
    const currentEntry = liveProfileCache.get(uid);
    if (!currentEntry) return;
    currentEntry.listeners.delete(callback);
    if (currentEntry.listeners.size === 0) {
      if (currentEntry.unsubscribeFirestore) {
        currentEntry.unsubscribeFirestore();
      }
      liveProfileCache.delete(uid);
    }
  };
}

/**
 * Hook that resolves the live profile (avatarUrl, name, handle) for any user UID,
 * falling back to the embedded snapshot values until the live user document resolves.
 */
export function useLiveUserProfile(
  uid?: string | null,
  fallbackAvatarUrl?: string,
  fallbackName?: string,
  fallbackHandle?: string
): {
  avatarUrl: string;
  name: string;
  handle: string;
  isProfessional?: boolean;
} {
  const [liveProfile, setLiveProfile] = useState<LiveUserProfile | null>(() => {
    if (!uid) return null;
    return liveProfileCache.get(uid)?.profile || null;
  });

  useEffect(() => {
    if (!uid) {
      setLiveProfile(null);
      return;
    }
    return subscribeToUserProfile(uid, setLiveProfile);
  }, [uid]);

  return {
    avatarUrl: liveProfile?.avatarUrl || fallbackAvatarUrl || '',
    name: liveProfile?.name || fallbackName || 'Lonkind Member',
    handle: liveProfile?.handle || fallbackHandle || 'member',
    isProfessional: liveProfile?.isProfessional,
  };
}
