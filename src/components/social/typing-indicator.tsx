'use client';

import React, { useEffect, useState } from 'react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Loader2 } from 'lucide-react';

export function TypingIndicator({ conversationId, uid }: { conversationId: string, uid: string }) {
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (!conversationId || !uid) return;
        
        const typingRef = ref(rtdb, `/typing/${conversationId}/${uid}`);
        const unsub = onValue(typingRef, (snapshot) => {
            setIsTyping(snapshot.val() === true);
        });

        return () => unsub();
    }, [conversationId, uid]);

    if (!isTyping) return null;

    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground italic mb-2 px-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>User is typing...</span>
        </div>
    );
}
