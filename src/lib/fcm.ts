import { getMessagingInstance } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export interface PushTokenResult {
    token: string | null;
    permission: NotificationPermission | 'unsupported';
}

/**
 * Ensures push notification permission is requested cleanly if not already granted,
 * retrieves the user's Web Push FCM token, saves it to `users/{uid}.fcmToken`,
 * and returns the token + permission state for features like "Remind Me".
 */
export async function ensurePushTokenForUser(uid: string): Promise<PushTokenResult> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return { token: null, permission: 'unsupported' };
    }

    try {
        let permission: NotificationPermission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            return { token: null, permission };
        }

        const messaging = await getMessagingInstance();
        if (!messaging) {
            return { token: null, permission: 'unsupported' };
        }

        const token = await getToken(messaging, VAPID_KEY ? { vapidKey: VAPID_KEY } : undefined);
        if (token && uid) {
            try {
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, { fcmToken: token });
            } catch {
                // Non-fatal if profile doc update is throttled
            }
        }
        return { token: token || null, permission };
    } catch {
        return { token: null, permission: Notification.permission };
    }
}

/**
 * Requests notification permission and saves the FCM token to Firestore.
 * Uses the lazy getMessagingInstance() to ensure FCM is properly initialized.
 */
export async function requestNotificationPermission(uid: string) {
    await ensurePushTokenForUser(uid);
}

/**
 * Listens for foreground push notifications and shows a browser toast.
 * Also triggers a native Notification if the app is focused but user prefers it.
 */
export async function setupForegroundMessageListener(
    onNotification?: (title: string, body: string, data?: any) => void
) {
    try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        onMessage(messaging, (payload) => {
            const title = payload.notification?.title || 'Lonkind';
            const body = payload.notification?.body || '';
            const data = payload.data;

            // Notify the in-app UI if a callback was provided (e.g., show toast)
            if (onNotification) {
                onNotification(title, body, data);
            }
        });
    } catch (err) {
        // Silent — not critical
    }
}
