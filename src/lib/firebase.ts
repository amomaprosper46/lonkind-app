// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging, isSupported } from "firebase/messaging";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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
let app: FirebaseApp | undefined;
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

let messagingInstance: any = null;
if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    // 1. Initialize App Check
    if (app) {
        try {
            // In development, automatically generate a debug token in the browser console
            if (process.env.NODE_ENV === 'development') {
                (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
            }
            
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 'missing-recaptcha-key'),
                isTokenAutoRefreshEnabled: true
            });
        } catch (e) {
            console.error("Firebase App Check failed to initialize", e);
        }
    }

    // 2. Initialize Messaging
    isSupported().then((supported) => {
        if (supported && app) {
            messagingInstance = getMessaging(app);
        }
    });
}
export const messaging = messagingInstance;
