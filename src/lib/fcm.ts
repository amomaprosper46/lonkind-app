import { messaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(uid: string) {
    if (!messaging) return; // Messaging is not supported on this browser

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                // Save the token to the user's Firestore document
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, { fcmToken: token });
                console.log('FCM Token generated and saved.');
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Notification permission not granted.');
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
    }
}

export function setupForegroundMessageListener() {
    if (!messaging) return;
    
    onMessage(messaging, (payload) => {
        console.log('Message received in foreground. ', payload);
        // You could trigger a toast here if you wanted foreground notifications
    });
}
