"use client";
import { useEffect, useState } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { auth } from '@/lib/firebase';

export const NotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        const messaging = getMessaging();
        const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
        console.log('FCM token', token);
        // Optionally store token in Firestore linked to auth.currentUser.uid
      }
    } catch (e) {
      console.error('Permission request error', e);
    }
  };

  if (permission === 'granted') return null;

  return (
    <div className="p-2 bg-gray-100 border-b flex items-center justify-between">
      <span className="text-sm">Enable push notifications to stay up‑to‑date.</span>
      <button onClick={requestPermission} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded">
        Enable
      </button>
    </div>
  );
};
