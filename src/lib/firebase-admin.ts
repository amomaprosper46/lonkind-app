import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  let credential;
  try {
    if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT));
    } else {
      credential = admin.credential.applicationDefault();
    }
  } catch (error) {
    console.warn("Could not parse FIREBASE_ADMIN_SERVICE_ACCOUNT. Falling back to applicationDefault().");
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
      credential,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
