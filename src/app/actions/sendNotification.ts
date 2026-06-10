'use server';

import * as admin from 'firebase-admin';

function getAdminApp() {
    if (!admin.apps.length) {
        try {
            const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
                ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
                : undefined;
                
            if (sa) {
                admin.initializeApp({
                    credential: admin.credential.cert(sa),
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                });
            } else {
                admin.initializeApp({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                });
            }
        } catch (error) {
            console.error('Failed to initialize Firebase Admin in sendNotification:', error);
        }
    }
    return admin.apps[0];
}

export async function sendPushNotification(recipientUid: string, title: string, body: string, data?: Record<string, string>) {
    try {
        const app = getAdminApp();
        if (!app) {
            console.log("Firebase Admin not fully initialized, skipping push notification.");
            return { success: false, error: 'Firebase Admin not initialized' };
        }
        
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(recipientUid).get();
        if (!userDoc.exists) return { success: false, error: 'User not found' };

        const userData = userDoc.data();
        const token = userData?.fcmToken;

        if (!token) return { success: false, error: 'User has no token' }; // User has not enabled push notifications

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
