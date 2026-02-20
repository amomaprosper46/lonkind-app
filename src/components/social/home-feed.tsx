
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
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
    savedPostIds
}: HomeFeedProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostMedia, setNewPostMedia] = useState<NewPostMedia | null>(null);
    const [followingUids, setFollowingUids] = useState<string[] | null>(null);

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

    useEffect(() => {
        if (followingUids === null) {
            setIsLoadingPosts(true);
            return;
        }

        setIsLoadingPosts(true);
        const postsCollection = collection(db, "posts");
        
        let q;

        // If the user isn't following anyone (just themself in the array), show the global explore feed instead.
        if (followingUids.length <= 1) {
            q = query(
                postsCollection,
                where('groupId', '==', null), // Only show non-group posts on main feeds
                orderBy("timestamp", "desc")
            );
        } else {
            // Firestore 'in' query is limited to 30 values. For larger-scale apps,
            // a different data model (e.g., fanning out posts to follower feeds) would be needed.
            q = query(
                postsCollection, 
                where("author.uid", "in", followingUids.slice(0, 30)),
                where('groupId', '==', null), // Only show non-group posts
                orderBy("timestamp", "desc")
            );
        }
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const postList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setPosts(postList);
            setIsLoadingPosts(false);
        }, (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: 'posts',
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            setIsLoadingPosts(false);
        });

        return () => unsubscribe();
    }, [followingUids]);

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
                groupId: null, // This is a global post
            };
            if(mediaType === 'image' && mediaUrl) postData.imageUrl = mediaUrl;
            if(mediaType === 'video' && mediaUrl) postData.videoUrl = mediaUrl;
            if(geohash) postData.geohash = geohash;


            addDoc(collection(db, 'posts'), postData)
                .then(() => {
                    setNewPostContent('');
                    setNewPostMedia(null);
                    toast({ title: 'Post created!', description: 'Your post is now live.' });
                })
                .catch((serverError) => {
                     // Check if it's a permission error
                    if (serverError.code === 'permission-denied') {
                        const permissionError = new FirestorePermissionError({
                            path: 'posts',
                            operation: 'create',
                            requestResourceData: postData,
                        } satisfies SecurityRuleContext);
                        errorEmitter.emit('permission-error', permissionError);
                    } else {
                        // Handle other errors
                        console.error("Error creating post: ", serverError);
                        toast({ variant: 'destructive', title: 'Error', description: 'Could not create post. Please try again later.' });
                    }
                })
                .finally(() => {
                    setIsCreatingPost(false);
                });

        } catch (e) {
            console.error("Error during post creation: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create post. Please try again.' });
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
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
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
                        />
                    ))
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
