
'use client';

import { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, rtdb } from '@/lib/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';

export default function PresenceSystem() {
    const [user] = useAuthState(auth);

    useEffect(() => {
        if (!user) return;

        const uid = user.uid;
        const userStatusDatabaseRef = ref(rtdb, '/status/' + uid);

        const isOfflineForDatabase = {
            state: 'offline',
            last_changed: serverTimestamp(),
        };

        const isOnlineForDatabase = {
            state: 'online',
            last_changed: serverTimestamp(),
        };

        const connectedRef = ref(rtdb, '.info/connected');
        const unsubscribe = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === false) {
                return;
            }

            onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
                set(userStatusDatabaseRef, isOnlineForDatabase);
            });
        });

        return () => {
            unsubscribe();
            // Go offline if component unmounts.
             const userStatusRef = ref(rtdb, '/status/' + uid);
             set(userStatusRef, isOfflineForDatabase);
        };
    }, [user]);

    return null;
}
