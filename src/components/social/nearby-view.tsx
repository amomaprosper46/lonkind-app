'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PostCard, { Post, ReactionType } from './post-card';
import { Loader2, MapPin, WifiOff } from 'lucide-react';
import { searchNearbyPosts, SearchNearbyPostsOutput } from '@/ai/flows/search-nearby-posts';
import { Button } from '../ui/button';
import ngeohash from 'ngeohash';
import { toast } from '@/hooks/use-toast';
import type { CurrentUser } from './social-dashboard';


interface NearbyViewProps {
    currentUser: CurrentUser;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

type LocationState = 'prompt' | 'loading' | 'denied' | 'error' | 'success';

export default function NearbyView({ currentUser, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds }: NearbyViewProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [locationState, setLocationState] = useState<LocationState>('prompt');
    const [isPostsLoading, setIsPostsLoading] = useState(false);

    const fetchNearbyPosts = useCallback(async () => {
        setLocationState('loading');
        setIsPostsLoading(true);

        if (!navigator.geolocation) {
            setLocationState('error');
            toast({ variant: 'destructive', title: 'Location Error', description: 'Geolocation is not supported by your browser.' });
            setIsPostsLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const hash = ngeohash.encode(latitude, longitude, 9);
                    
                    const result = await searchNearbyPosts({ geohash: hash });
                    
                    const fetchedPosts = result.posts as unknown as Post[];

                    setPosts(fetchedPosts);
                    setLocationState('success');
                } catch (error) {
                    console.error("Error fetching nearby posts:", error);
                    setLocationState('error');
                    toast({ variant: 'destructive', title: 'Search Failed', description: 'Could not find nearby posts.' });
                } finally {
                    setIsPostsLoading(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationState('denied');
                } else {
                    setLocationState('error');
                }
                setIsPostsLoading(false);
            },
            { timeout: 10000 }
        );
    }, []);

    const renderContent = () => {
        switch (locationState) {
            case 'prompt':
                return (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <MapPin className="h-12 w-12 mx-auto mb-4 text-primary" />
                            <h3 className="text-xl font-semibold">Discover Posts Around You</h3>
                            <p className="mt-1">To find posts from people nearby, we need your permission to access your location.</p>
                            <p className="text-xs mt-2">Your exact location will never be stored or shared.</p>
                            <Button className="mt-4" onClick={fetchNearbyPosts}>
                                Find Nearby Posts
                            </Button>
                        </CardContent>
                    </Card>
                );
            case 'loading':
            case 'success':
                 if (isPostsLoading) {
                    return (
                        <div className="flex justify-center items-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        </div>
                    );
                }
                if (posts.length > 0) {
                    return posts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post}
                            currentUserUid={currentUser.uid}
                            onReact={(postId, reaction) => onReact(postId, reaction, post.author.uid)} 
                            onCommentClick={onComment} 
                            onSavePost={onSavePost}
                            onDeletePost={onDeletePost}
                            userReaction={userReactions.get(post.id)} 
                            isSaved={savedPostIds.has(post.id)} 
                        />
                    ))
                }
                return (
                     <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <MapPin className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">No Posts Nearby</h3>
                            <p>We couldn't find any posts in your area right now. Why not be the first to post?</p>
                        </CardContent>
                    </Card>
                );
            case 'denied':
                return (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <WifiOff className="h-12 w-12 mx-auto mb-4 text-destructive" />
                            <h3 className="text-xl font-semibold">Location Access Denied</h3>
                            <p className="mt-1">You've disabled location access for Lonkind. To use this feature, please enable location permissions in your browser or system settings.</p>
                        </CardContent>
                    </Card>
                );
            case 'error':
                 return (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <WifiOff className="h-12 w-12 mx-auto mb-4 text-destructive" />
                            <h3 className="text-xl font-semibold">Could Not Get Location</h3>
                            <p className="mt-1">We were unable to determine your location. Please try again later.</p>
                            <Button className="mt-4" variant="outline" onClick={fetchNearbyPosts}>
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                );
        }
    };


    return (
        <main className="col-span-12 md:col-span-8 lg:col-span-9 space-y-8">
            <header>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                    <MapPin className="h-10 w-10" />
                    Nearby
                </h1>
                <p className="text-muted-foreground mt-2">
                    See what people are posting in your immediate area.
                </p>
            </header>
            <div className="space-y-6">
                {renderContent()}
            </div>
        </main>
    );
}
