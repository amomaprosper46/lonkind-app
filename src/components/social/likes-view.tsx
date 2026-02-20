
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PostCard, { Post, ReactionType } from './post-card';
import { Loader2, Heart } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, documentId, getDoc, doc, onSnapshot, collectionGroup } from 'firebase/firestore';
import type { CurrentUser } from './social-dashboard';

interface LikesViewProps {
    userId: string;
    currentUser: CurrentUser;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

export default function LikesView({ userId, currentUser, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds }: LikesViewProps) {
    const [likedPosts, setLikedPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // This is a collection group query. It will require a Firestore index.
        const reactionsQuery = query(
            collectionGroup(db, 'reactions'),
            where('user.uid', '==', userId)
        );
        
        const unsubscribe = onSnapshot(reactionsQuery, async (reactionsSnapshot) => {
            const postIds = reactionsSnapshot.docs
                .map(reactionDoc => reactionDoc.ref.parent.parent?.id)
                .filter((id): id is string => !!id);

            if (postIds.length === 0) {
                setLikedPosts([]);
                setIsLoading(false);
                return;
            }
            
            const uniquePostIds = [...new Set(postIds)];
            
            const fetchedPosts: Post[] = [];
            // Fetch each post document. In a real app with many likes, this could be optimized.
            for (const id of uniquePostIds) {
                try {
                    const postDoc = await getDoc(doc(db, 'posts', id));
                    if(postDoc.exists()) {
                        fetchedPosts.push({ id: postDoc.id, ...postDoc.data() } as Post);
                    }
                } catch (e) {
                    console.error(`Error fetching liked post with id ${id}`, e);
                }
            }
            
            // Sort by timestamp if available, most recent first
            fetchedPosts.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

            setLikedPosts(fetchedPosts);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching liked posts in real-time:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return (
        <div className="space-y-6">
            {isLoading ? (
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            ) : likedPosts.length > 0 ? (
                likedPosts.map(post => (
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
                        <Heart className="h-12 w-12 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold">No liked posts</h3>
                        <p>This user hasn't liked anything yet.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
