'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import CreatePostCard from './create-post-card';
import PostCard from './post-card';
import SkeletonCard from './skeleton-card';
import { Loader2, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Post, ReactionType } from './post-card';
import type { CurrentUser } from './social-dashboard';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import Link from 'next/link';
import ngeohash from 'ngeohash';
import { compressImage } from '@/lib/image-compression';

interface NewPostMedia {
    file: File;
    url: string;
    type: 'image' | 'video';
}

interface HomeFeedProps {
    currentUser: CurrentUser;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
    onReportPost?: (post: any) => void;
    onMuteUser?: (user: any) => void;
    mutedUids?: Set<string>;
    blockedUids?: Set<string>;
    activeHashtag?: string | null;
    onClearHashtag?: () => void;
}

const getUserLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
        } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
            });
        }
    });
};

export default function HomeFeed({
    currentUser,
    onReact,
    onComment,
    onSavePost,
    onDeletePost,
    userReactions,
    savedPostIds,
    activeHashtag,
    onClearHashtag
}: HomeFeedProps) {
    const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
    const [forYouPosts, setForYouPosts] = useState<Post[]>([]);
    const [feedType, setFeedType] = useState<'foryou' | 'following'>('foryou');
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostMedia, setNewPostMedia] = useState<NewPostMedia | null>(null);
    const [newPostMusic, setNewPostMusic] = useState<{title: string, url: string} | null>(null);
    const [followingUids, setFollowingUids] = useState<string[] | null>(null);

    const calculateScore = useCallback((post: Post) => {
        const reactionsScore = Object.values(post.reactions || {}).reduce((a, b) => a + (b || 0), 0) * 2;
        const commentsScore = (post.comments || 0) * 3;
        
        let hoursSincePosted = 0;
        if (post.timestamp && typeof (post.timestamp as any).toDate === 'function') {
            const msSince = Date.now() - (post.timestamp as any).toDate().getTime();
            hoursSincePosted = msSince / (1000 * 60 * 60);
        }
        
        // Add random jitter to break ties
        const jitter = Math.random() * 0.1;
        return reactionsScore + commentsScore - (hoursSincePosted * 0.5) + jitter;
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        const fetchFollowing = async () => {
            try {
                const followingRef = collection(db, 'users', currentUser.uid, 'following');
                const snapshot = await getDocs(followingRef);
                const uids = snapshot.docs.map(doc => doc.id);
                // Add the current user's UID to the list so they can see their own posts
                setFollowingUids([currentUser.uid, ...uids]);
            } catch (serverError) {
                const permissionError = new FirestorePermissionError({
                    path: `users/${currentUser.uid}/following`,
                    operation: 'list',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
                 setFollowingUids([currentUser.uid]); // Fallback to just seeing their own posts
            }
        };

        fetchFollowing();
    }, [currentUser]);

    const [newPostsAvailableCount, setNewPostsAvailableCount] = useState(0);
    const initialLoadRef = React.useRef(false);

    useEffect(() => {
        if (followingUids === null) {
            setIsLoadingPosts(true);
            return;
        }

        setIsLoadingPosts(true);
        const postsCollection = collection(db, "posts");
        
        // 1. Listen for "Following" Posts (Chronological)
        let followingQuery;
        if (followingUids.length <= 1) {
             followingQuery = query(
                postsCollection,
                where("author.uid", "==", currentUser.uid),
                where('groupId', '==', null),
                orderBy("timestamp", "desc")
            );
        } else {
            followingQuery = query(
                postsCollection, 
                where("author.uid", "in", followingUids.slice(0, 30)),
                where('groupId', '==', null),
                orderBy("timestamp", "desc")
            );
        }
        
        const unsubFollowing = onSnapshot(followingQuery, (querySnapshot) => {
            const postList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setFollowingPosts(postList);
            setIsLoadingPosts(false); // We consider it loaded when following loads
        }, (serverError: any) => {
            console.error("Following listener error:", serverError);
            setIsLoadingPosts(false);
        });

        // 2. Listen for "For You" Posts (Algorithmic)
        const forYouQuery = query(
            postsCollection,
            where('groupId', '==', null), // Only show non-group posts on main feeds
            orderBy("timestamp", "desc"),
            where("timestamp", ">=", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)) // Last 14 days
        );

        const unsubForYou = onSnapshot(forYouQuery, (querySnapshot) => {
            const postList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            const sortedList = postList.sort((a, b) => calculateScore(b) - calculateScore(a));

            if (initialLoadRef.current && postList.length > forYouPosts.length && forYouPosts.length > 0) {
                const diff = postList.length - forYouPosts.length;
                setNewPostsAvailableCount(prev => prev + diff);
            } else {
                initialLoadRef.current = true;
            }

            setForYouPosts(sortedList);
        }, (serverError: any) => {
             console.error("For You listener error:", serverError);
        });

        return () => {
            unsubFollowing();
            unsubForYou();
        };
    }, [followingUids, currentUser.uid, calculateScore, forYouPosts.length]);

    const [hashtagDbPosts, setHashtagDbPosts] = useState<Post[]>([]);
    const [isLoadingHashtag, setIsLoadingHashtag] = useState(false);

    const cleanTag = activeHashtag ? activeHashtag.replace(/^#/, '').toLowerCase() : null;
    const normalizedTag = cleanTag ? `#${cleanTag}` : null;

    useEffect(() => {
        if (!cleanTag) {
            setHashtagDbPosts([]);
            setIsLoadingHashtag(false);
            return;
        }

        setIsLoadingHashtag(true);
        const postsCollection = collection(db, "posts");
        const q = query(
            postsCollection,
            where("searchKeywords", "array-contains", cleanTag),
            orderBy("timestamp", "desc")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setHashtagDbPosts(list);
            setIsLoadingHashtag(false);
        }, (err) => {
            console.warn("Hashtag query fallback to local feed filter:", err);
            setIsLoadingHashtag(false);
        });

        return () => unsub();
    }, [cleanTag]);

    // Local filter fallback to guarantee instantaneous results
    const localHashtagPosts = React.useMemo(() => {
        if (!cleanTag) return [];
        const combined = [...forYouPosts, ...followingPosts];
        const seen = new Set<string>();
        return combined.filter(post => {
            if (seen.has(post.id)) return false;
            seen.add(post.id);
            const inHashtags = post.hashtags?.some(h => h.replace(/^#/, '').toLowerCase() === cleanTag);
            const inKeywords = post.searchKeywords?.some(k => k.replace(/^#/, '').toLowerCase() === cleanTag);
            const inContent = post.content?.toLowerCase().includes(`#${cleanTag}`);
            return inHashtags || inKeywords || inContent;
        });
    }, [cleanTag, forYouPosts, followingPosts]);

    const activeDisplayPosts = React.useMemo(() => {
        if (cleanTag) {
            if (hashtagDbPosts.length > 0) return hashtagDbPosts;
            return localHashtagPosts;
        }
        return feedType === 'foryou' ? forYouPosts : followingPosts;
    }, [cleanTag, hashtagDbPosts, localHashtagPosts, feedType, forYouPosts, followingPosts]);

    const handleCreatePost = async (extraSettings?: any) => {
        if (!currentUser || (!newPostContent.trim() && !newPostMedia)) return;
        setIsCreatingPost(true);

        try {
            let mediaUrl: string | undefined;
            let mediaType: 'image' | 'video' | undefined;
            let geohash: string | undefined;

             try {
                const location = await getUserLocation();
                geohash = ngeohash.encode(location.coords.latitude, location.coords.longitude, 7);
            } catch (locationError) {
                console.warn("Could not get user location:", locationError);
            }

            if (newPostMedia) {
                const fileToUpload = newPostMedia.type === 'image' 
                    ? await compressImage(newPostMedia.file) 
                    : newPostMedia.file;
                
                const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${fileToUpload.name}`);
                const snapshot = await uploadBytes(storageRef, fileToUpload);
                mediaUrl = await getDownloadURL(snapshot.ref);
                mediaType = newPostMedia.type;
            }
            
            const postData: any = {
                author: {
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    uid: currentUser.uid,
                    isProfessional: currentUser.isProfessional || false,
                },
                content: newPostContent,
                reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
                comments: 0,
                timestamp: serverTimestamp(),
                groupId: null, // This is a global post
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                geohash: geohash || null,
                music: newPostMusic || null,
            };
            if(mediaType === 'image' && mediaUrl) postData.imageUrl = mediaUrl;
            if(mediaType === 'video' && mediaUrl) postData.videoUrl = mediaUrl;
            if(geohash) postData.geohash = geohash;

            if (extraSettings?.isVipOnly) {
                postData.isVipOnly = true;
                postData.unlockCoins = extraSettings.unlockCoins || 50;
                postData.unlockedBy = [currentUser.uid];
            }
            if (extraSettings?.isCause) {
                postData.isCause = true;
                postData.causeTitle = extraSettings.causeTitle || 'Community Cause';
                postData.targetCoins = extraSettings.targetCoins || 5000;
                postData.raisedCoins = 0;
            }

            // ── Auto-index for search ─────────────────────────────────────
            // Extract hashtags (#word) from the post content
            const hashtagMatches = newPostContent.match(/#\w+/g) || [];
            const hashtags = hashtagMatches.map((h: string) => h.toLowerCase());

            // Build searchKeywords: tokenize content + author name/handle + hashtags
            const contentTokens = newPostContent.toLowerCase()
                .split(/\s+/)
                .map((t: string) => t.replace(/[^a-z0-9#]/g, ''))
                .filter((t: string) => t.length > 1);
            const authorTokens = [
                currentUser.name.toLowerCase(),
                currentUser.handle.toLowerCase(),
                ...currentUser.name.toLowerCase().split(' '),
            ];
            const searchKeywords = Array.from(new Set([
                ...contentTokens,
                ...authorTokens,
                ...hashtags,
            ])).slice(0, 40); // Firestore array-contains-any limit safety

            postData.hashtags = hashtags;
            postData.searchKeywords = searchKeywords;
            // ─────────────────────────────────────────────────────────────

            const newPostRef = await addDoc(collection(db, 'posts'), postData);
            const completePost = { ...postData, id: newPostRef.id };
            // Optimistically add to top of both feeds
            setFollowingPosts(prev => [completePost, ...prev]);
            setForYouPosts(prev => [completePost, ...prev]);
            setNewPostContent('');
            setNewPostMedia(null);
            setNewPostMusic(null);
            toast({ title: 'Success', description: 'Your post has been published.' });
        } catch (serverError: any) {
            // Check if it's a permission error
            if (serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: 'posts',
                    operation: 'create',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            } else {
                // Handle other errors
                console.error("Error creating post: ", serverError);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not create post. Please try again later.' });
            }
        } finally {
            setIsCreatingPost(false);
        }
    };


    return (
        <main className="col-span-12 md:col-span-8 lg:col-span-6 relative">
            {newPostsAvailableCount > 0 && (
                <button
                    onClick={() => {
                        setNewPostsAvailableCount(0);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-5 py-2.5 rounded-full shadow-2xl transition-all border border-emerald-400/40 flex items-center gap-2 text-sm animate-bounce cursor-pointer"
                >
                    <span>↑ {newPostsAvailableCount} New Post{newPostsAvailableCount > 1 ? 's' : ''} - Tap to view</span>
                </button>
            )}

            <CreatePostCard
                currentUser={currentUser}
                newPostContent={newPostContent}
                setNewPostContent={setNewPostContent}
                newPostMedia={newPostMedia}
                setNewPostMedia={setNewPostMedia}
                newPostMusic={newPostMusic}
                setNewPostMusic={setNewPostMusic}
                handleCreatePost={handleCreatePost}
                isCreatingPost={isCreatingPost}
            />
            
            <div className="space-y-6 mt-6">
                {cleanTag ? (
                    <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl mb-4 backdrop-blur-md shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-xl">
                                #
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-foreground">{normalizedTag}</h2>
                                <p className="text-xs text-muted-foreground">
                                    {activeDisplayPosts.length} {activeDisplayPosts.length === 1 ? 'post' : 'posts'} found
                                </p>
                            </div>
                        </div>
                        {onClearHashtag && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={onClearHashtag}
                                className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                Clear filter ✕
                            </Button>
                        )}
                    </div>
                ) : (
                    <Tabs value={feedType} onValueChange={(v) => setFeedType(v as any)} className="w-full mb-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="foryou" className="font-bold">✨ For You</TabsTrigger>
                            <TabsTrigger value="following" className="font-bold">Following</TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}

                {(isLoadingPosts || (cleanTag && isLoadingHashtag && activeDisplayPosts.length === 0)) ? (
                    <div className="flex flex-col space-y-4">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                ) : activeDisplayPosts.length > 0 ? (
                    <div className="flex flex-col space-y-6">
                        {activeDisplayPosts.map(post => (
                            <PostCard 
                                key={post.id} 
                                post={post}
                                currentUser={currentUser}
                                onReact={(postId, reaction) => onReact(postId, reaction, post.author.uid)} 
                                onCommentClick={onComment} 
                                onSavePost={onSavePost} 
                                onDeletePost={onDeletePost}
                                userReaction={userReactions.get(post.id)} 
                                isSaved={savedPostIds.has(post.id)}
                            />
                        ))}
                    </div>
                ) : cleanTag ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-2xl mx-auto mb-4">
                                #
                            </div>
                            <h3 className="text-xl font-semibold">No posts found with {normalizedTag}</h3>
                            <p className="mt-1">Be the first to share a post with this hashtag!</p>
                            {onClearHashtag && (
                                <Button variant="outline" className="mt-4" onClick={onClearHashtag}>
                                    View All Posts
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">Your Feed is Quiet</h3>
                            <p className="mt-1">Follow people to see their posts here. Start by checking out the Explore page or the suggestions on the right.</p>
                             <Link href="/?view=explore">
                                <Button variant="outline" className="mt-4">
                                    Explore Lonkind
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
