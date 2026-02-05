
'use client';
import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignUpForm } from '@/components/social/sign-up-form';
import { SignInForm } from '@/components/social/sign-in-form';
import { Users, Video, Share2, Loader2, WifiOff } from 'lucide-react';
import SocialDashboard from './social-dashboard';
import { auth, db } from '@/lib/firebase';
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


declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const OfflineIndicator = () => (
    <div className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <div className="text-center p-8 rounded-lg bg-card border shadow-xl">
            <WifiOff className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold">You are offline</h2>
            <p className="text-muted-foreground mt-2">
                An internet connection is required to use Lonkind.
            </p>
        </div>
    </div>
);

const WelcomeDialog = ({ user, onProfileCreated }: { user: User, onProfileCreated: () => void }) => {
    const [name, setName] = React.useState(user.displayName || '');
    const [handle, setHandle] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSaveProfile = async () => {
        if (!name.trim() || !handle.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out both name and handle.' });
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,15}$/.test(handle)) {
            toast({ variant: 'destructive', title: 'Invalid Handle', description: 'Handle must be 3-15 characters and can only contain letters, numbers, and underscores.' });
            return;
        }
        
        setIsSaving(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('handle', '==', handle.toLowerCase()));
            const handleDoc = await getDocs(q);
            if (!handleDoc.empty) {
                toast({ variant: 'destructive', title: 'Handle taken', description: 'This handle is already in use. Please choose another.' });
                setIsSaving(false);
                return;
            }

            const avatarUrl = `https://placehold.co/100x100.png?text=${name.charAt(0)}`;
            const isProfessionalAccount = user.email?.toLowerCase() === 'admin@lonkind.com';

            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                name: name,
                handle: handle.toLowerCase(),
                avatarUrl: avatarUrl,
                ...(user.email && { email: user.email.toLowerCase() }),
                ...(user.phoneNumber && { phoneNumber: user.phoneNumber }),
                isProfessional: isProfessionalAccount,
                bio: isProfessionalAccount ? 'CEO of Lonkind. Connecting the world, one idea at a time.' : 'Hey there! I am using Lonkind.',
                followersCount: 0,
                followingCount: 0,
                balance: isProfessionalAccount ? 123.45 : 0,
            });

            await updateProfile(user, { displayName: name, photoURL: avatarUrl });

            if (isProfessionalAccount) {
              await addDummyFollowers({ userId: user.uid, count: 500000 });
              await setDoc(doc(db, 'users', user.uid), { followingCount: 1, followersCount: 500000 }, { merge: true });
            }

            toast({ title: 'Welcome to Lonkind!', description: 'Your profile has been created.' });
            onProfileCreated();

        } catch (error) {
            console.error("Error creating profile:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create your profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={true}>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Welcome to Lonkind!</DialogTitle>
                    <DialogDescription>Let's set up your profile. Choose a name and a unique handle.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="name">Display Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
                    </div>
                    <div>
                        <Label htmlFor="handle">Handle</Label>
                        <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="your_unique_handle" />
                         <p className="text-xs text-muted-foreground mt-1">This is how people will find you. Cannot be changed later.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save and Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function SocialHomePage() {
  const [showAuth, setShowAuth] = React.useState(false);
  const [authView, setAuthView] = React.useState<'signIn' | 'signUp'>('signIn');
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isOnline, setIsOnline] = React.useState(true);
  const [isNewUser, setIsNewUser] = React.useState(false);
  
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [isResetLoading, setIsResetLoading] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  
  const recaptchaContainerRef = React.useRef<HTMLDivElement>(null);
  const { t, isLoading: isLoadingTranslations } = useLocalization();


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
                console.log("Admin account not found, creating...");
                const currentAuthUser = auth.currentUser;
                
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                const user = userCredential.user;
                const avatarUrl = `https://placehold.co/100x100.png?text=A`;
                
                await updateProfile(user, { displayName: 'Alex Taylor', photoURL: avatarUrl });
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    name: 'Alex Taylor',
                    handle: 'admin',
                    avatarUrl: avatarUrl,
                    email: adminEmail,
                    isProfessional: true,
                    bio: 'CEO of Lonkind. Connecting the world, one idea at a time.',
                    followersCount: 500000,
                    followingCount: 1,
                    balance: 123.45,
                });
                await addDummyFollowers({ userId: user.uid, count: 500000 });
                console.log("Admin account for Alex Taylor created successfully.");

                await signOut(auth); 
                // We will just log out completely. The user can sign back in.
            }
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                 console.log("Admin auth user already exists.");
            } else {
                 console.error("Error creating admin account: ", error);
            }
        }
    };
    
    setupAdmin();


    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
              setIsNewUser(true);
          } else {
              setIsNewUser(false);
          }
      } else {
          setIsNewUser(false);
      }
      setCurrentUser(user);
      setIsLoading(false);
    });

    if (!window.recaptchaVerifier && recaptchaContainerRef.current) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            'size': 'invisible',
            'callback': (response: any) => {},
        });
    }
    
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        unsubscribe();
    };
  }, []);

  const handleAuthSuccess = () => {
    setShowAuth(false);
    setAuthView('signIn');
  };
  
  const handleSignOut = async () => {
    await signOut(auth);
  };
  
    const handleSendResetEmail = async () => {
      if(!resetEmail) {
          toast({ variant: 'destructive', title: 'Email required', description: 'Please enter your email address.'});
          return;
      }
      setIsResetLoading(true);
      try {
          await sendPasswordResetEmail(auth, resetEmail); 
          toast({
              title: 'Password Reset Email Sent',
              description: 'Please check your inbox for a link to reset your password.'
          });
          setIsResetDialogOpen(false);
      } catch (error: any) {
          console.error(error);
          toast({
              variant: 'destructive',
              title: 'Failed to Send',
              description: 'Could not send reset email. Please check if the email is correct and try again.'
          });
      } finally {
          setIsResetLoading(false);
      }
  };

  const resetDialogOnOpenChange = (open: boolean) => {
    if (!open) {
        setResetEmail('');
    }
    setIsResetDialogOpen(open);
  }

  const openAuthCard = () => {
    setAuthView('signIn');
    setShowAuth(true);
  }

  if (isLoading || isLoadingTranslations) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }
  
  const AppContent = () => {
      if (currentUser) {
        if (isNewUser) {
            return <WelcomeDialog user={currentUser} onProfileCreated={() => setIsNewUser(false)} />;
        }
        return (
            <>
                <PresenceSystem />
                <SocialDashboard user={currentUser} onSignOut={handleSignOut} />
            </>
        );
      }
      
      return (
         <>
          <div ref={recaptchaContainerRef}></div>
          <div className="flex flex-col min-h-screen">
              <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                  <div className="container flex items-center justify-between h-16">
                  <Link href="/" className="flex items-center gap-2">
                      <Image src="/logo.png" alt={`${t('app_name')} Logo`} width={32} height={32} />
                      <span className="text-xl font-bold">{t('app_name')}</span>
                  </Link>
                  <Button onClick={openAuthCard}>{t('sign_in_link')}</Button>
                  </div>
              </header>
          
              <main className="flex-1">
                  <section className="container grid items-center gap-8 py-12 md:grid-cols-2 lg:py-24">
                  <div className="space-y-4">
                      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                          {t('headline')}
                      </h1>
                      <p className="text-lg text-muted-foreground">
                          {t('tagline')}
                      </p>
                      <Button size="lg" onClick={openAuthCard}>
                          {t('launch_button')}
                      </Button>
                  </div>
                  <div className="flex items-center justify-center">
                      {showAuth ? (
                      <Card className="w-full max-w-md shadow-2xl">
                          {authView === 'signIn' ? (
                              <>
                                  <CardHeader>
                                      <CardTitle className="text-2xl">{t('sign_in_header')}</CardTitle>
                                      <CardDescription>{t('sign_in_desc')}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                      <SignInForm 
                                        onSignIn={handleAuthSuccess} 
                                        onForgotPassword={() => setIsResetDialogOpen(true)} 
                                        onShowSignUp={() => setAuthView('signUp')}
                                      />
                                  </CardContent>
                              </>
                          ) : (
                              <>
                                  <CardHeader>
                                      <CardTitle className="text-2xl">{t('sign_up_header')}</CardTitle>
                                      <CardDescription>{t('sign_up_desc')}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                      <SignUpForm 
                                        onSignUp={() => setAuthView('signIn')} 
                                        onShowSignIn={() => setAuthView('signIn')} 
                                      />
                                  </CardContent>
                              </>
                          )}
                      </Card>
                      ) : (
                          <div className="p-8 rounded-lg bg-card border shadow-xl">
                              <Image src="https://picsum.photos/seed/social/600/400" alt="Social connections illustration" width={600} height={400} className="rounded-lg" data-ai-hint="social connections" />
                          </div>
                      )}
                  </div>
                  </section>
          
                  <section className="py-12 bg-secondary lg:py-24">
                  <div className="container">
                      <div className="text-center">
                      <h2 className="text-3xl font-bold">Everything you need to stay connected</h2>
                      <p className="mt-2 text-muted-foreground">
                          Our platform is packed with features to help you build and maintain relationships.
                      </p>
                      </div>
                      <div className="grid gap-8 mt-12 md:grid-cols-3">
                      <Card className="text-center shadow-lg">
                          <CardHeader>
                          <Users className="w-12 h-12 mx-auto text-primary" />
                          </CardHeader>
                          <CardContent>
                          <h3 className="text-xl font-semibold">{t('feature_1_title')}</h3>
                          <p className="mt-2 text-muted-foreground">
                              {t('feature_1_desc')}
                          </p>
                          </CardContent>
                      </Card>
                      <Card className="text-center shadow-lg">
                          <CardHeader>
                          <Video className="w-12 h-12 mx-auto text-primary" />
                          </CardHeader>
                          <CardContent>
                          <h3 className="text-xl font-semibold">{t('feature_2_title')}</h3>
                          <p className="mt-2 text-muted-foreground">
                              {t('feature_2_desc')}
                          </p>
                          </CardContent>
                      </Card>
                      <Card className="text-center shadow-lg">
                          <CardHeader>
                            <Share2 className="w-12 h-12 mx-auto text-primary" />
                          </CardHeader>
                          <CardContent>
                          <h3 className="text-xl font-semibold">{t('feature_3_title')}</h3>
                          <p className="mt-2 text-muted-foreground">
                              {t('feature_3_desc')}
                          </p>
                          </CardContent>
                      </Card>
                      </div>
                  </div>
                  </section>
              </main>
          
              <footer className="py-6 border-t bg-background">
                  <div className="container flex flex-wrap justify-center items-center text-muted-foreground gap-x-4 gap-y-2">
                    <p>{t('footer_copyright')}</p>
                    <Link href="/rules" className="hover:text-primary hover:underline">{t('footer_rules')}</Link>
                    <Link href="/terms" className="hover:text-primary hover:underline">Terms of Service</Link>
                  </div>
              </footer>
          </div>

          <Dialog open={isResetDialogOpen} onOpenChange={resetDialogOnOpenChange}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Reset Your Password</DialogTitle>
                      <DialogDescription>
                          Enter your email address below. We'll send a link to your inbox to reset your password.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="reset-email" className="text-right">
                              Email
                          </Label>
                          <Input 
                              id="reset-email" 
                              type="email"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="col-span-3" 
                          />
                      </div>
                  </div>
                  <DialogFooter>
                      <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button onClick={handleSendResetEmail} disabled={isResetLoading}>
                          {isResetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Send Reset Link
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
        </>
      );
  }

  return (
    <>
        {!isOnline && <OfflineIndicator />}
        <AppContent />
    </>
  );
}
