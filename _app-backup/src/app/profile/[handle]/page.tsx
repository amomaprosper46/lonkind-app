
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, increment, serverTimestamp, addDoc, onSnapshot, runTransaction, writeBatch, deleteDoc, setDoc, collectionGroup, Timestamp, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
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
import type { CurrentUser, BlockedUser, MutedUser } from '@/components/social/social-dashboard';
import { useAuthState } from 'react-firebase-hooks/auth';
import ProfileViewSkeleton from '@/components/social/profile-view-skeleton';

const POSTS_PER_PAGE = 5;

interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    isProfessional?: boolean;
    friendsCount?: number;
    bio?: string;
    businessUrl?: string;
    gender?: string;
    dateOfBirth?: Timestamp;
}

export type FriendshipStatus = 'not_friends' | 'request_sent' | 'request_received' | 'friends';

export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const handle = params.handle as string;
    const [loggedInUser, loadingAuth] = useAuthState(auth);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [lastPost, setLastPost] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(new Map());
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    
    const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('not_friends');

    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);

    const [callState, setCallState] = useState<{ active: boolean, type: 'audio' | 'video' }>({ active: false, type: 'video' });
    
    const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

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


     const fetchPosts = useCallback(async (isInitial = false) => {
        if (!handle) return;
        if (isInitial) {
            setIsLoadingPosts(true);
            setPosts([]);
            setLastPost(null);
            setHasMorePosts(true);
        } else {
            setIsLoadingMore(true);
        }
        
        try {
            const postsCollection = collection(db, "posts");
            let q = query(
                postsCollection, 
                where("author.handle", "==", handle.toLowerCase()), 
                orderBy("timestamp", "desc"), 
                limit(POSTS_PER_PAGE)
            );

            if (!isInitial && lastPost) {
                q = query(q, startAfter(lastPost));
            }

            const postSnapshot = await getDocs(q);
            const postList = postSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            
            setLastPost(postSnapshot.docs[postSnapshot.docs.length - 1] || null);
            setHasMorePosts(postSnapshot.docs.length === POSTS_PER_PAGE);

            setPosts(prev => isInitial ? postList : [...prev, ...postList]);
            
        } catch (error) {
            console.error("Error fetching posts:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load posts.' });
        } finally {
            setIsLoadingPosts(false);
            setIsLoadingMore(false);
        }
    }, [handle, lastPost]);

     useEffect(() => {
        if (!handle) return;
    
        let profileUnsubscribe: (() => void) | null = null;
    
        const setupListeners = async () => {
            setIsLoadingProfile(true);
            try {
                const usersRef = collection(db, 'users');
                const userQuery = query(usersRef, where('handle', '==', handle.toLowerCase()));
    
                profileUnsubscribe = onSnapshot(userQuery, (userSnapshot) => {
                    if (userSnapshot.empty) {
                        setProfileUser(null);
                        setIsLoadingProfile(false);
                        return;
                    }
    
                    const userDoc = userSnapshot.docs[0];
                    const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
                    setProfileUser(userData);
                    setIsLoadingProfile(false);
                }, (error) => {
                    console.error("Error fetching profile in real-time:", error);
                    setIsLoadingProfile(false);
                });
            } catch (error) {
                console.error("Error setting up profile fetch: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load profile data.' });
                setIsLoadingProfile(false);
            }
        };
    
        setupListeners();
        fetchPosts(true);
    
        return () => {
            if (profileUnsubscribe) profileUnsubscribe();
        };
    }, [handle, fetchPosts]);
    
    useEffect(() => {
        if (!loggedInUser || !profileUser || loggedInUser.uid === profileUser.uid) return;

        const myId = loggedInUser.uid;
        const theirId = profileUser.uid;
        
        let unsubs: (()=>void)[] = [];

        // Listener for friendship status
        const friendRef = doc(db, 'users', myId, 'friends', theirId);
        unsubs.push(onSnapshot(friendRef, (snap) => {
            if (snap.exists()) {
                setFriendshipStatus('friends');
            } else {
                // If not friends, check for pending requests
                const myRequestRef = doc(db, 'users', theirId, 'friendRequests', myId);
                unsubs.push(onSnapshot(myRequestRef, (myReqSnap) => {
                     if (myReqSnap.exists()) {
                         setFriendshipStatus('request_sent');
                     } else {
                        const theirRequestRef = doc(db, 'users', myId, 'friendRequests', theirId);
                        unsubs.push(onSnapshot(theirRequestRef, (theirReqSnap) => {
                            if (theirReqSnap.exists()) {
                                setFriendshipStatus('request_received');
                            } else {
                                setFriendshipStatus('not_friends');
                            }
                        }));
                     }
                }));
            }
        }));

        // Listener for saved posts
        const savedPostsRef = collection(db, 'users', myId, 'savedPosts');
        unsubs.push(onSnapshot(savedPostsRef, (snapshot) => {
            const postIds = new Set(snapshot.docs.map(doc => doc.id));
            setSavedPostIds(postIds);
        }));

        // Listener for reactions
        const reactionsQuery = query(collectionGroup(db, 'reactions'), where('user.uid', '==', myId));
        unsubs.push(onSnapshot(reactionsQuery, (reactionSnapshots) => {
            const newReactions = new Map<string, ReactionType>();
            reactionSnapshots.forEach(doc => {
                const parentPostId = doc.ref.parent.parent?.id;
                if (parentPostId) {
                    newReactions.set(parentPostId, doc.data().type);
                }
            });
            setUserReactions(newReactions);
        }));

         const mutedUsersRef = collection(db, 'users', myId, 'mutedUsers');
        unsubs.push(onSnapshot(mutedUsersRef, (snapshot) => {
            setMutedUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as MutedUser)));
        }));

        const blockedUsersRef = collection(db, 'users', myId, 'blockedUsers');
        unsubs.push(onSnapshot(blockedUsersRef, (snapshot) => {
            setBlockedUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as BlockedUser)));
        }));
        
        return () => {
            unsubs.forEach(unsub => unsub());
        };

    }, [loggedInUser, profileUser]);

    const handleReportPost = async (postToReport: Post) => {
        if (!currentUser) return;
        const report = {
            reporter: {
                uid: currentUser.uid,
                name: currentUser.name,
                handle: currentUser.handle,
            },
            reportedPost: {
                id: postToReport.id,
                authorUid: postToReport.author.uid,
                content: postToReport.content,
            },
            timestamp: serverTimestamp(),
            status: 'pending',
        };

        try {
            await addDoc(collection(db, 'reports'), report);
            toast({
                title: 'Post Reported',
                description: 'Thank you for your feedback. Our team will review this post.',
            });
        } catch (error) {
            console.error("Error reporting post:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit report.' });
        }
    };
    
    const handleMuteUser = async (userToMute: Post['author']) => {
        if (!currentUser) return;
        const muteRef = doc(db, 'users', currentUser.uid, 'mutedUsers', userToMute.uid);
        try {
            await setDoc(muteRef, {
                name: userToMute.name,
                handle: userToMute.handle,
                timestamp: serverTimestamp(),
            });
            toast({
                title: 'User Muted',
                description: `You will no longer see posts from @${userToMute.handle} in your feeds.`,
            });
        } catch (error) {
            console.error("Error muting user:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not mute user.' });
        }
    };

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
                         if (postData.reactions?.[existingReaction]) {
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
            
            setPosts(prev => prev.filter(p => p.id !== postId));

            toast({ title: 'Post Deleted', description: 'Your post has been successfully removed.' });

        } catch (error) {
            console.error('Error deleting post:', error);
            toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the post.' });
        }
    };
    
    const handleFriendAction = async (action: 'add' | 'cancel' | 'accept' | 'reject' | 'unfriend' | 'block' | 'unblock', targetUser: UserProfile) => {
        if (!loggedInUser || !currentUser) return;

        const myId = loggedInUser.uid;
        const theirId = targetUser.uid;

        const myFriendRef = doc(db, 'users', myId, 'friends', theirId);
        const theirFriendRef = doc(db, 'users', theirId, 'friends', myId);
        const myRequestRef = doc(db, 'users', theirId, 'friendRequests', myId);
        const theirRequestRef = doc(db, 'users', myId, 'friendRequests', theirId);
        const myUserDocRef = doc(db, 'users', myId);
        const theirUserDocRef = doc(db, 'users', theirId);
        const blockRef = doc(db, 'users', myId, 'blockedUsers', theirId);

        const batch = writeBatch(db);

        try {
            if (action === 'add') {
                batch.set(myRequestRef, {
                    from: { uid: myId, name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl },
                    timestamp: serverTimestamp(),
                    status: 'pending'
                });
                const notificationRef = doc(collection(db, 'users', theirId, 'notifications'));
                batch.set(notificationRef, {
                    type: 'friend_request',
                    fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: myId },
                    timestamp: serverTimestamp(),
                    read: false,
                });
                toast({ title: 'Friend request sent!' });
            } else if (action === 'cancel') {
                batch.delete(myRequestRef);
                toast({ title: 'Request cancelled.' });
            } else if (action === 'reject') {
                batch.delete(theirRequestRef);
                toast({ title: 'Request rejected.' });
            } else if (action === 'accept') {
                batch.set(myFriendRef, { name: targetUser.name, handle: targetUser.handle, avatarUrl: targetUser.avatarUrl, timestamp: serverTimestamp() });
                batch.set(theirFriendRef, { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, timestamp: serverTimestamp() });
                batch.update(myUserDocRef, { friendsCount: increment(1) });
                batch.update(theirUserDocRef, { friendsCount: increment(1) });
                batch.delete(theirRequestRef);
                const notificationRef = doc(collection(db, 'users', theirId, 'notifications'));
                batch.set(notificationRef, {
                    type: 'friend_request_accepted',
                    fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: myId },
                    timestamp: serverTimestamp(),
                    read: false,
                });
                toast({ title: `You are now friends with ${targetUser.name}!` });
            } else if (action === 'unfriend') {
                batch.delete(myFriendRef);
                batch.delete(theirFriendRef);
                batch.update(myUserDocRef, { friendsCount: increment(-1) });
                batch.update(theirUserDocRef, { friendsCount: increment(-1) });
                toast({ title: `You are no longer friends with ${targetUser.name}.` });
            } else if (action === 'block') {
                 batch.set(blockRef, { name: targetUser.name, handle: targetUser.handle, timestamp: serverTimestamp() });
                 toast({ title: `User @${targetUser.handle} blocked.`});
            } else if (action === 'unblock') {
                 batch.delete(blockRef);
                 toast({ title: `User @${targetUser.handle} unblocked.`});
            }
            await batch.commit();
        } catch (error) {
            console.error("Error handling friend action: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
        }
    };
    
    const handleUpdateProfile = async (data: ProfileData): Promise<boolean> => {
        if (!currentUser) return false;
        
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            
            const updateData: {[key: string]: any} = {
                name: data.name,
                handle: data.handle,
                bio: data.bio,
                businessUrl: data.businessUrl,
            };

            if (data.dateOfBirth) {
                updateData.dateOfBirth = Timestamp.fromDate(data.dateOfBirth);
            }

            await updateDoc(userDocRef, updateData);

            toast({ title: "Success", description: "Profile updated!" });

            if (data.handle && data.handle.toLowerCase() !== handle.toLowerCase()) {
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
                }
            });
            router.push(`/?view=messages&conversationId=${result.conversationId}`);

        } catch (e) {
            console.error("Error starting conversation: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start a conversation.' });
        }
    }

    if (loadingAuth || isLoadingProfile || !currentUser) {
        return (
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
                        <ProfileViewSkeleton />
                    </main>
                </div>
            </div>
        );
    }
    
    if (!loggedInUser) {
        return <SocialHomePage />;
    }

    if (!profileUser && !isLoadingProfile) {
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

    const isBlocked = blockedUsers.some(u => u.uid === profileUser?.uid);

    return (
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
                        isCurrentUser={loggedInUser.uid === profileUser?.uid}
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
                        friendshipStatus={friendshipStatus}
                        onStartCall={handleStartCall}
                        onUpdateProfile={handleUpdateProfile}
                        onReportPost={handleReportPost}
                        onMuteUser={handleMuteUser}
                        isBlocked={isBlocked}
                        isLoadingPosts={isLoadingPosts}
                        hasMorePosts={hasMorePosts}
                        loadMorePosts={() => fetchPosts(false)}
                        isLoadingMore={isLoadingMore}
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
            {callState.active && profileUser && (
                <CallView 
                    callTargetUser={profileUser}
                    callType={callState.type}
                    onEndCall={handleEndCall}
                />
            )}
        </div>
    );
}
