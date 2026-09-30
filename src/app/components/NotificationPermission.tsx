// src/app/components/NotificationPermission.tsx
import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase'; // default Firebase app
import { db } from '@/lib/firebase'; // Firestore instance

export default function NotificationPermission() {
  useEffect(() => {
    const initFCM = async () => {
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) return; // not logged in yet
      try {
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });
        if (token) {
          await setDoc(doc(db, 'users', user.uid), { fcmToken: token }, { merge: true });
          console.log('FCM token saved for user', user.uid);
        }
      } catch (e) {
        console.error('FCM token error', e);
      }
    };
    Notification.requestPermission()
      .then((perm) => {
        if (perm === 'granted') initFCM();
        else console.warn('Notification permission not granted');
      })
      .catch((e) => console.error('Permission request error', e));

    const unsubscribe = onMessage(getMessaging(app), (payload) => {
      console.log('Foreground message', payload);
    });
    return () => unsubscribe();
  }, []);
  return null;
}
