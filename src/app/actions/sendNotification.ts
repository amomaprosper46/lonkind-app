'use server';
/**
 * @fileOverview Secure Firebase Cloud Messaging (FCM) delivery microservice engine.
 * Implements high-priority device waking configurations and automatic stale-token 
 * data cleaning logic for invalid notification tokens.
 */

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

interface NotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a highly targeted transactional or social push notification payload.
 * Automatically strips stale or revoked device tokens from the Firestore user document upon delivery failure.
 */
export async function sendPushNotification(
  recipientUid: string, 
  title: string, 
  body: string, 
  data?: Record<string, string>
): Promise<NotificationResult> {
  
  const app = getAdminApp();
  if (!app) {
    console.error("Firebase Admin execution aborted. Context initialization missing.");
    return { success: false, error: 'Firebase Admin initialization failure.' };
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(recipientUid);

  try {
    // 1. Recover device authorization tokens from secure user collections
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return { success: false, error: 'Target user record not found.' };
    }

    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (!token) {
      return { success: false, error: 'Notification tracking omitted. Device token not registered.' };
    }

    /**
     * 2. Comprehensive OS Configuration Mapping
     * Explicit platform instructions ensure real-time delivery behavior,
     * waking sleeping screens and applying badge icons uniformly.
     */
    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'lonkind_alerts_channel', // Essential requirement for Android 8.0+ custom sounds
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK', // Integrates with native mobile layout navigation targets
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1, // Increments local application frame layout metrics
          },
        },
      },
    };

    // 3. Dispatch payload straight to FCM Cloud Systems
    await admin.messaging().send(message);
    console.log(`[FCM SUCCESS]: Notification successfully routed to user: ${recipientUid}`);
    return { success: true };

  } catch (error: any) {
    console.error(`[FCM FAILURE]: Exception encountered routing to user ${recipientUid}:`, error);

    /**
     * 4. Automatic Self-Healing Token Lifecycle Clean-up
     * Detects if the device has uninstalled the application or revoked its background permissions.
     * Stale tokens are immediately removed from Firestore to prevent resource waste.
     */
    const invalidTokenErrorCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
    ];

    if (invalidTokenErrorCodes.includes(error.code) || error.message?.includes('not registered')) {
      console.warn(`[DATA MAINTENANCE]: Pruning invalid/stale device token from document profile: ${recipientUid}`);
      try {
        await userRef.update({
          fcmToken: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (dbCleanupError) {
        console.error('Data purging tracking loop broken:', dbCleanupError);
      }
    }

    return { success: false, error: error.message || 'An operational messaging error occurred.' };
  }
}