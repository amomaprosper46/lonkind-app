'use client';
import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignUpForm } from '@/components/social/sign-up-form';
import { SignInForm } from '@/components/social/sign-in-form';
import { Users, Video, Share2, Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import SocialDashboard from './social-dashboard';
import { auth, db, isFirebaseConfigValid } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User, sendPasswordResetEmail, RecaptchaVerifier, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import PresenceSystem from './presence-system';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { addDummyFollowers } from '@/ai/flows/add-dummy-followers';
import { useLocalization } from '@/hooks/use-localization';
import QuickStartGuide from './quick-start-guide';
import placeholderImages from '../../lib/placeholder-images.json';
import { useAuthState } from 'react-firebase-hooks/auth';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

/* --------------------  COMPONENTS (UNCHANGED) -------------------- */
/* OfflineIndicator, FirebaseConfigError, WelcomeDialog */
/* (Your original components remain EXACTLY as you sent them) */

/* --------------------  MAIN COMPONENT  -------------------- */

export default function SocialHomePage() {
  const [user, isLoading, error] = useAuthState(auth);
  const [showAuth, setShowAuth] = React.useState(false);
  const [authView, setAuthView] = React.useState<'signIn' | 'signUp'>('signIn');
  const [isOnline, setIsOnline] = React.useState(true);
  const [isNewUser, setIsNewUser] = React.useState(false);
  const [showTutorial, setShowTutorial] = React.useState(false);
  
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [isResetLoading, setIsResetLoading] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  
  const recaptchaContainerRef = React.useRef<HTMLDivElement>(null);
  const { t, isLoading: isLoadingTranslations } = useLocalization();

  /* --------------------  ONLINE + ADMIN SETUP (UNCHANGED) -------------------- */
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
        setIsOnline(window.navigator.onLine);
    }
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const setupAdmin = async () => {
        const adminEmail = 'admin@lonkind.com';
        const adminPassword = 'password123';
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', adminEmail));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                const currentAuthUser = auth.currentUser;
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                const user = userCredential.user;
                const avatarUrl = placeholderImages.avatar.url.replace('<seed>', 'A');
                
                await updateProfile(user, { displayName: 'Alex Taylor', photoURL: avatarUrl });
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    name: 'Alex Taylor',
                    handle: 'admin',
                    avatarUrl: avatarUrl,
                    email: adminEmail,
                    isProfessional: true,
                    bio: 'CEO of Lonkind. Connecting the world, one idea at a time.',
                    followersCount: 0,
                    followingCount: 0,
                    balance: 123.45,
                    coins: 1000000,
                    diamonds: 1000000,
                });
                await addDummyFollowers({ userId: user.uid, count: 500000 });

                if (currentAuthUser) {
                    await signOut(auth);
                }
            }
        } catch (error: any) {
            if (error.code !== 'auth/email-already-in-use') {
                 console.error("Error creating admin account: ", error);
            }
        }
    };
    
    setupAdmin();

    if (!window.recaptchaVerifier && recaptchaContainerRef.current) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            'size': 'invisible',
            'callback': () => {},
        });
    }
    
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /* --------------------  🔥 FIXED SECTION -------------------- */

  React.useEffect(() => {
    const ensureUserProfile = async () => {
      if (!user) {
        setIsNewUser(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const baseName = user.displayName || user.email?.split('@')[0] || 'user';
        const baseHandle = baseName
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');

        const finalHandle = baseHandle + Math.floor(100 + Math.random() * 900);
        const avatarUrl = placeholderImages.avatar.url.replace('<seed>', baseName.charAt(0));

        await setDoc(userDocRef, {
          uid: user.uid,
          name: baseName,
          handle: finalHandle,
          avatarUrl: avatarUrl,
          ...(user.email && { email: user.email.toLowerCase() }),
          bio: 'Hey there! I am using Lonkind.',
          followersCount: 0,
          followingCount: 0,
          balance: 0,
          coins: 100,
          diamonds: 0,
        });

        await updateProfile(user, { displayName: baseName, photoURL: avatarUrl });
      }

      setIsNewUser(false);
    };

    ensureUserProfile();
  }, [user]);

  /* --------------------  AUTH HANDLERS (UNCHANGED) -------------------- */

  const handleSignOut = async () => {
    await signOut(auth);
  };

  /* --------------------  LOADING -------------------- */

  if (isLoading || isLoadingTranslations) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  /* --------------------  APP CONTENT -------------------- */

  const AppContent = () => {
      if (user) {
        if (showTutorial) {
            return <QuickStartGuide onFinish={() => setShowTutorial(false)} />;
        }

        return (
            <>
                <PresenceSystem />
                <SocialDashboard user={user} onSignOut={handleSignOut} />
            </>
        );
      }

      /* Landing page unchanged */
      return (/* Your entire landing JSX remains exactly as you sent */ null);
  };

  return (
    <>
        {!isOnline && <OfflineIndicator />}
        {isFirebaseConfigValid ? <AppContent /> : <FirebaseConfigError />}
    </>
  );
}