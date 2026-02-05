
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PostCard, { Post, ReactionType } from './post-card';
import { Loader2, Bookmark } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, documentId, orderBy, onSnapshot } from 'firebase/firestore';

interface SavedViewProps {
    userId: string;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

export default function SavedView({ userId, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds }: SavedViewProps) {
    const [savedPosts, setSavedPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSavedPosts = useCallback(async () => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        const postIds = Array.from(savedPostIds);

        if (postIds.length === 0) {
            setSavedPosts([]);
            setIsLoading(false);
            return;
        }
        
        const fetchedPosts: Post[] = [];
        // Firestore 'in' query is limited to 30 elements.
        // For larger lists, you'd need to batch the requests.
        const idBatches = [];
        for (let i = 0; i < postIds.length; i += 30) {
            idBatches.push(postIds.slice(i, i + 30));
        }

        for (const batch of idBatches) {
             if (batch.length === 0) continue;
            const postsRef = collection(db, 'posts');
            const q = query(postsRef, where(documentId(), 'in', batch));
            const postsSnap = await getDocs(q);
            postsSnap.forEach(d => fetchedPosts.push({ id: d.id, ...d.data() } as Post));
        }

        // Re-sort the fetched posts to match the saved order (most recent first)
        const sortedPosts = fetchedPosts.sort((a, b) => postIds.indexOf(b.id) - postIds.indexOf(a.id));

        setSavedPosts(sortedPosts);
        setIsLoading(false);
    }, [userId, savedPostIds]);

    useEffect(() => {
        setIsLoading(true);
        fetchSavedPosts();
    }, [fetchSavedPosts]);

    return (
        <main className="col-span-9 space-y-8">
            <header>
                <h1 className="text-4xl font-bold">Saved Posts</h1>
                <p className="text-muted-foreground mt-2">
                    Here are all the posts you've bookmarked for later.
                </p>
            </header>
            <div className="space-y-6">
                {isLoading ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                ) : savedPosts.length > 0 ? (
                    savedPosts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post}
                            currentUserUid={userId}
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
                            <Bookmark className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">No saved posts</h3>
                            <p>You haven't saved any posts yet. Click the bookmark icon on a post to save it.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}

    