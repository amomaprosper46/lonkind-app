'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { Loader2, Compass } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import { Card, CardContent } from '@/components/ui/card';
import type { CurrentUser } from './social-dashboard';
import PostCardSkeleton from './post-card-skeleton';
import { Button } from '../ui/button';
import { toast } from '@/hooks/use-toast';

const POSTS_PER_PAGE = 10;

interface ExploreViewProps {
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

export default function ExploreView({ currentUser, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds, onReportPost, onMuteUser, mutedUids, blockedUids }: ExploreViewProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastPost, setLastPost] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchPosts = useCallback(async (initialFetch = false) => {
        if (initialFetch) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const postsCollection = collection(db, "posts");
            let q = query(
                postsCollection, 
                orderBy("engagementScore", "desc"),
                limit(POSTS_PER_PAGE)
            );

            if (!initialFetch && lastPost) {
                q = query(q, startAfter(lastPost));
            }

            const querySnapshot = await getDocs(q);
            const postList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            const filteredPosts = postList.filter(post => !mutedUids.has(post.author.uid) && !blockedUids.has(post.author.uid));

            setHasMore(postList.length === POSTS_PER_PAGE);
            setLastPost(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
            setPosts(prev => initialFetch ? filteredPosts : [...prev, ...filteredPosts]);
        } catch (error) {
            console.error("Error fetching trending posts: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch posts.' });
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [lastPost, mutedUids, blockedUids]);

    useEffect(() => {
        fetchPosts(true);
    }, [mutedUids, blockedUids]);

    return (
        <main className="col-span-12 md:col-span-9 space-y-8">
            <header>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                    <Compass className="h-10 w-10" />
                    Trending
                </h1>
                <p className="text-muted-foreground mt-2">
                    Discover the most popular and engaging posts from the community.
                </p>
            </header>
            <div className="space-y-6">
                {isLoading ? (
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
                            <Compass className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">Nothing is trending yet</h3>
                            <p>Be the first to create a post and get the conversation started!</p>
                        </CardContent>
                    </Card>
                )}

                {hasMore && !isLoading && (
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
