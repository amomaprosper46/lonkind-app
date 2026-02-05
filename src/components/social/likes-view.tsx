
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PostCard, { Post, ReactionType } from './post-card';
import { Loader2, Heart } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, documentId, getDoc, doc, collectionGroup } from 'firebase/firestore';

interface LikesViewProps {
    userId: string;
    currentUserUid: string;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

export default function LikesView({ userId, currentUserUid, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds }: LikesViewProps) {
    const [likedPosts, setLikedPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLikedPosts = useCallback(async () => {
        setIsLoading(true);
        if (!userId) {
            setIsLoading(false);
            return;
        }

        // This is a collection group query. It will require a Firestore index if you add more constraints.
        const reactionsQuery = query(
            collectionGroup(db, 'reactions'),
            where('user.uid', '==', userId)
        );
        
        const reactionsSnapshot = await getDocs(reactionsQuery);
        
        const postIds = reactionsSnapshot.docs.map(reactionDoc => {
            return reactionDoc.ref.parent.parent?.id;
        }).filter((id): id is string => !!id);

        if (postIds.length === 0) {
            setLikedPosts([]);
            setIsLoading(false);
            return;
        }
        
        const uniquePostIds = [...new Set(postIds)];
        
        const fetchedPosts: Post[] = [];
        // Fetch each post document. In a real app with many likes, this could be optimized.
        for (const id of uniquePostIds) {
            const postDoc = await getDoc(doc(db, 'posts', id));
            if(postDoc.exists()) {
                fetchedPosts.push({ id: postDoc.id, ...postDoc.data() } as Post);
            }
        }
        
        // Sort by timestamp if available
        fetchedPosts.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        setLikedPosts(fetchedPosts);
        setIsLoading(false);
    }, [userId]);

    useEffect(() => {
        fetchLikedPosts();
    }, [fetchLikedPosts]);

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
                        currentUserUid={currentUserUid}
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

    