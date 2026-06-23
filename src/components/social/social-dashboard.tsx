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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import dynamic from 'next/dynamic';
import PersonalAiView from './personal-ai-view';
import AICommandCenterView from './ai-command-center-view';
import StoryGeneratorView from './story-generator-view';
import type { ProfileData } from './edit-profile-dialog';
import HomeFeed from './home-feed';

import { DockedChatProvider, useDockedChat } from './docked-chat-context';
import DockedChatContainer from './docked-chat-container';

// ✅ Decoupled Import Architecture
import { searchPosts } from '@/ai/flows/search-posts';
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

// Sub-Module: Clean Navigation Sidebar Button Binding Interface
interface NavigationItemProps {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onClick: () => void;
    badgeCount?: number;
}
function NavigationItem({ label, icon: Icon, active, onClick, badgeCount }: NavigationItemProps) {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className={cn(
                "w-full justify-start gap-3.5 h-10 px-3 rounded-xl font-medium text-sm transition-all relative group",
                active 
                    ? "bg-indigo-600 hover:bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent hover:border-border/40"
            )}
        >
            <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-105 duration-200", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
            <span className="truncate">{label}</span>
            {badgeCount !== undefined && badgeCount > 0 && (
                <span className="absolute right-3 top-2.5 bg-indigo-500 text-white text-[10px] font-bold h-5 px-1.5 rounded-full flex items-center justify-center min-w-[20px] shadow-sm">
                    {badgeCount}
                </span>
            )}
        </Button>
    );
}

// Sub-Module: Clean Isolation wrapper for popover layout components dropdown fields
function DropdownMenuWrapper({ currentUser, onSignOut, changeView }: { currentUser: CurrentUser | null; onSignOut: () => void; changeView: (view: View) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-xl p-0 overflow-hidden border border-slate-800 hover:border-slate-700 transition-all">
                    <Avatar className="h-full w-full rounded-none">
                        {/* ✅ Total strict fallback chaining to safely handle initial loading state values */}
                        <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name || 'User'} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground font-medium text-xs rounded-none">{currentUser?.name ? currentUser.name.charAt(0) : 'U'}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-popover border-border text-popover-foreground p-1.5 rounded-xl shadow-2xl z-50" align="end">
                <DropdownMenuLabel className="px-2.5 py-2 flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">{currentUser?.name || 'Loading profile...'}</span>
                    <span className="text-xs text-slate-500 truncate">@{currentUser?.handle || 'user'}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800/60" />
                <DropdownMenuItem onClick={() => changeView('settings')} className="gap-2 px-2.5 py-2 text-xs rounded-lg cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white transition-colors">
                    <User className="h-3.5 w-3.5" /> Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeView('wallet')} className="gap-2 px-2.5 py-2 text-xs rounded-lg cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white transition-colors">
                    <Wallet className="h-3.5 w-3.5" /> Creator Earnings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800/60" />
                <DropdownMenuItem onClick={onSignOut} className="gap-2 px-2.5 py-2 text-xs rounded-lg cursor-pointer text-rose-400 focus:bg-rose-950/40 focus:text-rose-300 transition-colors">
                    <LogOut className="h-3.5 w-3.5" /> Log Out Account
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
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
        }, (error) => {
            console.error("onSnapshot Error:", error);
            toast({ variant: 'destructive', title: 'Database Error', description: error.message });
            // Fallback so it stops spinning
            setCurrentUser({
                name: user.displayName || 'Anonymous',
                avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=Err`,
                handle: 'error_user',
                uid: user.uid,
                email: user.email || '',
                isProfessional: false,
            });
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

    const { openChat } = useDockedChat();

    if (!currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // Main Layout Skeleton Return
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
            {/* Navigation Header */}
            <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
                <div className="container max-w-7xl mx-auto h-16 flex items-center justify-between px-4 gap-4">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                                <Sparkles className="h-4 w-4 text-white animate-pulse" />
                            </div>
                            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">Lonkind</span>
                        </Link>
                    </div>

                    {/* Global OmniSearch Bar */}
                    <div ref={searchContainerRef} className="hidden md:flex relative flex-1 max-w-md mx-6">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search accounts or posts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            className="w-full bg-secondary/60 border-border text-foreground placeholder:text-muted-foreground pl-9 pr-4 rounded-xl focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 h-9 transition-all"
                        />
                        {isSearchFocused && (searchQuery.trim() !== '' || isSearchLoading) && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl p-2 z-50 max-h-[400px] overflow-y-auto backdrop-blur-xl">
                                {isSearchLoading ? (
                                    <div className="flex items-center justify-center py-6 text-sm text-slate-400 gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Searching...
                                    </div>
                                ) : (
                                    <>
                                        {userSearchResults.length === 0 && postSearchResults.length === 0 && (
                                            <div className="text-center py-6 text-sm text-slate-500">No results found for "{searchQuery}"</div>
                                        )}
                                        {userSearchResults.length > 0 && (
                                            <div className="mb-3">
                                                <div className="text-xs font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">Profiles</div>
                                                {userSearchResults.map(u => (
                                                    <div key={u.uid} onClick={() => { setIsSearchFocused(false); setSearchQuery(''); changeView('profile'); }} className="flex items-center gap-3 p-2 hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors">
                                                        <Avatar className="h-8 w-8 border border-slate-700">
                                                            <AvatarImage src={u.avatarUrl} alt={u.name} />
                                                            <AvatarFallback className="bg-slate-800 text-slate-300 text-xs">{u.name ? u.name.charAt(0) : 'U'}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-medium text-slate-200 truncate">{u.name}</span>
                                                            <span className="text-xs text-slate-500 truncate">@{u.handle}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {postSearchResults.length > 0 && (
                                            <div>
                                                <div className="text-xs font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">Posts</div>
                                                {postSearchResults.map(p => (
                                                    <div key={p.id} onClick={() => { setIsSearchFocused(false); setSearchQuery(''); changeView('home'); }} className="p-2 hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors border-b border-slate-800/40 last:border-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-medium text-slate-300 truncate">{p.author?.name || 'Anonymous'}</span>
                                                            <span className="text-[10px] text-slate-500">@{p.author?.handle || 'user'}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 line-clamp-2">{p.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Nav Actions */}
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-accent border border-transparent hover:border-border/60 text-muted-foreground hover:text-foreground transition-all">
                                    <Bell className="h-4 w-4" />
                                    {unreadNotifications > 0 && (
                                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 bg-popover border-border text-popover-foreground p-2 shadow-2xl rounded-xl z-50" align="end">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 mb-1">
                                    <span className="font-semibold text-sm">Notifications</span>
                                    {unreadNotifications > 0 && <span className="text-xs text-indigo-400 font-medium">{unreadNotifications} unread</span>}
                                </div>
                                <div className="max-h-[320px] overflow-y-auto space-y-1">
                                    {notifications.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-slate-500">All quiet for now</div>
                                    ) : (
                                        notifications.map(n => (
                                            <div key={n.id} className={cn("flex gap-3 p-2.5 rounded-lg text-xs transition-colors", !n.read ? "bg-indigo-950/30 border border-indigo-900/30" : "hover:bg-slate-800/40")}>
                                                <Avatar className="h-7 w-7 border border-slate-800 shrink-0">
                                                    <AvatarImage src={n.fromUser?.avatarUrl} />
                                                    <AvatarFallback>{n.fromUser?.name ? n.fromUser.name.charAt(0) : 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <p className="text-slate-300 leading-normal">
                                                        <span className="font-semibold text-slate-100">{n.fromUser?.name || 'Someone'}</span>{' '}
                                                        {n.type === 'friend_request' && 'sent you a friend request.'}
                                                        {n.type === 'friend_request_accepted' && 'accepted your friend request! 🎉'}
                                                        {n.type === 'new_reaction' && `reacted to your post.`}
                                                        {n.type === 'new_comment' && `commented: "${n.commentText}"`}
                                                    </p>
                                                    {n.type === 'friend_request' && (
                                                        <div className="flex gap-2 pt-1">
                                                            <Button size="sm" onClick={(e) => handleAcceptFriendRequest(n, e)} className="h-6 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-[11px] font-medium rounded-md shadow-sm">Accept</Button>
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-slate-500 block">{n.timestamp ? formatDistanceToNow(n.timestamp.toDate(), { addSuffix: true }) : 'Just now'}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <DropdownMenuWrapper currentUser={currentUser} onSignOut={onSignOut} changeView={changeView} />
                    </div>
                </div>
            </header>

            {/* Dashboard Core Body Space Layout wrapper */}
            <div className="flex-1 container max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-6 items-start">
                {/* Left Side Navigation Panel */}
                <aside className="col-span-12 md:col-span-3 space-y-2 md:sticky md:top-24">
                    <NavigationItem label="Home Feed" icon={Home} active={currentView === 'home'} onClick={() => changeView('home')} />
                    <NavigationItem label="Explore" icon={Compass} active={currentView === 'explore'} onClick={() => changeView('explore')} />
                    <NavigationItem label="Channels & Groups" icon={Users} active={currentView === 'groups'} onClick={() => changeView('groups')} />
                    <NavigationItem label="Direct Messages" icon={MessageSquare} active={currentView === 'messages'} onClick={() => changeView('messages')} badgeCount={0} />
                    <NavigationItem label="Short Videos" icon={Video} active={currentView === 'videos'} onClick={() => changeView('videos')} />
                    <NavigationItem label="Saved Content" icon={Bookmark} active={currentView === 'saved'} onClick={() => changeView('saved')} />
                    
                    <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Ecosystem</div>
                    <NavigationItem label="AI Command Center" icon={Wand2} active={currentView === 'ai-command-center'} onClick={() => changeView('ai-command-center')} />
                    <NavigationItem label="Personal AI Clone" icon={BrainCircuit} active={currentView === 'personal-ai'} onClick={() => changeView('personal-ai')} />
                    <NavigationItem label="Automated Storyteller" icon={Lightbulb} active={currentView === 'story-writer'} onClick={() => changeView('story-writer')} />

                    <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Finance & Tools</div>
                    <NavigationItem label="Creator Wallet" icon={Wallet} active={currentView === 'wallet'} onClick={() => changeView('wallet')} />
                    <NavigationItem label="Leaderboard" icon={Trophy} active={currentView === 'leaderboard'} onClick={() => changeView('leaderboard')} />
                    <NavigationItem label="Settings" icon={Cog} active={currentView === 'settings'} onClick={() => changeView('settings')} />
                    
                    {currentUser?.email === 'admin@lonkind.com' && (
                        <>
                            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-rose-500 uppercase tracking-wider">Administration</div>
                            <NavigationItem label="System Dashboard" icon={ShieldAlert} active={currentView === 'admin'} onClick={() => changeView('admin')} />
                        </>
                    )}
                </aside>

                {/* Center Rendered View Matrix Switchboard */}
                <main className="col-span-12 md:col-span-9 lg:col-span-6 space-y-6">
                    <Suspense fallback={<LoadingComponent />}>
                        {currentView === 'home' && isClient && (
                            <HomeFeed 
                                currentUser={currentUser} 
                                userReactions={userReactions}
                                savedPostIds={savedPostIds}
                                handleReact={handleReact}
                                handleSavePost={handleSavePost}
                                handleComment={handleComment}
                                handleOpenComments={handleOpenComments}
                                handleDeletePost={handleDeletePost}
                                handleReportPost={handleReportPost}
                                handleMuteUser={handleMuteUser}
                                handleAddFriend={handleAddFriend}
                                sentFriendRequests={sentFriendRequests}
                            />
                        )}
                        {currentView === 'explore' && (
                            <ExploreView 
                                currentUser={currentUser}
                                userReactions={userReactions}
                                savedPostIds={savedPostIds}
                                onReact={handleReact}
                                onComment={handleComment}
                                onSavePost={handleSavePost}
                                onDeletePost={handleDeletePost}
                            />
                        )}
                        {currentView === 'groups' && <GroupsView currentUser={currentUser} onSelectGroup={(id) => changeView('group-details', id)} />}
                        {currentView === 'group-details' && activeGroupId && (
                            <GroupDetailsView 
                                groupId={activeGroupId} 
                                onBack={() => changeView('groups')} 
                                currentUser={currentUser}
                                userReactions={userReactions}
                                savedPostIds={savedPostIds}
                                onReact={handleReact}
                                onComment={handleComment}
                                onSavePost={handleSavePost}
                                onDeletePost={handleDeletePost}
                            />
                        )}
                        {currentView === 'messages' && <MessagingView initialConversationId={initialConversationId} />}
                        {currentView === 'videos' && (
                            <VideosView 
                                currentUser={currentUser}
                                userReactions={userReactions}
                                savedPostIds={savedPostIds}
                                onReact={handleReact}
                                onComment={handleComment}
                                onSavePost={handleSavePost}
                                onDeletePost={handleDeletePost}
                            />
                        )}
                        {currentView === 'saved' && (
                            <SavedView 
                                currentUser={currentUser} 
                                userReactions={userReactions}
                                savedPostIds={savedPostIds}
                                handleReact={handleReact}
                                handleSavePost={handleSavePost}
                                handleComment={handleComment}
                                handleOpenComments={handleOpenComments}
                                handleDeletePost={handleDeletePost}
                                handleReportPost={handleReportPost}
                                handleMuteUser={handleMuteUser}
                            />
                        )}
                        {currentView === 'ai-command-center' && <AICommandCenterView currentUser={currentUser} />}
                        {currentView === 'personal-ai' && <PersonalAiView />}
                        {currentView === 'story-writer' && <StoryGeneratorView currentUser={currentUser} />}
                        {currentView === 'wallet' && <WalletView currentUser={currentUser} />}
                        {currentView === 'leaderboard' && <LeaderboardView />}
                        {currentView === 'settings' && (
                            <SettingsView 
                                user={currentUser!} 
                                onSignOut={onSignOut}
                                onUpdateProfile={handleUpdateProfile} 
                                onPasswordReset={handlePasswordReset}
                                onDeleteAccount={handleDeleteAccount}
                            />
                        )}
                        {currentView === 'admin' && currentUser?.email === 'admin@lonkind.com' && <AdminDashboardView />}
                    </Suspense>
                </main>

                {/* Right Side Contacts & Activity Panel */}
                <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24">
                    <div className="flex items-center justify-between px-2 text-slate-500 border-b border-border/40 pb-2">
                        <h3 className="font-semibold text-sm">Contacts</h3>
                    </div>
                    <div className="space-y-2 mt-2">
                        {/* Mock Contacts List */}
                        {[
                            { id: 'mock-1', name: 'Sarah Jenkins', avatar: 'https://i.pravatar.cc/150?u=sarah', online: true },
                            { id: 'mock-2', name: 'Michael Chen', avatar: 'https://i.pravatar.cc/150?u=michael', online: true },
                            { id: 'mock-3', name: 'Emma Watson', avatar: 'https://i.pravatar.cc/150?u=emma', online: false },
                            { id: 'mock-4', name: 'David Smith', avatar: 'https://i.pravatar.cc/150?u=david', online: true },
                        ].map((contact, i) => (
                            <div key={i} onClick={() => openChat(contact)} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                                <div className="relative">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={contact.avatar} alt={contact.name} />
                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    {contact.online && (
                                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background ring-1 ring-green-600/50" />
                                    )}
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-foreground transition-colors">{contact.name}</span>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between px-2 text-slate-500 border-b border-border/40 pb-2">
                        <h3 className="font-semibold text-sm">Group Conversations</h3>
                    </div>
                </aside>
            </div>

            {/* Micro-Overlay Global Drawer Shell for Post Discussions Comments sheet thread views */}
            {selectedPostForComments && (
                <CommentSheet
                    post={selectedPostForComments}
                    isOpen={!!selectedPostForComments}
                    onClose={() => setSelectedPostForComments(null)}
                    onAddComment={handleComment}
                />
            )}
        </div>
    );
}



// Root Wrapper to Safely Mount useSearchParams Hook Constraints
export default function SocialDashboard(props: SocialDashboardProps) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
            <DockedChatProvider>
                <SocialDashboardInternal {...props} />
                <DockedChatContainer />
            </DockedChatProvider>
        </Suspense>
    );
}