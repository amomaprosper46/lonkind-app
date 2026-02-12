'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, increment, serverTimestamp, addDoc, onSnapshot, runTransaction, writeBatch, deleteDoc, setDoc, collectionGroup } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import Link from 'next/link';
import Image from 'next/image';
import ProfileView from '@/components/social/profile-view';
import type { Post, ReactionType } from '@/components/social/post-card';
import { Loader2 } from 'lucide-react';
import SocialHomePage from '@/components/social/social-home-page';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import CommentSheet from '@/components/social/comment-sheet';
import CallView from '@/components/social/call-view';
import type { ProfileData } from '@/components/social/edit-profile-dialog';
import { createOrGetConversation } from '@/ai/flows/create-or-get-conversation';
import type { CurrentUser } from '@/components/social/social-dashboard';
import placeholderImages from '@/lib/placeholder-images.json';
import { useAuthState } from 'react-firebase-hooks/auth';

interface UserProfile {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
  isProfessional?: boolean;
  followersCount?: number;
  followingCount?: number;
  bio?: string;
  businessUrl?: string;
}

export type FollowStatus = 'not_following' | 'following';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const [loggedInUser, loadingAuth] = useAuthState(auth);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(new Map());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [followStatus, setFollowStatus] = useState<FollowStatus>('not_following');
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [callState, setCallState] = useState<{ active: boolean, type: 'audio' | 'video' }>({ active: false, type: 'video' });

  useEffect(() => {
    if (!loggedInUser) return;
    const userDocRef = doc(db, 'users', loggedInUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUser(docSnap.data() as CurrentUser);
      }
    });
    return () => unsubscribe();
  }, [loggedInUser]);

  useEffect(() => {
    if (!handle) return;
    let profileUnsubscribe: (() => void) | null = null;
    let postsUnsubscribe: (() => void) | null = null;
    const setupListeners = async () => {
      setIsLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('handle', '==', handle.toLowerCase()));
        profileUnsubscribe = onSnapshot(userQuery, (userSnapshot) => {
          if (userSnapshot.empty) {
            console.log('🔍 User not found in DB for handle:', handle);
            setProfileUser(null);
            setIsLoading(false);
            return;
          }
          const userDoc = userSnapshot.docs[0];
          const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
          setProfileUser(userData);

          // Kill previous posts listener if profile changes
          if (postsUnsubscribe) postsUnsubscribe();
          const postsCollection = collection(db, "posts");
          const q = query(postsCollection, where("author.handle", "==", handle.toLowerCase()), orderBy("timestamp", "desc"));
          postsUnsubscribe = onSnapshot(q, (postSnapshot) => {
            const postList = postSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setPosts(postList);
            setIsLoading(false);
          }, (error) => {
            console.error("Error fetching posts in real-time:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load posts.' });
            setIsLoading(false);
          });
        }, (error) => {
          console.error("Error fetching profile in real-time:", error);
          setIsLoading(false);
        });
      } catch (error) {
        console.error("Error setting up profile fetch: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load profile data.' });
        setIsLoading(false);
      }
    };
    setupListeners();
    return () => {
      if (profileUnsubscribe) profileUnsubscribe();
      if (postsUnsubscribe) postsUnsubscribe();
    };
  }, [handle]);

  // ... rest of your code remains the same

  if (loadingAuth || isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!loggedInUser) {
    return <SocialHomePage />;
  }

  if (!profileUser && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold">User Not Found</h1>
          <p className="text-muted-foreground mt-4">Sorry, we couldn't find a profile for @{handle}.</p>
          <Link href="/" passHref>
            <Button className="mt-6">Go Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    // ... your return JSX
  );
}
