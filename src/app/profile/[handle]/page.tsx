'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, increment, serverTimestamp, addDoc, onSnapshot, runTransaction, writeBatch, deleteDoc, setDoc, collectionGroup } from 'firebase/firestore';
import { db, auth, storage, isFirebaseConfigValid } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '@/lib/image-compression';
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
import type { CurrentUser } from '@/components/social/social-dashboard';
import { useAuthState } from 'react-firebase-hooks/auth';


interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    isProfessional?: boolean;
    friendsCount?: number;
    bio?: string;
    businessUrl?: string;
    followerPrivacy?: 'public' | 'private';
}

export type FriendStatus = 'not_friends' | 'pending_sent' | 'pending_received' | 'friends';

function UserProfilePageInner() {
    const params = useParams();
    const router = useRouter();
    const handle = params?.handle as string | undefined;
    const [loggedInUser, loadingAuth] = useAuthState(auth as any);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(new Map());
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    
    const [friendStatus, setFriendStatus] = useState<FriendStatus>('not_friends');

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
    
    // This effect now sets up real-time listeners for user-specific data
    useEffect(() => {
        if (!loggedInUser || !profileUser) return;
    
        // Real-time friend status
        const friendRef = doc(db, 'users', loggedInUser.uid, 'friends', profileUser.uid);
        const requestSentRef = doc(db, 'users', profileUser.uid, 'friendRequests', loggedInUser.uid);
        const requestReceivedRef = doc(db, 'users', loggedInUser.uid, 'friendRequests', profileUser.uid);

        let unsubSent: (() => void) | null = null;
        let unsubReceived: (() => void) | null = null;

        const unsubFriend = onSnapshot(friendRef, (snap) => {
            if (snap.exists()) {
                setFriendStatus('friends');
                if (unsubSent) { unsubSent(); unsubSent = null; }
                if (unsubReceived) { unsubReceived(); unsubReceived = null; }
            } else {
                // Not friends, check if we sent a request
                unsubSent = onSnapshot(requestSentRef, (sentSnap) => {
                    if (sentSnap.exists()) {
                        setFriendStatus('pending_sent');
                        if (unsubReceived) { unsubReceived(); unsubReceived = null; }
                    } else {
                        // Not sent, check if we received a request
                        unsubReceived = onSnapshot(requestReceivedRef, (receivedSnap) => {
                            if (receivedSnap.exists()) setFriendStatus('pending_received');
                            else setFriendStatus('not_friends');
                        });
                    }
                });
            }
        });
    
        // Real-time saved posts
        const savedPostsRef = collection(db, 'users', loggedInUser.uid, 'savedPosts');
        const unsubSaved = onSnapshot(savedPostsRef, (snapshot) => {
            const postIds = new Set(snapshot.docs.map(doc => doc.id));
            setSavedPostIds(postIds);
        });
    
        // Real-time reactions for all posts on the page
        const reactionsQuery = query(collectionGroup(db, 'reactions'), where('user.uid', '==', loggedInUser.uid));
        const unsubReactions = onSnapshot(reactionsQuery, (reactionSnapshots) => {
            const newReactions = new Map<string, ReactionType>();
            reactionSnapshots.forEach(doc => {
                const parentPostId = doc.ref.parent.parent?.id;
                if (parentPostId && posts.some(p => p.id === parentPostId)) {
                    newReactions.set(parentPostId, doc.data().type);
                }
            });
             setUserReactions(newReactions);
        });

    
        return () => {
            unsubFriend();
            if (unsubSent) unsubSent();
            if (unsubReceived) unsubReceived();
            unsubSaved();
            unsubReactions();
        };
    
    }, [loggedInUser, profileUser, posts]);


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

                if (!postDoc.exists()) throw "Post does not exist!";
                
                const postData = postDoc.data() as Post;
                const newReactionsMap = new Map(userReactions);
                const existingReaction = reactionDoc.exists() ? reactionDoc.data().type : null;

                if (existingReaction === reaction) { // Un-reacting
                    transaction.delete(reactionRef);
                    if (postData.reactions?.[reaction]) {
                        transaction.update(postRef, { [`reactions.${reaction}`]: increment(-1) });
                    }
                    newReactionsMap.delete(postId);
                } else { // Reacting or changing reaction
                    if (existingReaction) { // Changing reaction
                         if (postData.reactions?.[existingReaction as ReactionType]) {
                            transaction.update(postRef, { [`reactions.${existingReaction}`]: increment(-1) });
                        }
                    }
                    transaction.set(reactionRef, {
                        type: reaction,
                        user: { name: currentUser.name, avatarUrl: currentUser.avatarUrl, handle: currentUser.handle, uid: currentUser.uid },
                        timestamp: serverTimestamp()
                    });
                    transaction.update(postRef, { [`reactions.${reaction}`]: increment(1) });
                    newReactionsMap.set(postId, reaction);
                }
                // This state update is now optimistic and will be confirmed by the onSnapshot listener
                setUserReactions(newReactionsMap);
            });
        } catch (e) {
            console.error("Error updating reaction: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not apply reaction.' });
        }
    };
  
    const handleComment = async (postId: string, commentText: string) => {
       if (!loggedInUser || !currentUser) return false;
        const postRef = doc(db, 'posts', postId);
        const commentsRef = collection(db, 'posts', postId, 'comments');
        
        try {
            await addDoc(commentsRef, {
                text: commentText,
                author: {
                    uid: currentUser.uid,
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                },
                timestamp: serverTimestamp(),
            });
            await updateDoc(postRef, { comments: increment(1) });
            return true;
        } catch(e) {
            console.error("Error adding comment: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add comment.' });
            return false;
        }
    };
    
    const handleSavePost = async (postId: string) => {
        if (!loggedInUser) return;
        const savedPostRef = doc(db, 'users', loggedInUser.uid, 'savedPosts', postId);
        
        try {
            if (savedPostIds.has(postId)) {
                await deleteDoc(savedPostRef);
                toast({ title: 'Post unsaved' });
            } else {
                await setDoc(savedPostRef, { timestamp: serverTimestamp() });
                toast({ title: 'Post saved!' });
            }
        } catch (error) {
            console.error('Error saving post:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update saved post.' });
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!currentUser) return;
        
        const postRef = doc(db, 'posts', postId);

        try {
            // Must be author to delete
            const postSnap = await getDoc(postRef);
            if (!postSnap.exists() || postSnap.data().author.uid !== currentUser.uid) {
                toast({ variant: 'destructive', title: 'Error', description: 'You can only delete your own posts.' });
                return;
            }

            const batch = writeBatch(db);

            const commentsRef = collection(db, 'posts', postId, 'comments');
            const commentsQuery = query(commentsRef);
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.forEach((doc) => batch.delete(doc.ref));

            const reactionsRef = collection(db, 'posts', postId, 'reactions');
            const reactionsQuery = query(reactionsRef);
            const reactionsSnapshot = await getDocs(reactionsQuery);
            reactionsSnapshot.forEach((doc) => batch.delete(doc.ref));

            batch.delete(postRef);

            await batch.commit();

            toast({ title: 'Post Deleted', description: 'Your post has been successfully removed.' });

        } catch (error) {
            console.error('Error deleting post:', error);
            toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the post.' });
        }
    };

    const handleFriendAction = async (action: 'add' | 'cancel' | 'accept' | 'unfriend', targetUser: UserProfile) => {
        if (!loggedInUser || !currentUser) return;

        const currentUserRef = doc(db, 'users', loggedInUser.uid);
        const targetUserRef = doc(db, 'users', targetUser.uid);
    
        const friend1Ref = doc(db, 'users', loggedInUser.uid, 'friends', targetUser.uid);
        const friend2Ref = doc(db, 'users', targetUser.uid, 'friends', loggedInUser.uid);

        const requestSentRef = doc(db, 'users', targetUser.uid, 'friendRequests', loggedInUser.uid);
        const requestReceivedRef = doc(db, 'users', loggedInUser.uid, 'friendRequests', targetUser.uid);
    
        const batch = writeBatch(db);
    
        try {
            if (action === 'add') {
                batch.set(requestSentRef, {
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    timestamp: serverTimestamp(),
                });
                toast({ title: `Friend request sent to ${targetUser.name}` });
            } else if (action === 'cancel') {
                batch.delete(requestSentRef);
                toast({ title: `Friend request canceled` });
            } else if (action === 'accept') {
                batch.delete(requestReceivedRef);
                batch.set(friend1Ref, {
                    name: targetUser.name,
                    handle: targetUser.handle,
                    avatarUrl: targetUser.avatarUrl,
                    timestamp: serverTimestamp(),
                });
                batch.set(friend2Ref, {
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    timestamp: serverTimestamp(),
                });
                batch.update(currentUserRef, { friendsCount: increment(1) });
                batch.update(targetUserRef, { friendsCount: increment(1) });
                toast({ title: `You and ${targetUser.name} are now friends!` });
            } else if (action === 'unfriend') {
                batch.delete(friend1Ref);
                batch.delete(friend2Ref);
                batch.update(currentUserRef, { friendsCount: increment(-1) });
                batch.update(targetUserRef, { friendsCount: increment(-1) });
                toast({ title: `You have unfriended ${targetUser.name}` });
            }
    
            await batch.commit();

            // Attempt to send notification separately
            if (action === 'add') {
                try {
                    const notificationRef = doc(collection(db, 'users', targetUser.uid, 'notifications'));
                    await setDoc(notificationRef, {
                        type: 'friend_request',
                        fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: currentUser.uid },
                        timestamp: serverTimestamp(),
                        read: false,
                    });
                } catch (notifError) {
                    console.warn("Could not send friend notification:", notifError);
                }
            }
        } catch (error) {
            console.error("Error updating friend status: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
        }
    };
    
    const handleUpdateProfile = async (data: ProfileData): Promise<boolean> => {
        if (!currentUser) return false;
        
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const updateData: any = {
                name: data.name,
                handle: data.handle,
                bio: data.bio,
                businessUrl: data.businessUrl,
                followerPrivacy: data.followerPrivacy || 'public',
            };

            if (data.avatarFile) {
                const fileToUpload = await compressImage(data.avatarFile);
                const storageRef = ref(storage, `avatars/${currentUser.uid}/${Date.now()}_${fileToUpload.name}`);
                const snapshot = await uploadBytes(storageRef, fileToUpload);
                updateData.avatarUrl = await getDownloadURL(snapshot.ref);
            }

            await updateDoc(userDocRef, updateData);

            toast({ title: "Success", description: "Profile updated!" });

            if (data.handle && handle && data.handle.toLowerCase() !== handle.toLowerCase()) {
                router.push(`/profile/${data.handle.toLowerCase()}`);
            }
            return true;

        } catch (error) {
            console.error("Error updating profile:", error);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update your profile.' });
            return false;
        }
    };
    
    const handleStartCall = (type: 'audio' | 'video') => {
        setCallState({ active: true, type });
    };

    const handleEndCall = () => {
        setCallState({ active: false, type: 'video' });
    };

    const handleStartMessage = async () => {
        if (!currentUser || !profileUser) return;
        try {
            const conversationsRef = collection(db, 'conversations');
            const participantUids = [currentUser.uid, profileUser.uid].sort();

            const q = query(conversationsRef, where('participantUids', 'array-contains', currentUser.uid));
            const querySnapshot = await getDocs(q);

            let conversationId;
            const existingDoc = querySnapshot.docs.find(doc => {
                const uids = doc.data().participantUids || [];
                return uids.length === participantUids.length && uids.includes(profileUser.uid);
            });

            if (existingDoc) {
                conversationId = existingDoc.id;
            } else {
                const newDoc = await addDoc(conversationsRef, {
                    participantUids,
                    createdAt: serverTimestamp(),
                });
                conversationId = newDoc.id;
            }

            router.push(`/?view=messages&conversationId=${conversationId}`);

        } catch (e) {
            console.error("Error starting conversation: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start a conversation.' });
        }
    }

    if (loadingAuth || isLoading || !currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!loggedInUser) {
        return (
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
                <SocialHomePage />
            </Suspense>
        );
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
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <div className="min-h-screen bg-secondary">
             <header className="sticky top-0 z-40 w-full border-b bg-background">
                <div className="container flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/logo.png" alt="Lonkind Logo" width={32} height={32} />
                        <span className="text-xl font-bold">Lonkind</span>
                    </Link>
                </div>
            </header>
             <div className="container grid grid-cols-12 gap-8 py-8">
                <main className="col-span-12">
                    <ProfileView 
                        user={profileUser} 
                        posts={posts} 
                        currentUser={currentUser}
                        isCurrentUser={loggedInUser.uid === profileUser.uid}
                        onReact={(postId, reaction) => {
                            const post = posts.find(p => p.id === postId);
                            if (post) handleReact(postId, reaction, post.author.uid);
                        }}
                        onComment={setSelectedPostForComments}
                        onSavePost={handleSavePost}
                        onDeletePost={handleDeletePost}
                        userReactions={userReactions}
                        savedPostIds={savedPostIds}
                        onFriendAction={handleFriendAction}
                        onMessage={handleStartMessage}
                        friendStatus={friendStatus}
                        onStartCall={handleStartCall}
                        onUpdateProfile={handleUpdateProfile}
                    />
                </main>
            </div>
            {currentUser && (
                <CommentSheet 
                    post={selectedPostForComments}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) {
                            setSelectedPostForComments(null);
                        }
                    }}
                    onCommentSubmit={handleComment}
                    currentUser={currentUser}
                />
            )}
            {callState.active && (
                <CallView 
                    callTargetUser={{
                        uid: profileUser.uid,
                        name: profileUser.name,
                        handle: profileUser.handle,
                        avatarUrl: profileUser.avatarUrl
                    }}
                    callType={callState.type}
                    onEndCall={handleEndCall}
                />
            )}
        </div>
        </Suspense>
    );
}

export default function UserProfilePage() {
    if (!isFirebaseConfigValid) {
        return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-muted-foreground">App requires Firebase configuration.</div></div>;
    }
    return <UserProfilePageInner />;
}
