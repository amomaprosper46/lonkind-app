
'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Loader2, Compass } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import { Card, CardContent } from '@/components/ui/card';

interface ExploreViewProps {
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

export default function ExploreView({ onReact, onComment, onSavePost, userReactions, savedPostIds }: ExploreViewProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const postsCollection = collection(db, "posts");
        // Simple query to get the most recent posts from everyone
        const q = query(postsCollection, orderBy("timestamp", "desc"));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const postList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setPosts(postList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching explore posts: ", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <main className="col-span-12 md:col-span-8 lg:col-span-9 space-y-8">
            <header>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                    <Compass className="h-10 w-10" />
                    Explore
                </h1>
                <p className="text-muted-foreground mt-2">
                    Discover new posts from the entire Lonkind community.
                </p>
            </header>
            <div className="space-y-6">
                {isLoading ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                ) : posts.length > 0 ? (
                    posts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            onReact={(postId, reaction) => onReact(postId, reaction, post.author.uid)} 
                            onCommentClick={onComment} 
                            onSavePost={onSavePost} 
                            userReaction={userReactions.get(post.id)} 
                            isSaved={savedPostIds.has(post.id)} 
                        />
                    ))
                ) : (
                     <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <Compass className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">Nothing to explore yet</h3>
                            <p>Be the first to create a post!</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
