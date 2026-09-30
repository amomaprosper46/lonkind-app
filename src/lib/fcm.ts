import { getMessagingInstance } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Requests notification permission and saves the FCM token to Firestore.
 * Uses the lazy getMessagingInstance() to ensure FCM is properly initialized.
 */
export async function requestNotificationPermission(uid: string) {
    try {
        const messaging = await getMessagingInstance();
        if (!messaging) return; // Not supported on this browser

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, { fcmToken: token });
        }
    } catch (err) {
        // Silent — permission denied or not supported
    }
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
