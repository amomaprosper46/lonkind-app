
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
import { searchPosts, type SearchPostsOutput } from '@/ai/flows/search-posts';
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
            await sendPasswordResetEmail(auth, currentUser.email);
            toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for a link to reset your password.' });
        } catch (error) {
            console.error("Error sending password reset email:", error);
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send password reset email. Please try again later.' });
        }
    };
    
    const handleDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user) return;
        
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await deleteDoc(userDocRef);
            await deleteUser(user);
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
    
    const handleUnblockUser = async (uidToUnblock: string) => {
        if (!currentUser) return;
        const blockRef = doc(db, 'users', currentUser.uid, 'blockedUsers', uidToUnblock);
        try {
            await deleteDoc(blockRef);
            toast({ title: 'User Unblocked' });
        } catch (error) {
            console.error("Error unblocking user:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not unblock user.' });
        }
    };

    const renderMainContent = () => {
        if (!currentUser) return <main className="col-span-12 lg:col-span-9 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;

        const mutedUids = new Set(mutedUsers.map(u => u.uid));
        const blockedUids = new Set(blockedUsers.map(u => u.uid));

        switch (currentView) {
            case 'home': return ( <HomeFeed currentUser={currentUser} onReact={handleReact} onComment={handleOpenComments} onSavePost={handleSavePost} onDeletePost={handleDeletePost} userReactions={userReactions} savedPostIds={savedPostIds} onReportPost={handleReportPost} onMuteUser={handleMuteUser} mutedUids={mutedUids} blockedUids={blockedUids} /> );
             case 'explore': return <ExploreView currentUser={currentUser} onReact={handleReact} onComment={handleOpenComments} onSavePost={handleSavePost} onDeletePost={handleDeletePost} userReactions={userReactions} savedPostIds={savedPostIds} onReportPost={handleReportPost} onMuteUser={handleMuteUser} mutedUids={mutedUids} blockedUids={blockedUids} />;
            case 'groups': return <GroupsView currentUser={currentUser} onGroupSelect={(groupId) => changeView('group-details', groupId)} />;
            case 'group-details': return activeGroupId ? <GroupDetailsView groupId={activeGroupId} currentUser={currentUser} onReact={handleReact} onComment={handleOpenComments} onSavePost={handleSavePost} onDeletePost={handleDeletePost} userReactions={userReactions} savedPostIds={savedPostIds} /> : <LoadingComponent />;
            case 'spaces': return <SpacesView currentUser={currentUser} />;
            case 'nearby': return <NearbyView currentUser={currentUser} onReact={handleReact} onComment={handleOpenComments} onSavePost={handleSavePost} onDeletePost={handleDeletePost} userReactions={userReactions} savedPostIds={savedPostIds} />;
            case 'messages': return ( <Suspense fallback={<LoadingComponent />}><MessagingView currentUser={currentUser} initialConversationId={initialConversationId} /></Suspense> );
            case 'saved': return <SavedView currentUser={currentUser} onReact={handleReact} onComment={handleOpenComments} onSavePost={handleSavePost} onDeletePost={handleDeletePost} userReactions={userReactions} savedPostIds={savedPostIds} />;
            case 'videos': return <VideosView currentUser={currentUser} onReact={handleReact} onComment={handleOpenComments} onSavePost={handleSavePost} onDeletePost={handleDeletePost} userReactions={userReactions} savedPostIds={savedPostIds} />;
            case 'settings': return ( <SettingsView user={currentUser} onSignOut={onSignOut} onUpdateProfile={handleUpdateProfile} onPasswordReset={handlePasswordReset} onDeleteAccount={handleDeleteAccount} blockedUsers={blockedUsers} onUnblockUser={handleUnblockUser} /> );
            case 'wallet': return <WalletView currentUser={currentUser} />;
            case 'leaderboard': return <LeaderboardView />;
            case 'admin': return currentUser.email === 'amomaprosper46@gmail.com' ? <AdminDashboardView /> : <main className="col-span-12 lg:col-span-9 p-8 text-center text-destructive font-bold">Unauthorized</main>;
            case 'ai-command-center': return <AICommandCenterView isProfessional={currentUser.isProfessional} />;
            case 'story-writer': return <main className="col-span-12 lg:col-span-9"><StoryGeneratorView /></main>;
            case 'personal-ai': return <main className="col-span-12 lg:col-span-9"><PersonalAiView /></main>;
            default: return <main className="col-span-12 lg:col-span-9">Select a view</main>;
        }
    };
    
    const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);

    const fetchSuggestedUsers = useCallback(async () => {
        if (!currentUser?.uid) return;
    
        const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
        const friendsSnap = await getDocs(friendsRef);
        const friendIds = new Set(friendsSnap.docs.map(d => d.id));
        friendIds.add(currentUser.uid);
    
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(20));
        
        const allUsersSnapshot = await getDocs(q);
        const allUsers = allUsersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SuggestedUser));
        
        const suggestions = allUsers.filter(u => !friendIds.has(u.uid));
    
        setSuggestedUsers(suggestions.slice(0, 5));
    }, [currentUser?.uid]);
    
    useEffect(() => {
        if(currentView === 'home' && currentUser) {
            fetchSuggestedUsers();
        }
    }, [fetchSuggestedUsers, currentView, currentUser]);

    const getNotificationLink = (notif: Notification) => {
        switch (notif.type) {
            case 'friend_request':
            case 'friend_request_accepted':
            case 'new_follower':
                return `/profile/${notif.fromUser.handle}`;
            case 'new_reaction':
            case 'new_comment':
                return `/profile/${notif.postAuthorHandle}`; 
            case 'new_message':
                return `/?view=messages&conversationId=${notif.conversationId}`;
            case 'group_post':
                return `/?view=group-details&groupId=${notif.groupId}`;
            default:
                return '#';
        }
    }

    const renderNotificationText = (notif: Notification) => {
        const from = <span className="font-semibold">{notif.fromUser.name}</span>;
        switch (notif.type) {
            case 'new_reaction': return <>{from} reacted to your post.</>;
            case 'new_comment': return <>{from} commented on your post.</>;
            case 'friend_request': return <>{from} sent you a friend request.</>;
            case 'new_follower': return <>{from} started following you.</>;
            case 'friend_request_accepted': return <>{from} accepted your friend request.</>;
            case 'new_message': return <>{from} sent you a message.</>;
            case 'group_post': return <>{from} posted in <strong>{notif.groupName}</strong>.</>;
            default: return 'New notification';
        }
    }

     const handleMarkNotificationsRead = async () => {
        if (!currentUser || unreadNotifications === 0) return;
        const notifsRef = collection(db, 'users', currentUser.uid, 'notifications');
        const unreadQuery = query(notifsRef, where('read', '==', false));
        
        try {
            const snapshot = await getDocs(unreadQuery);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
            await batch.commit();
        } catch (error) {
            console.error("Error marking notifications as read:", error);
        }
    };
    
    if (!currentUser) {
        return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-secondary">
                <header className="sticky top-0 z-40 w-full border-b bg-background">
                    <div className="container flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2" onClick={() => changeView('home')}>
                        <Image src="/logo.png" alt="Lonkind Logo" width={32} height={32} />
                        <span className="text-xl font-bold hidden sm:inline-block">Lonkind</span>
                    </Link>
                    <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md" ref={searchContainerRef}>
                        <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="Search Lonkind" className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setIsSearchFocused(true)} />
                        {isSearchFocused && searchQuery && (
                            <Card className="absolute top-full mt-2 w-full shadow-lg z-50 max-h-[60vh] overflow-y-auto">
                                <CardContent className="p-2">
                                    {isSearchLoading ? ( <div className="flex items-center justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div> ) : (
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
                         <div className="hidden lg:flex">
                             <Tooltip><TooltipTrigger asChild><Button variant={currentView === 'home' ? 'secondary' : 'ghost'} size="icon" onClick={() => changeView('home')}><Home className="h-6 w-6" /></Button></TooltipTrigger><TooltipContent><p>Home</p></TooltipContent></Tooltip>
                             <Tooltip><TooltipTrigger asChild><Button variant={currentView === 'explore' ? 'secondary' : 'ghost'} size="icon" onClick={() => changeView('explore')}><Compass className="h-6 w-6" /></Button></TooltipTrigger><TooltipContent><p>Explore</p></TooltipContent></Tooltip>
                             <Tooltip><TooltipTrigger asChild><Button variant={currentView === 'messages' ? 'secondary' : 'ghost'} size="icon" onClick={() => changeView('messages')}><MessageSquare className="h-6 w-6" /></Button></TooltipTrigger><TooltipContent><p>Messages</p></TooltipContent></Tooltip>
                         </div>
                        
                        {isClient && <Popover onOpenChange={(open) => { if(open) handleMarkNotificationsRead() } }>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-6 w-6" />
                                    {unreadNotifications > 0 && ( <span className="absolute top-0 right-0 h-4 w-4 text-xs font-bold text-white bg-red-500 rounded-full flex items-center justify-center">{unreadNotifications}</span> )}
                                    <span className="sr-only">Notifications</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0">
                               <Card>
                                 <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
                                 <CardContent className="max-h-[400px] overflow-y-auto">
                                   {notifications.length > 0 ? (
                                        notifications.map(notif => (
                                            <Link href={getNotificationLink(notif)} key={notif.id} className="block">
                                                <div className={cn("flex flex-col gap-2 p-3 border-b last:border-b-0 hover:bg-accent/50", !notif.read && "bg-blue-500/10")}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="text-primary mt-1">
                                                            {notif.type === 'friend_request' && <UserPlus className="h-6 w-6" />}
                                                            {notif.type === 'friend_request_accepted' && <UserCheck className="h-6 w-6" />}
                                                            {notif.type === 'new_follower' && <Heart className="h-6 w-6" />}
                                                            {notif.type === 'new_reaction' && <Heart className="h-6 w-6" />}
                                                            {notif.type === 'new_comment' && <MessageSquare className="h-6 w-6" />}
                                                            {notif.type === 'new_message' && <MessageSquare className="h-6 w-6" />}
                                                            {notif.type === 'group_post' && <Users className="h-6 w-6" />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <Avatar className="inline-block h-8 w-8 mr-2"><AvatarImage src={notif.fromUser.avatarUrl} alt={notif.fromUser.name} data-ai-hint="user avatar" /><AvatarFallback>{notif.fromUser.name.charAt(0)}</AvatarFallback></Avatar>
                                                            {renderNotificationText(notif)}
                                                            <p className="text-xs text-muted-foreground mt-1">{notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate()) : '...'} ago</p>
                                                            {notif.type === 'friend_request' && (
                                                                <Button size="sm" className="mt-2" onClick={(e) => handleAcceptFriendRequest(notif, e)}>
                                                                    Accept Request
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                   ) : ( <p className="text-center text-muted-foreground p-4">No new notifications.</p> )}
                                 </CardContent>
                               </Card>
                            </PopoverContent>
                        </Popover>}
                        <Popover>
                             <PopoverTrigger asChild>
                                 <Button variant="ghost" size="icon"><Avatar className="h-8 w-8"><AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} /><AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback></Avatar></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2">
                                <Link href={`/profile/${currentUser.handle}`}><Button asChild variant='ghost' className="w-full justify-start"><span><User className="mr-2 h-4 w-4" />My Profile</span></Button></Link>
                                <Button variant='ghost' className="w-full justify-start" onClick={() => changeView('wallet')}><Wallet className="mr-2 h-4 w-4" />My Wallet</Button>
                                <Button variant='ghost' className="w-full justify-start" onClick={() => changeView('saved')}><Bookmark className="mr-2 h-4 w-4" />Saved</Button>
                                <Button variant='ghost' className="w-full justify-start" onClick={() => changeView('settings')}><Cog className="mr-2 h-4 w-4" />Settings</Button>
                                <Button variant='ghost' className="w-full justify-start" onClick={onSignOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
                            </PopoverContent>
                        </Popover>
                    </div>
                    </div>
                </header>
                
                <div className="container grid grid-cols-12 gap-8 py-8 pb-24 lg:pb-8">
                    <aside className="hidden lg:block lg:col-span-3">
                         <Card>
                            <CardContent className="p-2">
                                <nav className="flex flex-col gap-1">
                                    <Button variant={currentView === 'home' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('home')}><Home className="h-5 w-5" /> Home</Button>
                                    <Button variant={currentView === 'explore' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('explore')}><Compass className="h-5 w-5" /> Explore</Button>
                                    <Button variant={currentView === 'groups' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('groups')}><Users className="h-5 w-5" /> Groups</Button>
                                    <Button variant={currentView === 'spaces' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('spaces')}><Radio className="h-5 w-5" /> Spaces</Button>
                                    <Button variant={currentView === 'videos' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('videos')}><Video className="h-5 w-5" /> Videos</Button>
                                    <Button variant={currentView === 'leaderboard' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('leaderboard')}><Trophy className="h-5 w-5" /> Leaderboard</Button>
                                    <Button variant={currentView === 'wallet' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('wallet')}><Wallet className="h-5 w-5" /> Wallet</Button>
                                    <Link href={`/profile/${currentUser.handle}`} className="w-full"><Button variant='ghost' className="w-full justify-start gap-2"><User className="h-5 w-5" /> My Profile</Button></Link>
                                    <Button variant={currentView === 'ai-command-center' ? 'secondary' : 'ghost'} className="justify-start gap-2" onClick={() => changeView('ai-command-center')}><Sparkles className="h-5 w-5" /> AI Command Center</Button>
                                    {currentUser.email === 'amomaprosper46@gmail.com' && (
                                        <Button variant={currentView === 'admin' ? 'secondary' : 'ghost'} className="justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => changeView('admin')}>
                                            <ShieldAlert className="h-5 w-5" /> Admin Panel
                                        </Button>
                                    )}
                                </nav>
                            </CardContent>
                        </Card>
                    </aside>
        
                    {isClient ? <Suspense fallback={<LoadingComponent />}>{renderMainContent()}</Suspense> : <LoadingComponent />}
                    
                    {currentView === 'home' && isClient && (
                        <aside className="hidden md:block md:col-span-4 lg:col-span-3">
                            <Card>
                                <CardHeader><CardTitle>Suggested Friends</CardTitle></CardHeader>
                                <CardContent>
                                <div className="space-y-4">
                                    {suggestedUsers.length > 0 ? (
                                        suggestedUsers.map(suggestedUser => (
                                            <div key={suggestedUser.uid} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={suggestedUser.avatarUrl || `https://placehold.co/100x100.png?text=${(suggestedUser.name || 'U').charAt(0)}`} data-ai-hint="user avatar" />
                                                        <AvatarFallback>{(suggestedUser.name || 'U').charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <Link href={`/profile/${suggestedUser.handle}`} className="font-semibold hover:underline">{suggestedUser.name || 'Unknown User'}</Link>
                                                        <p className="text-muted-foreground text-sm">@{suggestedUser.handle || 'unknown'}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant='outline' onClick={() => handleAddFriend(suggestedUser)} disabled={sentFriendRequests.has(suggestedUser.uid)}>
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                    {sentFriendRequests.has(suggestedUser.uid) ? 'Sent' : 'Add'}
                                                </Button>
                                            </div>
                                        ))
                                    ) : ( <p className="text-sm text-muted-foreground text-center py-4">No new suggestions right now. Check back later!</p> )}
                                </div>
                                </CardContent>
                            </Card>
                        </aside>
                    )}
                </div>
                
                 {isClient && currentUser && <Suspense>
                    <CommentSheet 
                        post={selectedPostForComments}
                        onOpenChange={(isOpen) => { if (!isOpen) setSelectedPostForComments(null); }}
                        onCommentSubmit={(postId, commentText) => handleComment(postId, commentText)}
                        currentUser={currentUser}
                    />
                </Suspense>}
                
                 {isClient && currentUser && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-1 lg:hidden">
                        <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
                            <Button variant={currentView === 'home' ? 'secondary' : 'ghost'} className="flex h-auto flex-col gap-1 rounded-md p-2" onClick={() => changeView('home')}>
                                <Home className="h-5 w-5" />
                                <span className="text-xs">Home</span>
                            </Button>
                            <Button variant={currentView === 'explore' ? 'secondary' : 'ghost'} className="flex h-auto flex-col gap-1 rounded-md p-2" onClick={() => changeView('explore')}>
                                <Compass className="h-5 w-5" />
                                <span className="text-xs">Explore</span>
                            </Button>
                            <Button variant={currentView === 'wallet' ? 'secondary' : 'ghost'} className="flex h-auto flex-col gap-1 rounded-md p-2" onClick={() => changeView('wallet')}>
                                <Wallet className="h-5 w-5" />
                                <span className="text-xs">Wallet</span>
                            </Button>
                            <Button variant={currentView === 'ai-command-center' ? 'secondary' : 'ghost'} className="flex h-auto flex-col gap-1 rounded-md p-2" onClick={() => changeView('ai-command-center')}>
                                <Sparkles className="h-5 w-5" />
                                <span className="text-xs">AI</span>
                            </Button>
                            <Link href={`/profile/${currentUser.handle}`} className="flex h-auto flex-col items-center justify-center gap-1 rounded-md p-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                                <User className="h-5 w-5" />
                                <span className="text-xs">Profile</span>
                            </Link>
                        </div>
                    </div>
                )}
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
