'use client';

import React, { useEffect, useState, memo } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface RealtimePresencePayload {
  state: 'online' | 'offline';
  last_changed?: number | string | { seconds?: number; [key: string]: any };
}

/**
 * Safely parse variations of timestamps into valid JavaScript Date objects.
 * Protects runtime execution flows from invalid database formatting types.
 */
function safelyParseDate(timestamp: any): Date | null {
  if (!timestamp) return null;

  // Handle standard millisecond integer representations
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  // Handle accidental inclusions of Cloud Firestore structural maps
  if (typeof timestamp === 'object' && typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }

  // Handle standard raw ISO-8601 text strings
  if (typeof timestamp === 'string') {
    const parsedDate = new Date(timestamp);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

/**
 * COMPONENT: OnlineStatusBadge
 * Renders a secure, high-visibility green dot over avatar frames if user is active.
 */
export const OnlineStatusBadge = memo(function OnlineStatusBadge({ 
  uid, 
  className 
}: { 
  uid: string; 
  className?: string; 
}) {
  const [status, setStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    if (!uid) return;

    const statusRef = ref(rtdb, `status/${uid}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val() as RealtimePresencePayload | null;
      if (data?.state === 'online') {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    }, (error) => {
      console.error(`Presence subscription failed for target identity user ${uid}:`, error);
      setStatus('offline');
    });

    return () => unsubscribe();
  }, [uid]);

  if (status !== 'online') return null;

  return (
    <span 
      className={cn(
        "absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full ring-0", 
        className
      )} 
      aria-label="User is currently online"
      title="Online" 
    />
  );
});

/**
 * COMPONENT: OnlineStatusText
 * Emits clear text strings displaying either "Online" or localized relative historical gaps.
 */
export const OnlineStatusText = memo(function OnlineStatusText({ 
  uid, 
  className 
}: { 
  uid: string; 
  className?: string; 
}) {
  const [statusData, setStatusData] = useState<RealtimePresencePayload | null>(null);

  useEffect(() => {
    if (!uid) return;

    const statusRef = ref(rtdb, `status/${uid}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      setStatusData(snapshot.val());
    }, (error) => {
      console.error(`Text baseline presence syncing tracking error for user ${uid}:`, error);
      setStatusData(null);
    });

    return () => unsubscribe();
  }, [uid]);

  if (!statusData) return null;

  if (statusData.state === 'online') {
    return <p className={cn("text-xs text-emerald-500 font-semibold tracking-wide", className)}>Online</p>;
  }

  const validTargetDate = safelyParseDate(statusData.last_changed);
  
  if (validTargetDate) {
    try {
      return (
        <p className={cn("text-xs text-muted-foreground/90 font-medium", className)}>
          Last seen {formatDistanceToNow(validTargetDate, { addSuffix: true })}
        </p>
      );
    } catch (parseError) {
      console.error("Relative timestamp calculations crashed unexpectedly:", parseError);
      return null;
    }
  }

  return <p className={cn("text-xs text-muted-foreground/70 font-medium", className)}>Offline</p>;
});