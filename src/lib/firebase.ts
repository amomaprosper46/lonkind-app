// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);


// Copy these key-value pairs into your Vercel project's Environment Variables settings:
/*
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAk4DcDNed4OWSahdV56ll1wI973-0wgS4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=impactful-ideas.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://impactful-ideas-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=impactful-ideas
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=impactful-ideas.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=494901200454
NEXT_PUBLIC_FIREBASE_APP_ID=1:494901200454:web:0ea71cc5dbe22b22f6ac47
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-P5TSD6JL5Y
*/
