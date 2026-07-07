import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getFirebaseAdminServiceAccount } from './parse-service-account';

function initApp() {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!; // Returns the existing app, completely bypassing the bugged getApp() "[DEFAULT]" lookup.
  }

  const sa = getFirebaseAdminServiceAccount();
  if (sa) {
    return initializeApp({ credential: cert(sa) });
  } else {
    console.warn("Could not parse LONKIND_ADMIN_SERVICE_ACCOUNT. Falling back to default project ID.");
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'impactful-ideas' });
  }
}

const app = initApp();

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);
