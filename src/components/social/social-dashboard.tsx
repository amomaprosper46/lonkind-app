
'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Search, Bell, Home, User, Sparkles, Loader2, Lightbulb, Heart, UserPlus, Cog, Video, LogOut, Bookmark, Users, Wand2, Mic, BrainCircuit, DollarSign, BadgeCheck, Compass, FileText, Radio, MapPin, Wallet } from 'lucide-react';
import type { Post, ReactionType } from './post-card';
import { Input } from '@/components/ui/input';
import { db, storage, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, increment, serverTimestamp, query, orderBy, getDoc, writeBatch, where, limit, onSnapshot, collectionGroup, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { type User as FirebaseUser, updateProfile, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import dynamic from 'next/dynamic';
import PersonalAiView from './personal-ai-view';
import AICommandCenterView from './ai-command-center-view';
import StoryGeneratorView from './story-generator-view';
import type { ProfileData } from './edit-profile-dialog';
import HomeFeed from './home-feed';
import { searchPosts, type SearchPostsOutput } from '@/ai/flows/search-posts';
import { Separator } from '../ui/separator';
import { useSearchParams } from 'next/navigation';

const LoadingComponent = () => <div className="col-span-9 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

const MessagingView = dynamic(() => import('./messaging-view'), { loading: () => <LoadingComponent />, ssr: false });
const SettingsView = dynamic(() => import('./settings-view'), { loading: () => <LoadingComponent />, ssr: false });
const VideosView = dynamic(() => import('./videos-view'), { loading: () => <LoadingComponent />, ssr: false });
const SavedView = dynamic(() => import('./saved-view'), { loading: () => <LoadingComponent />, ssr: false });
const ExploreView = dynamic(() => import('./explore-view'), { loading: () => <LoadingComponent />, ssr: false });
const GroupsView = dynamic(() => import('./groups-view'), { loading: () => <LoadingComponent />, ssr: false });
const SpacesView = dynamic(() => import('./spaces-view'), { loading: () => <LoadingComponent />, ssr: false });
const NearbyView = dynamic(() => import('./nearby-view'), { loading: () => <LoadingComponent />, ssr: false });
const CommentSheet = dynamic(() => import('./comment-sheet'), { ssr: false });
const GroupDetailsView = dynamic(() => import('./group-details-view'), { loading: () => <LoadingComponent />, ssr: false });
const WalletView = dynamic(() => import('./wallet-view'), { loading: () => <LoadingComponent />, ssr: false });


type SocialDashboardProps = {
  user: FirebaseUser;
  onSignOut: () => void;
};

type View = 'home' | 'explore' | 'groups' | 'messages' | 'videos' | 'saved' | 'settings' | 'ai-command-center' | 'personal-ai' | 'story-writer' | 'monetization' | 'spaces' | 'nearby' | 'group-details' | 'wallet';

export interface SuggestedUser {
    id: string;
    name: string;
    handle: string;
    uid: string;
    avatarUrl: string;
    isProfessional?: boolean;
}

interface SearchResultUser {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
}

export interface NotificationFromUser {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
}

export interface Notification {
    id: string;
    type: 'new_follower' | 'new_reaction' | 'new_comment' | 'friend_request_accepted';
    fromUser: NotificationFromUser;
    postId?: string;
    reactionType?: ReactionType;
    commentText?: string;
    timestamp: any;
    read: boolean;
    postAuthorHandle?: string;
}

export interface CurrentUser {
    name: string;
    avatarUrl: string;
    handle: string;
    uid: string;
    email: string;
    isProfessional?: boolean;
    bio?: string;
    businessUrl?: string;
    balance?: number;
    coins?: number;
    diamonds?: number;
}

function SocialDashboardInternal({ user, onSignOut }: SocialDashboardProps) {
  const searchParams = useSearchParams();
  const [currentView, setCurrentView] = useState<View>('home');
  const [initialConversationId, setInitialConversationId] = useState<string | undefined>(undefined);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  
  const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(new Map());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SearchResultUser[]>([]);
  const [postSearchResults, setPostSearchResults] = useState<SearchPostsOutput['posts']>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const view = searchParams.get('view') as View;
    const conversationId = searchParams.get('conversationId');
    const groupId = searchParams.get('groupId');

    if (view) {
      setCurrentView(view);
    }
    if (conversationId) {
      setInitialConversationId(conversationId);
    }
    if (groupId) {
      setActiveGroupId(groupId);
      setCurrentView('group-details');
    }

  }, [searchParams]);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  
    useEffect(() => {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as CurrentUser;
                setCurrentUser(userData);
            } else {
                 // This case should ideally not be hit if the WelcomeDialog flow completes.
                 // It's a fallback.
                 setCurrentUser({
                    name: user.displayName || 'Anonymous',
                    avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${(user.displayName || 'A').charAt(0)}`,
                    handle: user.email?.split('@')[0].toLowerCase() || 'user',
                    uid: user.uid,
                    email: user.email || '',
                    isProfessional: false,
                    bio: '',
                    businessUrl: '',
                    balance: 0,
                    coins: 100,
                    diamonds: 0,
                });
            }
        });
         return () => unsubscribe();
    }, [user.uid, user.displayName, user.photoURL, user.email]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    const fetchFollowing = useCallback(async () => {
        if (!currentUser?.uid) return new Set<string>();
        const followingRef = collection(db, 'users', currentUser.uid, 'following');
        const snapshot = await getDocs(followingRef);
        const followingIds = new Set(snapshot.docs.map(doc => doc.id));
        setFollowing(followingIds);
        return followingIds;
    }, [currentUser?.uid]);
    
    const fetchUserReactions = useCallback(async () => {
        if (!currentUser?.uid) return;
        const newReactions = new Map<string, ReactionType>();
        const reactionsQuery = query(collectionGroup(db, 'reactions'), where('user.uid', '==', currentUser.uid));
        const reactionSnapshots = await getDocs(reactionsQuery);
        reactionSnapshots.forEach(doc => {
            const parentPostId = doc.ref.parent.parent?.id;
            if (parentPostId) {
                newReactions.set(parentPostId, doc.data().type);
            }
        });
        setUserReactions(newReactions);
    }, [currentUser?.uid]);

    const fetchSavedPosts = useCallback(async () => {
        if (!currentUser?.uid) return;
        const savedPostsRef = collection(db, 'users', currentUser.uid, 'savedPosts');
        const unsubscribe = onSnapshot(savedPostsRef, (snapshot) => {
            const postIds = new Set(snapshot.docs.map(doc => doc.id));
            setSavedPostIds(postIds);
        });
        return unsubscribe;
    }, [currentUser?.uid]);

    useEffect(() => {
        if (currentUser) {
            fetchFollowing();
            fetchUserReactions();
            const unsubscribe = fetchSavedPosts();
            return () => {
                unsubscribe.then(unsub => unsub && unsub());
            };
        }
    }, [currentUser, fetchFollowing, fetchUserReactions, fetchSavedPosts]);

    useEffect(() => {
        if (!currentUser?.uid) return;

        const notifsRef = collection(db, 'users', currentUser.uid, 'notifications');
        const q = query(notifsRef, orderBy('timestamp', 'desc'), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(notifs);
            const unreadCount = notifs.filter(n => !n.read).length;
            setUnreadNotifications(unreadCount);
        });

        return () => unsubscribe();
    }, [currentUser?.uid]);
    
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setUserSearchResults([]);
            setPostSearchResults([]);
            return;
        }

        const performSearch = async () => {
            setIsSearchLoading(true);
            const usersRef = collection(db, 'users');
            
            const handleQuery = query(
                usersRef, 
                where('handle', '>=', searchQuery.toLowerCase()), 
                where('handle', '<=', searchQuery.toLowerCase() + '\uf8ff'),
                limit(3)
            );
            
            const nameQuery = query(
                usersRef, 
                where('name', '>=', searchQuery), 
                where('name', '<=', searchQuery + '\uf8ff'),
                limit(3)
            );

            try {
                const [handleSnapshot, nameSnapshot, postResults] = await Promise.all([
                    getDocs(handleQuery), 
                    getDocs(nameSnapshot),
                    searchPosts({ searchText: searchQuery })
                ]);
                
                const usersMap = new Map<string, SearchResultUser>();
                
                handleSnapshot.docs.forEach(doc => {
                    if (!usersMap.has(doc.id)) {
                        usersMap.set(doc.id, { uid: doc.id, ...doc.data() } as SearchResultUser);
                    }
                });
                
                nameSnapshot.docs.forEach(doc => {
                    if (!usersMap.has(doc.id)) {
                         usersMap.set(doc.id, { uid: doc.id, ...doc.data() } as SearchResultUser);
                    }
                });

                setUserSearchResults(Array.from(usersMap.values()));
                setPostSearchResults(postResults.posts);

            } catch (error) {
                console.error("Error searching:", error);
            } finally {
                setIsSearchLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            performSearch();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);


    const handleReact = async (postId: string, reaction: ReactionType, authorUid: string) => {
        if (!currentUser) return;
        
        if (authorUid === currentUser.uid) {
            toast({
                title: "Can't react to your own post",
                description: "You can only react to other people's posts.",
            });
            return;
        }

        const postRef = doc(db, 'posts', postId);
        const reactionRef = doc(collection(postRef, 'reactions'), currentUser.uid);

        try {
            await runTransaction(db, async (transaction) => {
                const reactionDoc = await transaction.get(reactionRef);
                const postDoc = await transaction.get(postRef);

                if (!postDoc.exists()) {
                    throw "Post does not exist!";
                }

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
                    
                    if (!existingReaction) {
                         const notificationRef = doc(collection(db, 'users', authorUid, 'notifications'));
                         transaction.set(notificationRef, {
                            type: 'new_reaction',
                            fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: currentUser.uid },
                            postId: postId,
                            postAuthorHandle: postData.author.handle,
                            reactionType: reaction,
                            timestamp: serverTimestamp(),
                            read: false,
                        });
                    }
                }
                 setUserReactions(newReactionsMap);
            });
        } catch (e) {
            console.error("Transaction failed: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not process reaction.' });
        }
    };
  
    const handleComment = async (postId: string, commentText: string) => {
       if (!currentUser) return false;
       const postDoc = await getDoc(doc(db, 'posts', postId));
       if(!postDoc.exists()) return false;
       const postData = postDoc.data() as Post;
       const authorUid = postData.author.uid;

        const postRef = doc(db, 'posts', postId);
        const commentsRef = collection(db, 'posts', postId, 'comments');
        
        try {
            const batch = writeBatch(db);

            const newCommentRef = doc(commentsRef);
            batch.set(newCommentRef, {
                text: commentText,
                author: {
                    uid: currentUser.uid,
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    isProfessional: currentUser.isProfessional || false,
                },
                timestamp: serverTimestamp(),
            });

            batch.update(postRef, { comments: increment(1) });

            if (authorUid !== currentUser.uid) {
                const notificationRef = doc(collection(db, 'users', authorUid, 'notifications'));
                batch.set(notificationRef, {
                    type: 'new_comment',
                    fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: currentUser.uid },
                    postId: postId,
                    postAuthorHandle: postData.author.handle,
                    commentText: commentText.substring(0, 100), // Store a snippet
                    timestamp: serverTimestamp(),
                    read: false,
                });
            }
            
            await batch.commit();
            return true;
        } catch(e) {
            console.error("Error adding comment: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add comment.' });
            return false;
        }
    };

    const handleFollow = async (targetUser: SuggestedUser) => {
        if (!currentUser) return;
    
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const targetUserRef = doc(db, 'users', targetUser.uid);
    
        const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUser.uid);
        const followerRef = doc(db, 'users', targetUser.uid, 'followers', currentUser.uid);
    
        const batch = writeBatch(db);
    
        try {
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

            const notificationRef = doc(collection(db, 'users', targetUser.uid, 'notifications'));
            batch.set(notificationRef, {
                type: 'new_follower',
                fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: currentUser.uid },
                timestamp: serverTimestamp(),
                read: false,
            });
    
            await batch.commit();
    
            setFollowing(prev => new Set(prev).add(targetUser.uid));
            // Optimistically remove the followed user from suggestions
            setSuggestedUsers(prev => prev.filter(u => u.uid !== targetUser.uid));
            toast({ title: `You are now following ${targetUser.name}` });
        } catch (error) {
            console.error("Error following user: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not follow user.' });
        }
    };
    
    
    const handleSavePost = async (postId: string) => {
        if (!currentUser) return;
        const savedPostRef = doc(db, 'users', currentUser.uid, 'savedPosts', postId);
        const newSavedPostIds = new Set(savedPostIds);
        
        try {
            if (newSavedPostIds.has(postId)) {
                await deleteDoc(savedPostRef);
                newSavedPostIds.delete(postId);
                toast({ title: 'Post unsaved' });
            } else {
                await setDoc(savedPostRef, { timestamp: serverTimestamp() });
                newSavedPostIds.add(postId);
                toast({ title: 'Post saved!' });
            }
            setSavedPostIds(newSavedPostIds);
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

            // Delete all comments in subcollection
            const commentsRef = collection(db, 'posts', postId, 'comments');
            const commentsQuery = query(commentsRef);
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Delete all reactions in subcollection
            const reactionsRef = collection(db, 'posts', postId, 'reactions');
            const reactionsQuery = query(reactionsRef);
            const reactionsSnapshot = await getDocs(reactionsQuery);
            reactionsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Delete the main post
            batch.delete(postRef);

            await batch.commit();

            toast({ title: 'Post Deleted', description: 'Your post has been successfully removed.' });

        } catch (error) {
            console.error('Error deleting post:', error);
            toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the post.' });
        }
    };

    const handleUpdateProfile = async (data: ProfileData): Promise<boolean> => {
        const authUser = auth.currentUser;
        if (!authUser || !currentUser) return false;
        
        try {
            const updates: { [key: string]: any } = {};
            let newAvatarUrl = currentUser.avatarUrl;

            if (data.handle && data.handle !== currentUser.handle) {
                const newHandle = data.handle.toLowerCase();
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('handle', '==', newHandle));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    toast({ variant: 'destructive', title: 'Handle already taken', description: 'Please choose a different handle.' });
                    return false;
                }
                updates.handle = newHandle;
            }
            
            if (data.name && data.name !== currentUser.name) {
                updates.name = data.name;
            }

            if (data.bio !== undefined && data.bio !== currentUser.bio) {
                updates.bio = data.bio;
            }

            if (data.businessUrl !== undefined && data.businessUrl !== currentUser.businessUrl) {
                updates.businessUrl = data.businessUrl;
            }
            
            if (data.avatarFile) {
                const storageRef = ref(storage, `avatars/${authUser.uid}/${data.avatarFile.name}`);
                const snapshot = await uploadBytes(storageRef, data.avatarFile);
                newAvatarUrl = await getDownloadURL(snapshot.ref);
                updates.avatarUrl = newAvatarUrl;
            }
            
            if (Object.keys(updates).length > 0) {
                 const userDocRef = doc(db, 'users', authUser.uid);
                 await updateDoc(userDocRef, updates);
            }
            
            if (updates.name || updates.avatarUrl) {
                await updateProfile(authUser, {
                    displayName: updates.name || currentUser.name,
                    photoURL: updates.avatarUrl || currentUser.avatarUrl,
                });
            }
    
            toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
            return true;
        } catch (error) {
            console.error("Error updating profile:", error);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update your profile.' });
            return false;
        }
    };
    
    const handlePasswordReset = async () => {
        if (!currentUser?.email) {
             toast({
                variant: 'destructive',
                title: 'No Email Found',
                description: 'Cannot send password reset without an email address.',
            });
            return;
        }
        try {
            await sendPasswordResetEmail(auth, currentUser.email);
            toast({
                title: 'Password Reset Email Sent',
                description: 'Check your inbox for a link to reset your password.',
            });
        } catch (error) {
            console.error("Error sending password reset email:", error);
            toast({
                variant: 'destructive',
                title: 'Request Failed',
                description: 'Could not send password reset email. Please try again later.',
            });
        }
    };
    
    const handleDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user) return;
        
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await deleteDoc(userDocRef);
            await deleteUser(user);
            
            toast({
                title: 'Account Deleted',
                description: 'Your account has been permanently deleted.',
            });
        } catch (error: any) {
            console.error("Error deleting account:", error);
             toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: `Could not delete your account. You may need to sign in again to perform this action. (${error.code})`,
            });
        }
    };

    const handleOpenComments = (post: Post) => {
        setSelectedPostForComments(post);
    };

    const changeView = (view: View, groupId: string | null = null) => {
        setCurrentView(view);
        setActiveGroupId(groupId);
        // Also update URL for deep linking
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        if (groupId) {
             url.searchParams.set('groupId', groupId);
        } else {
             url.searchParams.delete('groupId');
        }
        window.history.pushState({}, '', url);
    }
    
    const renderMainContent = () => {
        if (!currentUser) return <main className="col-span-9 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;

        switch (currentView) {
            case 'home':
                return (
                    <HomeFeed 
                        currentUser={currentUser}
                        onReact={handleReact}
                        onComment={handleOpenComments}
                        onSavePost={handleSavePost}
                        onDeletePost={handleDeletePost}
                        userReactions={userReactions}
                        savedPostIds={savedPostIds}
                    />
                );
             case 'explore':
                return <ExploreView 
                            currentUser={currentUser}
                            onReact={handleReact}
                            onComment={handleOpenComments}
                            onSavePost={handleSavePost}
                            onDeletePost={handleDeletePost}
                            userReactions={userReactions}
                            savedPostIds={savedPostIds}
                        />;
            case 'groups':
                return <GroupsView currentUser={currentUser} onGroupSelect={(groupId) => changeView('group-details', groupId)} />;
            case 'group-details':
                 return activeGroupId ? <GroupDetailsView 
                                            groupId={activeGroupId} 
                                            currentUser={currentUser}
                                            onReact={handleReact}
                                            onComment={handleOpenComments}
                                            onSavePost={handleSavePost}
                                            onDeletePost={handleDeletePost}
                                            userReactions={userReactions}
                                            savedPostIds={savedPostIds}
                                        /> : <LoadingComponent />;
            case 'spaces':
                return <SpacesView currentUser={currentUser} />;
            case 'nearby':
                return <NearbyView 
                            currentUser={currentUser}
                            onReact={handleReact}
                            onComment={handleOpenComments}
                            onSavePost={handleSavePost}
                            onDeletePost={handleDeletePost}
                            userReactions={userReactions}
                            savedPostIds={savedPostIds}
                        />;
            case 'messages':
                return (
                    <Suspense fallback={<LoadingComponent />}>
                        <MessagingView initialConversationId={initialConversationId} />
                    </Suspense>
                );
            case 'saved':
                return <SavedView 
                            currentUser={currentUser}
                            onReact={handleReact}
                            onComment={handleOpenComments}
                            onSavePost={handleSavePost}
                            onDeletePost={handleDeletePost}
                            userReactions={userReactions}
                            savedPostIds={savedPostIds}
                        />;
            case 'videos':
                return <VideosView 
                            currentUser={currentUser}
                            onReact={handleReact}
                            onComment={handleOpenComments}
                            onSavePost={handleSavePost}
                            onDeletePost={handleDeletePost}
                            userReactions={userReactions}
                            savedPostIds={savedPostIds}
                        />;
            case 'settings':
                return (
                    <SettingsView 
                        user={currentUser}
                        onSignOut={onSignOut} 
                        onUpdateProfile={handleUpdateProfile}
                        onPasswordReset={handlePasswordReset}
                        onDeleteAccount={handleDeleteAccount}
                    />
                );
            case 'wallet':
            case 'monetization':
                 return <WalletView currentUser={currentUser} />;
            case 'ai-command-center':
                 return <AICommandCenterView isProfessional={currentUser.isProfessional} />;
            case 'story-writer':
                return <main className="col-span-9"><StoryGeneratorView /></main>;
            case 'personal-ai':
                 return <main className="col-span-9"><PersonalAiView /></main>;
            default:
                return <main className="col-span-9">Select a view</main>;
        }
    };
    
    const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);

    const fetchSuggestedUsers = useCallback(async () => {
        if (!currentUser?.uid) return;
    
        // Get the list of users the current user is already following
        const followingRef = collection(db, 'users', currentUser.uid, 'following');
        const followingSnapshot = await getDocs(followingRef);
        const followingIds = new Set(followingSnapshot.docs.map(doc => doc.id));
        followingIds.add(currentUser.uid); // Also exclude the current user
    
        // In a real large-scale app, you would not fetch all users.
        // You'd use a more sophisticated recommendation engine or a different query structure.
        // For this app's scale, we fetch a sample of users and filter them.
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(20));
        
        const allUsersSnapshot = await getDocs(q);
        const allUsers = allUsersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SuggestedUser));
        
        // Filter out users already followed or the user themselves
        const suggestions = allUsers.filter(u => !followingIds.has(u.uid));
    
        setSuggestedUsers(suggestions.slice(0, 5));
    }, [currentUser?.uid]);
    
    useEffect(() => {
        if(currentView === 'home' && currentUser) {
            fetchSuggestedUsers();
        }
    }, [fetchSuggestedUsers, currentView, currentUser]);

    const getNotificationLink = (notif: Notification) => {
        switch (notif.type) {
            case 'new_follower':
                return `/profile/${notif.fromUser.handle}`;
            case 'new_reaction':
            case 'new_comment':
                return `/profile/${notif.postAuthorHandle}`; 
            default:
                return '#';
        }
    }

    const renderNotificationText = (notif: Notification) => {
        const from = <span className="font-semibold">{notif.fromUser.name}</span>;
        switch (notif.type) {
            case 'new_follower':
                return <>{from} started following you.</>;
            case 'new_reaction':
                return <>{from} reacted to your post.</>;
            case 'new_comment':
                return <>{from} commented on your post.</>;
            default:
                return 'New notification';
        }
    }

     const handleMarkNotificationsRead = async () => {
        if (!currentUser || unreadNotifications === 0) return;

        const notifsRef = collection(db, 'users', currentUser.uid, 'notifications');
        const unreadQuery = query(notifsRef, where('read', '==', false));
        
        try {
            const snapshot = await getDocs(unreadQuery);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking notifications as read:", error);
        }
    };
    
    if (!currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-secondary/40">
                <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                    <div className="container flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2" onClick={() => changeView('home')}>
                        <Image src="/logo.png" alt="Lonkind Logo" width={32} height={32} />
                        <span className="text-xl font-bold hidden sm:inline-block">Lonkind</span>
                    </Link>
                    <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md" ref={searchContainerRef}>
                        <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search Lonkind" 
                            className="pl-10" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                        />
                        {isSearchFocused && searchQuery && (
                            <Card className="absolute top-full mt-2 w-full shadow-lg z-50 max-h-[60vh] overflow-y-auto">
                                <CardContent className="p-2">
                                    {isSearchLoading ? (
                                        <div className="flex items-center justify-center p-4">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            {userSearchResults.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold text-muted-foreground px-2 pt-2">Users</p>
                                                    {userSearchResults.map(user => (
                                                        <Link href={`/profile/${user.handle}`} key={user.uid} className="block" onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }}>
                                                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent">
                                                                <Avatar className="h-9 w-9">
                                                                    <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar" />
                                                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-semibold text-sm">{user.name}</p>
                                                                    <p className="text-xs text-muted-foreground">@{user.handle}</p>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            {postSearchResults.length > 0 && (
                                                <div className="space-y-1">
                                                     <Separator className="my-2" />
                                                     <p className="text-xs font-semibold text-muted-foreground px-2">Posts</p>
                                                     {postSearchResults.map(post => (
                                                        <Link href={`/profile/${post.author.handle}`} key={post.id} className="block" onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }}>
                                                            <div className="flex items-start gap-3 p-2 rounded-md hover:bg-accent">
                                                                <FileText className="h-5 w-5 text-muted-foreground mt-1" />
                                                                <div className='flex-1'>
                                                                    <p className="text-sm line-clamp-2">{post.content}</p>
                                                                    <p className="text-xs text-muted-foreground">by @{post.author.handle}</p>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                     ))}
                                                </div>
                                            )}
                                            {userSearchResults.length === 0 && postSearchResults.length === 0 && (
                                                <p className="p-4 text-sm text-center text-muted-foreground">No results found.</p>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant={currentView === 'home' ? 'secondary' : 'ghost'} 
                                    size="icon" 
                                    onClick={() => changeView('home')}
                                >
                                    <Home className="h-6 w-6" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Home</p></TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                 <Button 
                                    variant={currentView === 'explore' ? 'secondary' : 'ghost'} 
                                    size="icon" 
                                    onClick={() => changeView('explore')}
                                >
                                    <Compass className="h-6 w-6" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Explore</p></TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant={currentView === 'messages' ? 'secondary' : 'ghost'} 
                                    size="icon" 
                                    onClick={() => changeView('messages')}
                                >
                                    <MessageSquare className="h-6 w-6" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Messages</p></TooltipContent>
                        </Tooltip>
                        
                        {isClient && <Popover onOpenChange={(open) => { if(open) handleMarkNotificationsRead() } }>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-6 w-6" />
                                    {unreadNotifications > 0 && (
                                        <span className="absolute top-0 right-0 h-4 w-4 text-xs font-bold text-white bg-red-500 rounded-full flex items-center justify-center">
                                            {unreadNotifications}
                                        </span>
                                    )}
                                    <span className="sr-only">Notifications</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0">
                               <Card>
                                 <CardHeader>
                                    <CardTitle>Notifications</CardTitle>
                                 </CardHeader>
                                 <CardContent className="max-h-[400px] overflow-y-auto">
                                   {notifications.length > 0 ? (
                                        notifications.map(notif => (
                                            <Link href={getNotificationLink(notif)} key={notif.id} className="block">
                                                <div className="flex flex-col gap-2 p-3 border-b last:border-b-0 hover:bg-accent/50">
                                                    <div className="flex items-start gap-3">
                                                        <div className="text-primary mt-1">
                                                            {notif.type === 'new_follower' && <UserPlus className="h-6 w-6" />}
                                                            {notif.type === 'new_reaction' && <Heart className="h-6 w-6" />}
                                                            {notif.type === 'new_comment' && <MessageSquare className="h-6 w-6" />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <Avatar className="inline-block h-8 w-8 mr-2">
                                                                <AvatarImage src={notif.fromUser.avatarUrl} alt={notif.fromUser.name} data-ai-hint="user avatar" />
                                                                <AvatarFallback>{notif.fromUser.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            {renderNotificationText(notif)}
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate()) : '...'} ago
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                   ) : (
                                     <p className="text-center text-muted-foreground p-4">No new notifications.</p>
                                   )}
                                 </CardContent>
                               </Card>
                            </PopoverContent>
                        </Popover>}
                        <Popover>
                             <PopoverTrigger asChild>
                                 <Button variant="ghost" size="icon">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                                        <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                 </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2">
                                <Link href={`/profile/${currentUser.handle}`}>
                                  <Button asChild variant='ghost' className="w-full justify-start">
                                    <span><User className="mr-2 h-4 w-4" />My Profile</span>
                                  </Button>
                                </Link>
                                <Button variant='ghost' className="w-full justify-start" onClick={() => changeView('wallet')}>
                                    <Wallet className="mr-2 h-4 w-4" />
                                    My Wallet
                                </Button>
                                <Button variant='ghost' className="w-full justify-start" onClick={() => changeView('saved')}>
                                    <Bookmark className="mr-2 h-4 w-4" />
                                    Saved
                                </Button>
                                <Button variant='ghost' className="w-full justify-start" onClick={() => changeView('settings')}>
                                    <Cog className="mr-2 h-4 w-4" />
                                    Settings
                                </Button>
                                <Button variant='ghost' className="w-full justify-start" onClick={onSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign Out
                                </Button>
                            </PopoverContent>
                        </Popover>
                    </div>
                    </div>
                </header>
                
                <div className="container grid grid-cols-12 gap-8 py-8">
                    <aside className="hidden lg:block lg:col-span-3">
                         <Card>
                            <CardContent className="p-2">
                                <nav className="flex flex-col gap-1">
                                    <Button variant={currentView === 'home' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('home')}>
                                        <Home className="h-5 w-5" /> Home
                                    </Button>
                                    <Button variant={currentView === 'explore' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('explore')}>
                                        <Compass className="h-5 w-5" /> Explore
                                    </Button>
                                    <Button variant={currentView === 'groups' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('groups')}>
                                        <Users className="h-5 w-5" /> Groups
                                    </Button>
                                    <Button variant={currentView === 'spaces' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('spaces')}>
                                        <Radio className="h-5 w-5" /> Spaces
                                    </Button>
                                     <Button variant={currentView === 'videos' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('videos')}>
                                        <Video className="h-5 w-5" /> Videos
                                    </Button>
                                     <Link href={`/profile/${currentUser.handle}`} className="w-full">
                                        <Button variant='ghost' className="w-full justify-start gap-2">
                                            <User className="h-5 w-5" /> My Profile
                                        </Button>
                                     </Link>
                                     <Button variant={currentView === 'monetization' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('monetization')} disabled={!currentUser.isProfessional}>
                                        <DollarSign className="h-5 w-5" /> Monetization
                                    </Button>
                                    <Button variant={currentView === 'ai-command-center' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('ai-command-center')}>
                                        <Sparkles className="h-5 w-5" /> AI Command Center
                                    </Button>
                                    <Button variant={currentView === 'personal-ai' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('personal-ai')}>
                                        <BrainCircuit className="h-5 w-5" /> Personal AI
                                    </Button>
                                </nav>
                            </CardContent>
                        </Card>
                    </aside>
        
                    {isClient ? <Suspense fallback={<LoadingComponent />}>
                        {renderMainContent()}
                    </Suspense> : <LoadingComponent />}
                    
                    {currentView === 'home' && isClient && (
                        <aside className="hidden md:block md:col-span-4 lg:col-span-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>People to Follow</CardTitle>
                                </CardHeader>
                                <CardContent>
                                <div className="space-y-4">
                                    {suggestedUsers.length > 0 ? (
                                        suggestedUsers.map(suggestedUser => (
                                            <div key={suggestedUser.uid} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={suggestedUser.avatarUrl || `https://placehold.co/100x100.png?text=${suggestedUser.name.charAt(0)}`} data-ai-hint="user avatar" />
                                                        <AvatarFallback>{suggestedUser.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <Link href={`/profile/${suggestedUser.handle}`} className="font-semibold hover:underline">{suggestedUser.name}</Link>
                                                        <p className="text-muted-foreground text-sm">@{suggestedUser.handle}</p>
                                                    </div>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant='outline'
                                                    onClick={() => handleFollow(suggestedUser)}
                                                >
                                                    Follow
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">No new people to follow right now. Check back later!</p>
                                    )}
                                </div>
                                </CardContent>
                            </Card>
                        </aside>
                    )}
                </div>
                
                {isClient && currentUser && <Suspense>
                    <CommentSheet 
                        post={selectedPostForComments}
                        onOpenChange={(isOpen) => {
                            if (!isOpen) {
                                setSelectedPostForComments(null);
                            }
                        }}
                        onCommentSubmit={(postId, commentText) => handleComment(postId, commentText)}
                        currentUser={currentUser}
                    />
                </Suspense>}
            </div>
        </TooltipProvider>
    );
}

export default function SocialDashboard({ user, onSignOut }: SocialDashboardProps) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <SocialDashboardInternal user={user} onSignOut={onSignOut} />
    </Suspense>
  )
}
