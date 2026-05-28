
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import CreatePostCard from './create-post-card';
import PostCard from './post-card';
import { Loader2, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Post, ReactionType } from './post-card';
import type { CurrentUser } from './social-dashboard';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import ngeohash from 'ngeohash';
import PostCardSkeleton from './post-card-skeleton';

const POSTS_PER_PAGE = 5;

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
    onReportPost: (post: Post) => void;
    onMuteUser: (user: Post['author']) => void;
    mutedUids: Set<string>;
    blockedUids: Set<string>;
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
    onReportPost,
    onMuteUser,
    mutedUids,
    blockedUids,
}: HomeFeedProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostMedia, setNewPostMedia] = useState<NewPostMedia | null>(null);
    const [friendUids, setFriendUids] = useState<string[] | null>(null);

    const [lastPost, setLastPost] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    useEffect(() => {
        if (!currentUser?.uid) return;
    
        const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
        const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
            const uids = snapshot.docs.map(doc => doc.id);
            setFriendUids([currentUser.uid, ...uids]);
        }, (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: `users/${currentUser.uid}/friends`,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            setFriendUids([currentUser.uid]);
        });
    
        return () => unsubscribe();
    }, [currentUser.uid]);

    const fetchPosts = useCallback(async (initialFetch = false) => {
        if (friendUids === null) return;
        
        if (initialFetch) {
            setIsLoadingPosts(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const postsCollection = collection(db, "posts");
            let q;
            const useExploreFeed = friendUids.length <= 1;

            if (useExploreFeed) {
                q = query(postsCollection, where('groupId', '==', null), orderBy("engagementScore", "desc"), limit(POSTS_PER_PAGE));
            } else {
                q = query(
                    postsCollection, 
                    where("author.uid", "in", friendUids.slice(0, 30)),
                    where('groupId', '==', null),
                    orderBy("timestamp", "desc"),
                    limit(POSTS_PER_PAGE)
                );
            }

            if (!initialFetch && lastPost) {
                q = query(q, startAfter(lastPost));
            }

            const querySnapshot = await getDocs(q);
            const postList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            const filteredPosts = postList.filter(post => !mutedUids.has(post.author.uid) && !blockedUids.has(post.author.uid));

            setHasMore(postList.length === POSTS_PER_PAGE);
            setLastPost(querySnapshot.docs[querySnapshot.docs.length - 1] || null);

            if (initialFetch) {
                setPosts(filteredPosts);
            } else {
                setPosts(prev => [...prev, ...filteredPosts]);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
            if ((error as any)?.code === 'permission-denied') {
                 const permissionError = new FirestorePermissionError({
                    path: 'posts',
                    operation: 'list',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            }
        } finally {
            setIsLoadingPosts(false);
            setIsLoadingMore(false);
        }
    }, [friendUids, lastPost, mutedUids, blockedUids]);

    useEffect(() => {
        if (friendUids !== null) {
            fetchPosts(true);
        }
    }, [friendUids, mutedUids, blockedUids]);

    const handleCreatePost = async () => {
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
                const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${newPostMedia.file.name}`);
                const snapshot = await uploadBytes(storageRef, newPostMedia.file);
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
                groupId: null,
                engagementScore: 0,
            };
            if(mediaType === 'image' && mediaUrl) postData.imageUrl = mediaUrl;
            if(mediaType === 'video' && mediaUrl) postData.videoUrl = mediaUrl;
            if(geohash) postData.geohash = geohash;


            const newPostRef = await addDoc(collection(db, 'posts'), postData);
            const newPost = { id: newPostRef.id, ...postData, timestamp: new Date() } as Post;
            
            setPosts(prev => [newPost, ...prev]);
            setNewPostContent('');
            setNewPostMedia(null);
            toast({ title: 'Post created!', description: 'Your post is now live.' });

        } catch (e) {
            if ((e as any).code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: 'posts',
                    operation: 'create',
                    requestResourceData: {}, // Can't easily pass postData here
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            } else {
                 console.error("Error during post creation: ", e);
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not create post. Please try again.' });
            }
        } finally {
            setIsCreatingPost(false);
        }
    };


    return (
        <main className="col-span-12 md:col-span-8 lg:col-span-6">
            <CreatePostCard
                currentUser={currentUser}
                newPostContent={newPostContent}
                setNewPostContent={setNewPostContent}
                newPostMedia={newPostMedia}
                setNewPostMedia={setNewPostMedia}
                handleCreatePost={handleCreatePost}
                isCreatingPost={isCreatingPost}
            />
            
            <div className="space-y-6 mt-8">
                {isLoadingPosts ? (
                    <>
                        {[...Array(3)].map((_, i) => <PostCardSkeleton key={i} />)}
                    </>
                ) : posts.length > 0 ? (
                    posts.map(post => (
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
                            onReportPost={onReportPost}
                            onMuteUser={onMuteUser}
                        />
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">Your Feed is Quiet</h3>
                            <p className="mt-1">Add friends to see their posts here. Start by checking out the Trending page or friend suggestions.</p>
                             <Link href="/?view=explore">
                                <Button variant="outline" className="mt-4">
                                    See What's Trending
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {hasMore && !isLoadingPosts && (
                    <div className="flex justify-center">
                        <Button onClick={() => fetchPosts(false)} disabled={isLoadingMore}>
                            {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Load More'}
                        </Button>
                    </div>
                )}
            </div>
        </main>
    );
}
