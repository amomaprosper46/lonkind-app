import * as admin from 'firebase-admin';
import { getFirebaseAdminServiceAccount } from './parse-service-account';

if (!admin.apps.length) {
  let credential;

  const sa = getFirebaseAdminServiceAccount();
  if (sa) {
    credential = admin.credential.cert(sa);
  } else {
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
