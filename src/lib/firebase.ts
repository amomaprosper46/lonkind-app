// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  getToken as getAppCheckToken,
  type AppCheck,
} from "firebase/app-check";

// Your web app's Firebase configuration
// These values are read from environment variables for deployment.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigValid = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

// Initialize Firebase Safely (Vercel SSR compatible)
export let app: FirebaseApp | undefined;
if (isFirebaseConfigValid) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
}

export const db = (app ? getFirestore(app) : null) as unknown as ReturnType<typeof getFirestore>;
export const auth = (app ? getAuth(app) : null) as unknown as ReturnType<typeof getAuth>;
export const storage = (app ? getStorage(app) : null) as unknown as ReturnType<typeof getStorage>;
export const rtdb = (app ? getDatabase(app) : null) as unknown as ReturnType<typeof getDatabase>;

// Initialize App Check (browser-only, supports reCAPTCHA Enterprise or v3)
export let appCheckInstance: AppCheck | null = null;
if (typeof window !== "undefined" && app) {
  try {
    if (process.env.NODE_ENV === "development") {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
        process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
    }
    const enterpriseKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || "";
    const v3Key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
    if (enterpriseKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(enterpriseKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (v3Key && v3Key !== "missing-recaptcha-key") {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(v3Key),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (e) {
    console.warn("Firebase App Check initialization skipped:", e);
  }
}

/**
 * Helper for client API calls to attach `X-Firebase-AppCheck` token header when active.
 */
export async function getAppCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheckInstance) return {};
  try {
    const res = await getAppCheckToken(appCheckInstance, false);
    return res?.token ? { "X-Firebase-AppCheck": res.token } : {};
  } catch {
    return {};
  }
}

/**
 * Returns the Firebase Messaging instance, lazily initializing it on first call.
 * Properly handles the async `isSupported()` check.
 * Call this instead of importing `messaging` directly.
 */
let _messagingInstance: Messaging | null = null;
export async function getMessagingInstance(): Promise<Messaging | null> {
    if (typeof window === "undefined" || !app) return null;
    if (_messagingInstance) return _messagingInstance;
    try {
        const supported = await isSupported();
        if (supported) {
            _messagingInstance = getMessaging(app);
            return _messagingInstance;
        }
    } catch (e) {
        // Browser doesn't support FCM (e.g., Safari without permission)
    }
    return null;
}
