'use server';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}

const db = admin.firestore();

export async function sendPushNotification(recipientUid: string, title: string, body: string, data?: Record<string, string>) {
    try {
        const userDoc = await db.collection('users').doc(recipientUid).get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const token = userData?.fcmToken;

        if (!token) return; // User has not enabled push notifications

        const message = {
            token,
            notification: {
                title,
                body,
            },
            data: data || {},
        };

        await admin.messaging().send(message);
        console.log(`Successfully sent push notification to ${recipientUid}`);
        return { success: true };
    } catch (error) {
        console.error('Error sending push notification:', error);
        return { success: false, error };
    }
}
