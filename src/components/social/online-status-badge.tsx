'use client';

import React, { useEffect, useState } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function OnlineStatusBadge({ uid, className }: { uid: string, className?: string }) {
    const [status, setStatus] = useState<'online' | 'offline'>('offline');

    useEffect(() => {
        if (!uid) return;
        const statusRef = ref(rtdb, '/status/' + uid);
        const unsub = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setStatus(data.state === 'online' ? 'online' : 'offline');
            } else {
                setStatus('offline');
            }
        });
        return () => unsub();
    }, [uid]);

    if (status !== 'online') return null;

    return (
        <span className={cn("absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full", className)} title="Online" />
    );
}

export function OnlineStatusText({ uid, className }: { uid: string, className?: string }) {
    const [statusData, setStatusData] = useState<{ state: 'online' | 'offline', last_changed?: number } | null>(null);

    useEffect(() => {
        if (!uid) return;
        const statusRef = ref(rtdb, '/status/' + uid);
        const unsub = onValue(statusRef, (snapshot) => {
            setStatusData(snapshot.val());
        });
        return () => unsub();
    }, [uid]);

    if (!statusData) return null;

    if (statusData.state === 'online') {
        return <p className={cn("text-xs text-green-500 font-medium", className)}>Online</p>;
    }

    if (statusData.last_changed) {
        return <p className={cn("text-xs text-muted-foreground", className)}>Last seen {formatDistanceToNow(new Date(statusData.last_changed), { addSuffix: true })}</p>;
    }

    return null;
}
