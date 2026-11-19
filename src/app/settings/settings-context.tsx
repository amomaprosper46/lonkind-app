'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  runTransaction,
  increment,
  serverTimestamp,
  collectionGroup,
  writeBatch,
  getDoc,
  addDoc,
} from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail, deleteUser, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { compressImage } from '@/lib/image-compression';
import { toast } from '@/hooks/use-toast';
import type { CurrentUser, BlockedUser } from '@/components/social/social-dashboard';
import type { ProfileData } from '@/components/social/edit-profile-dialog';
import type { Post, ReactionType } from '@/components/social/post-card';

interface SettingsContextValue {
  currentUser: CurrentUser | null;
  authLoading: boolean;
  isSignedIn: boolean;
  blockedUsers: BlockedUser[];
  savedPostIds: Set<string>;
  userReactions: Map<string, ReactionType>;
  pendingRequestsCount: number;
  onUpdateProfile: (data: ProfileData) => Promise<boolean>;
  onPasswordReset: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onUnblockUser: (uid: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onToggleSavePost: (postId: string) => Promise<void>;
  onReactPost: (postId: string, reaction: ReactionType, authorUid: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onSubmitComment: (postId: string, text: string) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authUser, authLoading] = useAuthState(auth as any);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(new Map());
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (!authUser?.uid) {
      setCurrentUser(null);
      setBlockedUsers([]);
      setSavedPostIds(new Set());
      setPendingRequestsCount(0);
      return;
    }

    const uid = authUser.uid;

    const unsubUser = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        setCurrentUser({ uid, ...(snap.data() as Omit<CurrentUser, 'uid'>) } as CurrentUser);
      } else {
        setCurrentUser({
          uid,
          name: authUser.displayName || 'Lonkind User',
          handle: authUser.email?.split('@')[0]?.toLowerCase() || 'user',
          email: authUser.email || '',
          avatarUrl: authUser.photoURL || '',
          coins: 0,
          diamonds: 0,
          balance: 0,
        });
      }
    });

    const unsubBlocked = onSnapshot(collection(db, 'users', uid, 'blockedUsers'), (snap) => {
      setBlockedUsers(
        snap.docs.map((d) => ({
          uid: d.id,
          name: d.data().name || 'User',
          handle: d.data().handle || 'user',
        }))
      );
    });

    const unsubSaved = onSnapshot(collection(db, 'users', uid, 'savedPosts'), (snap) => {
      setSavedPostIds(new Set(snap.docs.map((d) => d.id)));
    });

    const unsubPending = onSnapshot(collection(db, 'users', uid, 'friendRequests'), (snap) => {
      setPendingRequestsCount(snap.size);
    });

    const reactionsQ = query(collectionGroup(db, 'reactions'), where('user.uid', '==', uid));
    const unsubReactions = onSnapshot(
      reactionsQ,
      (snap) => {
        const map = new Map<string, ReactionType>();
        snap.forEach((d) => {
          const postId = d.ref.parent.parent?.id;
          if (postId) map.set(postId, d.data().type);
        });
        setUserReactions(map);
      },
      () => {}
    );

    return () => {
      unsubUser();
      unsubBlocked();
      unsubSaved();
      unsubPending();
      unsubReactions();
    };
  }, [authUser]);

  const onUpdateProfile = useCallback(
    async (data: ProfileData): Promise<boolean> => {
      if (!auth?.currentUser || !currentUser) return false;
      try {
        const updates: Record<string, any> = {};
        if (data.handle && data.handle.toLowerCase() !== currentUser.handle?.toLowerCase()) {
          const cleanHandle = data.handle.toLowerCase();
          const q = query(collection(db, 'users'), where('handle', '==', cleanHandle));
          const snap = await getDocs(q);
          if (!snap.empty) {
            toast({
              variant: 'destructive',
              title: 'Handle already taken',
              description: 'Please choose a different username handle.',
            });
            return false;
          }
          updates.handle = cleanHandle;
        }
        if (data.name && data.name !== currentUser.name) updates.name = data.name;
        if (data.bio !== undefined && data.bio !== currentUser.bio) updates.bio = data.bio;
        if (data.businessUrl !== undefined && data.businessUrl !== currentUser.businessUrl) {
          updates.businessUrl = data.businessUrl;
        }
        if (data.followerPrivacy !== undefined) updates.followerPrivacy = data.followerPrivacy;
        if (data.lastSeenVisible !== undefined) updates.lastSeenVisible = data.lastSeenVisible;
        if (data.ghostMode !== undefined) updates.ghostMode = data.ghostMode;

        if (data.avatarFile) {
          const compressed = await compressImage(data.avatarFile);
          const sRef = ref(storage, `avatars/${auth.currentUser.uid}/${Date.now()}_${compressed.name}`);
          const snap = await uploadBytes(sRef, compressed);
          updates.avatarUrl = await getDownloadURL(snap.ref);
        }
        if (data.coverFile) {
          const compressed = await compressImage(data.coverFile);
          const sRef = ref(storage, `covers/${auth.currentUser.uid}/${Date.now()}_${compressed.name}`);
          const snap = await uploadBytes(sRef, compressed);
          updates.coverUrl = await getDownloadURL(snap.ref);
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
        }
        if (updates.name || updates.avatarUrl) {
          await updateProfile(auth.currentUser, {
            displayName: updates.name || currentUser.name,
            photoURL: updates.avatarUrl || currentUser.avatarUrl,
          }).catch(() => {});
        }
        if (updates.avatarUrl || updates.name || updates.handle) {
          auth.currentUser
            .getIdToken()
            .then((token) =>
              fetch('/api/profile/sync-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  avatarUrl: updates.avatarUrl || currentUser.avatarUrl,
                  name: updates.name || currentUser.name,
                  handle: updates.handle || currentUser.handle,
                }),
              })
            )
            .catch(() => {});
        }

        toast({ title: 'Profile Updated', description: 'Your changes have been saved everywhere.' });
        return true;
      } catch (err) {
        console.error('[SettingsProvider] Profile update error:', err);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update profile.' });
        return false;
      }
    },
    [currentUser]
  );

  const onPasswordReset = useCallback(async () => {
    if (!currentUser?.email) {
      toast({ variant: 'destructive', title: 'No Email Found', description: 'No email is linked to this account.' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      toast({ title: 'Password Reset Email Sent', description: `Check ${currentUser.email} for your reset link.` });
    } catch {
      toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send reset email.' });
    }
  }, [currentUser?.email]);

  const onDeleteAccount = useCallback(async () => {
    const userInstance = auth?.currentUser;
    if (!userInstance) return;
    try {
      await deleteDoc(doc(db, 'users', userInstance.uid));
      await deleteUser(userInstance);
      toast({ title: 'Account Deleted', description: 'Your account has been permanently removed.' });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: `Please sign in again before deleting your account. (${error?.code || 'auth'})`,
      });
    }
  }, [router]);

  const onUnblockUser = useCallback(
    async (uid: string) => {
      if (!currentUser?.uid) return;
      await deleteDoc(doc(db, 'users', currentUser.uid, 'blockedUsers', uid));
    },
    [currentUser?.uid]
  );

  const onSignOut = useCallback(async () => {
    await signOut(auth);
    router.push('/');
  }, [router]);

  const onToggleSavePost = useCallback(
    async (postId: string) => {
      if (!currentUser?.uid) return;
      const savedRef = doc(db, 'users', currentUser.uid, 'savedPosts', postId);
      if (savedPostIds.has(postId)) {
        await deleteDoc(savedRef);
        toast({ title: 'Removed from Saved Posts' });
      } else {
        await setDoc(savedRef, { timestamp: serverTimestamp() });
        toast({ title: 'Post Saved' });
      }
    },
    [currentUser?.uid, savedPostIds]
  );

  const onReactPost = useCallback(
    async (postId: string, reaction: ReactionType, authorUid: string) => {
      if (!currentUser?.uid) return;
      if (authorUid === currentUser.uid) {
        toast({ title: "Can't react to your own post" });
        return;
      }
      const postRef = doc(db, 'posts', postId);
      const reactionRef = doc(collection(postRef, 'reactions'), currentUser.uid);
      try {
        await runTransaction(db, async (tx) => {
          const rDoc = await tx.get(reactionRef);
          const pDoc = await tx.get(postRef);
          if (!pDoc.exists()) return;
          const pData = pDoc.data() as Post;
          const existing = rDoc.exists() ? (rDoc.data().type as ReactionType) : null;
          if (existing === reaction) {
            tx.delete(reactionRef);
            if (pData.reactions?.[reaction]) {
              tx.update(postRef, { [`reactions.${reaction}`]: increment(-1) });
            }
          } else {
            if (existing && pData.reactions?.[existing]) {
              tx.update(postRef, { [`reactions.${existing}`]: increment(-1) });
            }
            tx.set(reactionRef, {
              type: reaction,
              user: {
                uid: currentUser.uid,
                name: currentUser.name,
                handle: currentUser.handle,
                avatarUrl: currentUser.avatarUrl,
              },
              timestamp: serverTimestamp(),
            });
            tx.update(postRef, { [`reactions.${reaction}`]: increment(1) });
          }
        });
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not apply reaction.' });
      }
    },
    [currentUser]
  );

  const onDeletePost = useCallback(
    async (postId: string) => {
      if (!currentUser?.uid) return;
      const postRef = doc(db, 'posts', postId);
      const snap = await getDoc(postRef);
      if (!snap.exists() || snap.data().author?.uid !== currentUser.uid) return;
      const batch = writeBatch(db);
      batch.delete(postRef);
      await batch.commit();
      toast({ title: 'Post Deleted' });
    },
    [currentUser?.uid]
  );

  const onSubmitComment = useCallback(
    async (postId: string, text: string) => {
      if (!currentUser?.uid || !text.trim()) return false;
      try {
        await addDoc(collection(db, 'posts', postId, 'comments'), {
          text: text.trim(),
          author: {
            uid: currentUser.uid,
            name: currentUser.name,
            handle: currentUser.handle,
            avatarUrl: currentUser.avatarUrl,
          },
          timestamp: serverTimestamp(),
        });
        await updateDoc(doc(db, 'posts', postId), { comments: increment(1) });
        return true;
      } catch {
        return false;
      }
    },
    [currentUser]
  );

  return (
    <SettingsContext.Provider
      value={{
        currentUser,
        authLoading,
        isSignedIn: Boolean(authUser),
        blockedUsers,
        savedPostIds,
        userReactions,
        pendingRequestsCount,
        onUpdateProfile,
        onPasswordReset,
        onDeleteAccount,
        onUnblockUser,
        onSignOut,
        onToggleSavePost,
        onReactPost,
        onDeletePost,
        onSubmitComment,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used inside SettingsProvider');
  return ctx;
}
