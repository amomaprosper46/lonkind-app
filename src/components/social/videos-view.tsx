
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Play, Video as VideoIcon, Loader2, Music4, Heart, MessageCircle, Share2, Bookmark, Pause } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import type { Post, ReactionType } from './post-card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel"
import type { CurrentUser } from './social-dashboard';

interface VideosViewProps {
    currentUser: CurrentUser;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

const VideoPost = ({ videoPost, currentUser, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds, isVisible }: { videoPost: Post } & VideosViewProps & { isVisible: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPaused, setIsPaused] = useState(true);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isVisible) {
            video.play().catch(e => console.log("Video play failed", e));
            setIsPaused(false);
        } else {
            video.pause();
            video.currentTime = 0; // Reset video on scroll away
            setIsPaused(true);
        }
    }, [isVisible]);

    const handleVideoClick = () => {
        const video = videoRef.current;
        if (video) {
            if (video.paused) {
                video.play();
                setIsPaused(false);
            } else {
                video.pause();
                setIsPaused(true);
            }
        }
    };

    const totalLikes = Object.values(videoPost.reactions || {}).reduce((acc, val) => acc + (val || 0), 0);
    const userReaction = userReactions.get(videoPost.id);
    const isSaved = savedPostIds.has(videoPost.id);

    const formatCount = (num: number): string => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    return (
        <CarouselItem className="p-0 h-full">
            <div className="w-full h-full flex-shrink-0 relative flex items-center justify-center bg-black rounded-lg overflow-hidden">
                <video
                    ref={videoRef}
                    src={videoPost.videoUrl}
                    loop
                    playsInline
                    onClick={handleVideoClick}
                    className="h-full w-auto object-contain cursor-pointer"
                    data-ai-hint="social media video"
                />
                {isPaused && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                        <Play className="h-20 w-20 text-white/70" fill="white" />
                    </div>
                )}
                <div className="absolute bottom-10 left-4 text-white text-shadow-lg max-w-[80%] z-10">
                    <Link href={`/profile/${videoPost.author.handle}`} className="flex items-center gap-3 group">
                        <Avatar className="h-10 w-10 border-2 border-white">
                            <AvatarImage src={videoPost.author.avatarUrl} alt={videoPost.author.name} data-ai-hint="user avatar" />
                            <AvatarFallback>{videoPost.author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold group-hover:underline">{videoPost.author.name}</p>
                    </Link>
                    <p className="mt-2 text-sm">{videoPost.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <Music4 className="h-4 w-4" />
                        <p className="text-xs">Original Audio - {videoPost.author.name}</p>
                    </div>
                </div>

                 <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-4 z-10">
                    <Button variant="ghost" size="icon" className="h-auto p-0 flex flex-col text-white" onClick={() => onReact(videoPost.id, 'love', videoPost.author.uid)}>
                        <Heart className={cn("h-8 w-8", userReaction === 'love' && "fill-red-500 text-red-500")} />
                        <span className="text-sm font-semibold">{formatCount(totalLikes)}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-auto p-0 flex flex-col text-white" onClick={() => onComment(videoPost)}>
                        <MessageCircle className="h-8 w-8" />
                        <span className="text-sm font-semibold">{formatCount(videoPost.comments)}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-auto p-0 flex flex-col text-white" onClick={() => onSavePost(videoPost.id)}>
                        <Bookmark className={cn("h-8 w-8", isSaved && "fill-white")} />
                        <span className="text-sm font-semibold">Save</span>
                    </Button>
                     <Button variant="ghost" size="icon" className="h-auto p-0 flex flex-col text-white">
                        <Share2 className="h-8 w-8" />
                        <span className="text-sm font-semibold">Share</span>
                    </Button>
                </div>
            </div>
        </CarouselItem>
    );
};


export default function VideosView({ currentUser, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds }: VideosViewProps) {
  const [videos, setVideos] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)

  useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])


  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('videoUrl', '!=', null),
      orderBy('videoUrl'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setVideos(videoList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching videos: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  if (isLoading) {
    return (
      <main className="col-span-9 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </main>
    );
  }

  return (
    <main className="col-span-12 md:col-span-8 lg:col-span-6 h-[calc(100vh-4.1rem-4rem)]">
        {videos.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-center text-muted-foreground bg-background rounded-lg">
                <VideoIcon className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold">No Videos Yet</h3>
                <p>Share a video in a post to see it here.</p>
            </div>
        ) : (
            <Carousel setApi={setApi} orientation="vertical" className="w-full h-full">
                <CarouselContent className="h-full">
                    {videos.map((videoPost, index) => (
                        <VideoPost 
                            key={videoPost.id}
                            videoPost={videoPost}
                            currentUser={currentUser}
                            onReact={onReact}
                            onComment={onComment}
                            onSavePost={onSavePost}
                            onDeletePost={onDeletePost}
                            userReactions={userReactions}
                            savedPostIds={savedPostIds}
                            isVisible={current === index}
                        />
                    ))}
                </CarouselContent>
            </Carousel>
        )}
    </main>
  );
}
