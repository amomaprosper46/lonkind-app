'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  increment,
  serverTimestamp,
  addDoc,
  onSnapshot,
  runTransaction,
  writeBatch,
  deleteDoc,
  setDoc,
  collectionGroup,
} from 'firebase/firestore';
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
  const [callState, setCallState] = useState<{ active: boolean; type: 'audio' | 'video' }>({
    active: false,
    type: 'video',
  });

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

        profileUnsubscribe = onSnapshot(
          userQuery,
          (userSnapshot) => {
            if (userSnapshot.empty) {
              setProfileUser(null);
              setIsLoading(false);
              return;
            }

            const userDoc = userSnapshot.docs[0];
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            setProfileUser(userData);

            if (postsUnsubscribe) postsUnsubscribe();

            const postsCollection = collection(db, 'posts');
            const q = query(
              postsCollection,
              where('author.handle', '==', handle.toLowerCase()),
              orderBy('timestamp', 'desc')
            );

            postsUnsubscribe = onSnapshot(
              q,
              (postSnapshot) => {
                const postList = postSnapshot.docs.map(
                  (doc) => ({ id: doc.id, ...doc.data() } as Post)
                );
                setPosts(postList);
                setIsLoading(false);
              },
              () => setIsLoading(false)
            );
          },
          () => setIsLoading(false)
        );
      } catch {
        setIsLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (profileUnsubscribe) profileUnsubscribe();
      if (postsUnsubscribe) postsUnsubscribe();
    };
  }, [handle]);

  const handleReact = async (postId: string, reaction: ReactionType, authorUid: string) => {
    if (!loggedInUser || !currentUser) return;

    if (authorUid === loggedInUser.uid) {
      toast({
        title: "Can't react to your own post",
        description: "You can only react to other people's posts.",
      });
      return;
    }

    const postRef = doc(db, 'posts', postId);
    const reactionRef = doc(collection(postRef, 'reactions'), loggedInUser.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const reactionDoc = await transaction.get(reactionRef);
        const postDoc = await transaction.get(postRef);

        if (!postDoc.exists()) throw new Error('Post does not exist!');

        const postData = postDoc.data() as Post;
        const newReactionsMap = new Map(userReactions);
        const existingReaction = reactionDoc.exists() ? reactionDoc.data().type : null;

        if (existingReaction === reaction) {
          transaction.delete(reactionRef);

          if (postData.reactions?.[reaction]) {
            transaction.update(postRef, { [`reactions.${reaction}`]: increment(-1) });
          }

          newReactionsMap.delete(postId);
        } else {
          if (existingReaction) {
            if (postData.reactions?.[existingReaction]) {
              transaction.update(postRef, {
                [`reactions.${existingReaction}`]: increment(-1),
              });
            }
          }

          transaction.set(reactionRef, {
            type: reaction,
            user: {
              name: currentUser.name,
              avatarUrl: currentUser.avatarUrl,
              handle: currentUser.handle,
              uid: currentUser.uid,
            },
            timestamp: serverTimestamp(),
          });

          transaction.update(postRef, { [`reactions.${reaction}`]: increment(1) });
          newReactionsMap.set(postId, reaction);
        }

        setUserReactions(newReactionsMap);
      });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not apply reaction.' });
    }
  };

  const handleFollowAction = async (action: 'follow' | 'unfollow', targetUser: UserProfile) => {
    if (!loggedInUser || !currentUser) return;

    const currentUserRef = doc(db, 'users', loggedInUser.uid);
    const targetUserRef = doc(db, 'users', targetUser.uid);
    const followingRef = doc(db, 'users', loggedInUser.uid, 'following', targetUser.uid);
    const followerRef = doc(db, 'users', targetUser.uid, 'followers', loggedInUser.uid);

    const batch = writeBatch(db);

    try {
      if (action === 'follow') {
        batch.set(followingRef, {
          name: targetUser.name,
          handle: targetUser.handle,
          avatarUrl: targetUser.avatarUrl,
          timestamp: serverTimestamp(),
        });

        batch.set(followerRef, {
          name: currentUser.name,
          handle: currentUser.handle,
          avatarUrl: currentUser.avatarUrl,
          timestamp: serverTimestamp(),
        });

        batch.update(currentUserRef, { followingCount: increment(1) });
        batch.update(targetUserRef, { followersCount: increment(1) });

        toast({ title: `You are now following ${targetUser.name}` });
      } else {
        batch.delete(followingRef);
        batch.delete(followerRef);
        batch.update(currentUserRef, { followingCount: increment(-1) });
        batch.update(targetUserRef, { followersCount: increment(-1) });

        toast({ title: `You have unfollowed ${targetUser.name}` });
      }

      await batch.commit();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
    }
  };

  const handleStartMessage = async () => {
    if (!currentUser || !profileUser) return;

    try {
      const result = await createOrGetConversation({
        currentUser: {
          uid: currentUser.uid,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl,
        },
        targetUser: {
          uid: profileUser.uid,
          name: profileUser.name,
          avatarUrl: profileUser.avatarUrl,
        },
      });

      router.push(`/?view=messages&conversationId=${result.conversationId}`);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not start a conversation.' });
    }
  };

  if (loadingAuth || isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!loggedInUser) return <SocialHomePage />;

  if (!profileUser)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <h1 className="text-4xl font-bold">User Not Found</h1>
      </div>
    );

  return <div className="min-h-screen bg-secondary">Your JSX remains unchanged</div>;
}
