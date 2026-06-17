'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Search, Bell, Home, User, Sparkles, Loader2, Lightbulb, Heart, UserPlus, Cog, Video, LogOut, Bookmark, Users, Wand2, Mic, BrainCircuit, DollarSign, BadgeCheck, Compass, FileText, Radio, MapPin, Wallet, UserCheck, Trophy, ShieldAlert } from 'lucide-react';
import type { Post, ReactionType } from './post-card';
import { Input } from '@/components/ui/input';
import { db, storage, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, increment, serverTimestamp, query, orderBy, getDoc, writeBatch, where, limit, onSnapshot, collectionGroup, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { type User as FirebaseUser, updateProfile, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import Link from 'next/link';
import { requestNotificationPermission, setupForegroundMessageListener } from '@/lib/fcm';
import { sendPushNotification } from '@/app/actions/sendNotification';
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

// ✅ Separate the runtime search function call...
import { searchPosts } from '@/ai/flows/search-posts';
// ...from its metadata type checking layout structure!
import type { SearchPostsOutput } from '@/ai/flows/search-posts';

import { Separator } from '../ui/separator';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-compression';

const LoadingComponent = () => <div className="col-span-12 md:col-span-9 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

const MessagingView = dynamic(() => import('./messaging-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const SettingsView = dynamic(() => import('./settings-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const VideosView = dynamic(() => import('./videos-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const SavedView = dynamic(() => import('./saved-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const ExploreView = dynamic(() => import('./explore-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const GroupsView = dynamic(() => import('./groups-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const SpacesView = dynamic(() => import('./spaces-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const NearbyView = dynamic(() => import('./nearby-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const CommentSheet = dynamic(() => import('./comment-sheet').then(mod => mod.default), { ssr: false });
const AdminDashboardView = dynamic(() => import('./admin-dashboard-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const GroupDetailsView = dynamic(() => import('./group-details-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const WalletView = dynamic(() => import('./wallet-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });
const LeaderboardView = dynamic(() => import('./leaderboard-view').then(mod => mod.default), { loading: () => <LoadingComponent />, ssr: false });


type SocialDashboardProps = {
  user: FirebaseUser;
  onSignOut: () => void;
};

type View = 'home' | 'explore' | 'groups' | 'messages' | 'videos' | 'saved' | 'settings' | 'ai-command-center' | 'personal-ai' | 'story-writer' | 'spaces' | 'nearby' | 'group-details' | 'wallet' | 'profile' | 'leaderboard' | 'admin';

export interface SuggestedUser {
    id: string;
    name: string;
    handle: string;
    uid: string;
    avatarUrl: string;
    isProfessional?: boolean;
}

export interface BlockedUser {
    uid: string;
    name: string;
    handle: string;
}

export interface MutedUser {
    uid: string;
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
    type: 'friend_request' | 'friend_request_accepted' | 'new_reaction' | 'new_comment' | 'new_message' | 'group_post' | 'new_follower';
    fromUser: NotificationFromUser;
    postId?: string;
    reactionType?: ReactionType;
    commentText?: string;
    timestamp: any;
    read: boolean;
    postAuthorHandle?: string;
    conversationId?: string;
    messageSnippet?: string;
    groupId?: string;
    groupName?: string;
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
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SearchResultUser[]>([]);
  const [postSearchResults, setPostSearchResults] = useState<SearchPostsOutput['posts']>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [sentFriendRequests, setSentFriendRequests] = useState<Set<string>>(new Set());

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);

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
                    coins: 0,
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
    
    useEffect(() => {
        if (!currentUser?.uid) return;

        // Initialize Push Notifications
        requestNotificationPermission(currentUser.uid);
        setupForegroundMessageListener();

        // Fetch user reactions
        const reactionsQuery = query(collectionGroup(db, 'reactions'), where('user.uid', '==', currentUser.uid));
        const unsubReactions = onSnapshot(reactionsQuery, (snapshot) => {
             const newReactions = new Map<string, ReactionType>();
             snapshot.forEach(doc => {
                const parentPostId = doc.ref.parent.parent?.id;
                if(parentPostId) newReactions.set(parentPostId, doc.data().type);
             });
             setUserReactions(newReactions);
        });

        const savedPostsRef = collection(db, 'users', currentUser.uid, 'savedPosts');
        const unsubSaved = onSnapshot(savedPostsRef, (snapshot) => {
            const postIds = new Set(snapshot.docs.map(doc => doc.id));
            setSavedPostIds(postIds);
        });

        const notifsRef = collection(db, 'users', currentUser.uid, 'notifications');
        const q = query(notifsRef, orderBy('timestamp', 'desc'), limit(20));
        const unsubNotifs = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(notifs);
            setUnreadNotifications(notifs.filter(n => !n.read).length);
        });

        const blockedUsersRef = collection(db, 'users', currentUser.uid, 'blockedUsers');
        const unsubBlocked = onSnapshot(blockedUsersRef, (snapshot) => {
            setBlockedUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as BlockedUser)));
        });

        const mutedUsersRef = collection(db, 'users', currentUser.uid, 'mutedUsers');
        const unsubMuted = onSnapshot(mutedUsersRef, (snapshot) => {
            setMutedUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as MutedUser)));
        });
        
        return () => {
            unsubReactions();
            unsubSaved();
            unsubNotifs();
            unsubBlocked();
            unsubMuted();
        };
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
            
            const handleQuery = query( usersRef, where('handle', '>=', searchQuery.toLowerCase()), where('handle', '<=', searchQuery.toLowerCase() + '\uf8ff'), limit(3));
            const nameQuery = query( usersRef, where('name', '>=', searchQuery), where('name', '<=', searchQuery + '\uf8ff'), limit(3) );

            try {
                const [handleSnapshot, nameSnapshot, postResults] = await Promise.all([
                    getDocs(handleQuery), 
                    getDocs(nameQuery),
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
        }, 3);

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
                const existingReaction = reactionDoc.exists() ? reactionDoc.data().type : null;
                const newReactionsMap = new Map(userReactions);

                if (existingReaction === reaction) {
                    transaction.delete(reactionRef);
                    if (postData.reactions?.[reaction]) {
                        transaction.update(postRef, { [`reactions.${reaction}`]: increment(-1) });
                    }
                    newReactionsMap.delete(postId);
                } else { 
                    if (existingReaction) {
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
                    
                    if (!existingReaction && authorUid !== currentUser.uid) {
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
                        
                        // Push Notification
                        sendPushNotification(
                             authorUid,
                             'New Reaction!',
                             `${currentUser.name} reacted to your post.`
                        ).catch(err => console.error("Push Notification error:", err));
                    }
                }
                
                // Optimistically update the UI state
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
                
                // Push Notification
                sendPushNotification(
                    authorUid,
                    `${currentUser.name} commented on your post`,
                    commentText.length > 50 ? commentText.substring(0, 50) + '...' : commentText
                ).catch(err => console.error("Push Notification error:", err));
            }
            
            await batch.commit();
            return true;
        } catch(e) {
            console.error("Error adding comment: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add comment.' });
            return false;
        }
    };

    const handleAddFriend = async (targetUser: SuggestedUser) => {
        if (!currentUser) return;
    
        const myId = currentUser.uid;
        const theirId = targetUser.uid;
        const myRequestRef = doc(db, 'users', theirId, 'friendRequests', myId);
        const notificationRef = doc(collection(db, 'users', theirId, 'notifications'));
    
        const batch = writeBatch(db);
    
        try {
            batch.set(myRequestRef, {
                from: { uid: myId, name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl },
                timestamp: serverTimestamp(),
                status: 'pending'
            });

            await batch.commit();
    
            setSentFriendRequests(prev => new Set(prev).add(theirId));
            toast({ title: `Friend request sent to ${targetUser.name}` });

            // Send notification separately
            try {
                const notificationRef = doc(collection(db, 'users', theirId, 'notifications'));
                await setDoc(notificationRef, {
                    type: 'friend_request',
                    fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: myId },
                    timestamp: serverTimestamp(),
                    read: false,
                });
            } catch (notifError) {
                console.warn("Could not send friend request notification:", notifError);
            }
        } catch (error) {
            console.error("Error sending friend request: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not send friend request.' });
        }
    };
    
    const handleAcceptFriendRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.preventDefault(); // Prevent link navigation
        e.stopPropagation();
        if (!currentUser) return;
        const senderId = notif.fromUser.uid;

        try {
            // Write to my own friends list and delete the request
            const batch = writeBatch(db);
            const myFriendRef = doc(db, 'users', currentUser.uid, 'friends', senderId);
            const requestRef = doc(db, 'users', currentUser.uid, 'friendRequests', senderId);
            
            batch.set(myFriendRef, { 
                uid: senderId,
                name: notif.fromUser.name,
                handle: notif.fromUser.handle,
                avatarUrl: notif.fromUser.avatarUrl,
                timestamp: serverTimestamp() 
            });
            batch.delete(requestRef);
            
            // Mark notification as read
            const notifRef = doc(db, 'users', currentUser.uid, 'notifications', notif.id);
            batch.update(notifRef, { read: true, type: 'friend_request_accepted' });

            await batch.commit();

            // Try to add to their friends list (may fail due to security rules)
            try {
                const theirFriendRef = doc(db, 'users', senderId, 'friends', currentUser.uid);
                await setDoc(theirFriendRef, {
                    uid: currentUser.uid,
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    timestamp: serverTimestamp()
                });
            } catch (err) {
                console.warn("Could not write to sender's friend list due to rules", err);
            }

            toast({ title: `You and ${notif.fromUser.name} are now friends!` });
        } catch (error) {
            console.error('Error accepting friend request:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not accept friend request.' });
        }
    };
    
    
    const handleSavePost = async (postId: string) => {
        if (!currentUser) return;
        const savedPostRef = doc(db, 'users', currentUser.uid, 'savedPosts', postId);
        
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
                const fileToUpload = await compressImage(data.avatarFile);
                const storageRef = ref(storage, `avatars/${authUser.uid}/${fileToUpload.name}`);
                const snapshot = await uploadBytes(storageRef, fileToUpload);
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
             toast({ variant: 'destructive', title: 'No Email Found', description: 'Cannot send password reset without an email address.' });
            return;
        }
        try {
            const authInstance = auth;
            await sendPasswordResetEmail(authInstance, currentUser.email);
            toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for a link to reset your password.' });
        } catch (error) {
            console.error("Error sending password reset email:", error);
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send password reset email. Please try again later.' });
        }
    };
    
    const handleDeleteAccount = async () => {
        const userInstance = auth.currentUser;
        if (!userInstance) return;
        
        try {
            const userDocRef = doc(db, 'users', userInstance.uid);
            await deleteDoc(userDocRef);
            await deleteUser(userInstance);
            toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted.' });
        } catch (error: any) {
            console.error("Error deleting account:", error);
             toast({ variant: 'destructive', title: 'Deletion Failed', description: `Could not delete your account. You may need to sign in again to perform this action. (${error.code})` });
        }
    };

    const handleOpenComments = (post: Post) => {
        setSelectedPostForComments(post);
    };

    const changeView = (view: View, groupId: string | null = null) => {
        setCurrentView(view);
        setActiveGroupId(groupId);
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        if (groupId) {
             url.searchParams.set('groupId', groupId);
        } else {
             url.searchParams.delete('groupId');
        }
        if (view !== 'messages') {
            url.searchParams.delete('conversationId');
        }
        window.history.pushState({}, '', url);
    }
    
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
    
    const handleUnblockUser = async (uid: string) => {
      // Retained placeholder for continued logic
    };