'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Heart, Smile, Frown, Loader2, Bookmark, BadgeCheck, Languages, Image, Film, Wand2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import ReactionListDialog from './reaction-list-dialog';
import { toast } from '@/hooks/use-toast';
import { translateText } from '@/ai/flows/translate-text';
import { translateImageText } from '@/ai/flows/translate-image-text';
import { animateImage } from '@/ai/flows/animate-image';
import { remixImage } from '@/ai/flows/remix-image';
import { PulseLoader } from 'react-spinners';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';


interface PostAuthor {
    name: string;
    avatarUrl: string;
    handle: string;
    uid: string;
    isProfessional?: boolean;
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'sad';

export interface Post {
    id: string;
    author: PostAuthor;
    content: string;
    imageUrl?: string;
    videoUrl?: string;
    reactions: { [key in ReactionType]?: number };
    comments: number;
    timestamp: Timestamp;
    geohash?: string;
    groupId?: string | null;
}

interface PostCardProps {
    post: Post;
    currentUserUid: string;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onCommentClick: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReaction?: ReactionType | null;
    isSaved: boolean;
}

const reactionIcons: { [key in ReactionType]: React.ElementType } = {
    like: ThumbsUp,
    love: Heart,
    laugh: Smile,
    sad: Frown,
};

const ReactionButton = ({ reaction, onReact, isActive }: { reaction: ReactionType, onReact: () => void, isActive: boolean }) => {
    const Icon = reactionIcons[reaction];
    return (
        <Button variant="ghost" size="icon" onClick={onReact} className={cn('rounded-full', { 'bg-primary/20': isActive })}>
            <Icon className={cn('h-5 w-5', {
                'text-blue-500 fill-blue-500': reaction === 'like' && isActive,
                'text-red-500 fill-red-500': reaction === 'love' && isActive,
                'text-yellow-500 fill-yellow-500': reaction === 'laugh' && isActive,
                'text-yellow-600 fill-yellow-600': reaction === 'sad' && isActive,
                'text-muted-foreground': !isActive
            })} />
        </Button>
    )
};

export default function PostCard({ post, currentUserUid, onReact, onCommentClick, onSavePost, onDeletePost, userReaction, isSaved }: PostCardProps) {
    const { author, content, imageUrl, videoUrl, reactions, comments, timestamp } = post;
    const totalReactions = Object.values(reactions || {}).reduce((a, b) => a + (b || 0), 0);
    const CurrentReactionIcon = userReaction ? reactionIcons[userReaction] : ThumbsUp;
    const [isReactionDialogOpen, setIsReactionDialogOpen] = useState(false);
    
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    
    const [translatedImageText, setTranslatedImageText] = useState<string | null>(null);
    const [isTranslatingImage, setIsTranslatingImage] = useState(false);
    const [showImageTranslation, setShowImageTranslation] = useState(false);

    const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const [remixedImageUrl, setRemixedImageUrl] = useState<string | null>(null);
    const [isRemixing, setIsRemixing] = useState(false);

    const [activeAiTask, setActiveAiTask] = useState<string | null>(null);

    const isAuthor = author.uid === currentUserUid;


    const formattedTimestamp = timestamp ? formatDistanceToNow(timestamp.toDate(), { addSuffix: true }) : 'Just now';

    const handleShare = () => {
        const profileUrl = `${window.location.origin}/profile/${author.handle}`;
        navigator.clipboard.writeText(profileUrl).then(() => {
            toast({
                title: 'Link Copied!',
                description: `A link to ${author.name}'s profile has been copied to your clipboard.`,
            });
        }).catch(err => {
            console.error('Failed to copy: ', err);
            toast({
                variant: 'destructive',
                title: 'Failed to Copy',
                description: 'Could not copy the link.',
            });
        });
    };

    const handleTranslate = async () => {
        if (translatedContent) {
            setShowOriginal(!showOriginal);
            return;
        }
        setIsTranslating(true);
        setActiveAiTask('Translating...');
        try {
            const result = await translateText({ text: content });
            setTranslatedContent(result.translation);
            setShowOriginal(false);
        } catch (error) {
            console.error("Translation error:", error);
            toast({ variant: 'destructive', title: 'Translation Failed', description: 'Could not translate the post.' });
        } finally {
            setIsTranslating(false);
            setActiveAiTask(null);
        }
    };
    
    const handleTranslateImage = async () => {
        if (!imageUrl) return;
        if (translatedImageText) {
            setShowImageTranslation(!showImageTranslation);
            return;
        }
        setIsTranslatingImage(true);
        setActiveAiTask('Reading image...');
        try {
            const result = await translateImageText({ imageUrl });
            if (result.translation.trim()) {
                setTranslatedImageText(result.translation);
                setShowImageTranslation(true);
            } else {
                 toast({ title: 'No Text Found', description: 'The AI could not find any text in this image.' });
            }
        } catch (error) {
            console.error("Image translation error:", error);
            toast({ variant: 'destructive', title: 'Translation Failed', description: 'Could not translate text in the image.' });
        } finally {
            setIsTranslatingImage(false);
            setActiveAiTask(null);
        }
    };

    const handleAnimateImage = async () => {
        if (!imageUrl) return;
        setIsAnimating(true);
        setActiveAiTask('Animating image...');
        try {
            const result = await animateImage({ imageUrl });
            setAnimatedVideoUrl(result.videoUrl);
        } catch (error) {
            console.error("Image animation error:", error);
            toast({
                variant: 'destructive',
                title: 'Animation Failed',
                description: 'Could not animate the image. This can happen with high demand. Please try again later.'
            });
        } finally {
            setIsAnimating(false);
            setActiveAiTask(null);
        }
    };
    
    const handleRemixImage = async () => {
        if (!imageUrl) return;
        setIsRemixing(true);
        setActiveAiTask('Remixing image...');
        try {
            const result = await remixImage({ imageUrl, prompt: 'Turn this into a vibrant anime scene, keeping the main subject.' });
            setRemixedImageUrl(result.remixedImageUrl);
        } catch (error) {
            console.error("Image remix error:", error);
            toast({
                variant: 'destructive',
                title: 'Remix Failed',
                description: 'Could not remix the image. This feature is experimental. Please try again later.'
            });
        } finally {
            setIsRemixing(false);
            setActiveAiTask(null);
        }
    };
    
    const isAiBusy = isAnimating || isTranslating || isTranslatingImage || isRemixing;


    return (
        <Card className={cn("overflow-hidden")}>
            <CardHeader className="p-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href={`/profile/${author.handle}`}>
                        <Avatar>
                            <AvatarImage src={author.avatarUrl} alt={author.name} data-ai-hint="user avatar" />
                            <AvatarFallback>{author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </Link>
                    <div>
                        <div className="flex items-center gap-1">
                            <Link href={`/profile/${author.handle}`} className="font-semibold hover:underline">{author.name}</Link>
                            {author.isProfessional && <BadgeCheck className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="text-sm text-muted-foreground">@{author.handle} &middot; {formattedTimestamp}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onSavePost(post.id)} >
                        <Bookmark className={cn("h-5 w-5", isSaved && "fill-primary text-primary")} />
                    </Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Report Post</DropdownMenuItem>
                            <DropdownMenuItem>Mute this user</DropdownMenuItem>
                            {isAuthor && (
                                <>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem
                                            className="text-destructive"
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Post
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your post and all its comments and reactions.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => onDeletePost(post.id)}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className={cn("px-4", content ? "pb-2" : "p-0")}>
                {content && (
                    <div className="mb-4">
                        <p className="whitespace-pre-wrap">{showOriginal || !translatedContent ? content : translatedContent}</p>
                        {isTranslating && <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2"><Loader2 className="h-4 w-4 animate-spin" /> Translating...</div>}
                        {translatedContent && (
                             <Button variant="link" size="sm" className="p-0 h-auto mt-1" onClick={() => setShowOriginal(!showOriginal)}>
                                {showOriginal ? 'Show translation' : 'Show original'}
                            </Button>
                        )}
                    </div>
                )}
                
                {(imageUrl || videoUrl) && (
                    <div className="relative rounded-lg border overflow-hidden">
                        {activeAiTask ? (
                            <div className="aspect-video w-full flex flex-col items-center justify-center bg-muted text-center p-4">
                                <PulseLoader color="hsl(var(--primary))" loading={true} size={15} />
                                <p className="mt-6 text-muted-foreground font-semibold">{activeAiTask}</p>
                                <p className="text-sm text-muted-foreground">This can take up to a minute. Please be patient.</p>
                            </div>
                        ) : animatedVideoUrl ? (
                            <video src={animatedVideoUrl} controls autoPlay loop className="w-full h-auto" data-ai-hint="animated social media post video" />
                        ) : remixedImageUrl ? (
                            <img src={remixedImageUrl} alt="Remixed post content" className="w-full h-auto" data-ai-hint="remixed social media post image" />
                        ) : imageUrl ? (
                            <>
                                <img src={imageUrl} alt="Post content" className="w-full h-auto" data-ai-hint="social media post image" />
                                {showImageTranslation && translatedImageText && (
                                    <div 
                                        className="absolute inset-0 bg-black/70 p-4 text-white text-center flex items-center justify-center cursor-pointer" 
                                        onClick={() => setShowImageTranslation(false)}
                                    >
                                        <p className="text-lg font-semibold whitespace-pre-wrap">{translatedImageText}</p>
                                    </div>
                                )}
                            </>
                        ) : videoUrl && (
                            <video src={videoUrl} controls className="w-full h-auto" data-ai-hint="social media post video" />
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter className="px-4 py-2 flex justify-between items-center border-t">
                 <div className="flex gap-1 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                className={cn("flex items-center gap-2 text-muted-foreground hover:text-primary", { 
                                    'text-blue-500': userReaction === 'like',
                                    'text-red-500': userReaction === 'love',
                                    'text-yellow-500': userReaction === 'laugh',
                                    'text-yellow-600': userReaction === 'sad',
                                 })} 
                            >
                                <CurrentReactionIcon className={cn("h-5 w-5", { 'fill-current': userReaction })}/>
                                <span>{userReaction ? userReaction.charAt(0).toUpperCase() + userReaction.slice(1) : 'React'}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1">
                            <div className="flex gap-1">
                                {(Object.keys(reactionIcons) as ReactionType[]).map(reaction => (
                                    <ReactionButton 
                                        key={reaction}
                                        reaction={reaction}
                                        onReact={() => onReact(post.id, reaction, post.author.uid)}
                                        isActive={userReaction === reaction}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    {totalReactions > 0 && (
                        <Dialog open={isReactionDialogOpen} onOpenChange={setIsReactionDialogOpen}>
                            <DialogTrigger asChild>
                                <button className="text-sm text-muted-foreground hover:underline">
                                    {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
                                </button>
                            </DialogTrigger>
                            <ReactionListDialog postId={post.id} open={isReactionDialogOpen} />
                        </Dialog>
                    )}
                    <span className="text-muted-foreground mx-1">&middot;</span>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-primary" onClick={() => onCommentClick(post)}>
                        <MessageCircle className="h-5 w-5" />
                         <span>{comments > 0 ? comments : ''}</span>
                    </Button>
                </div>
                 <div className="flex items-center gap-1">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-primary" disabled={isAiBusy}>
                                {isAiBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                                <span>AI Magic</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                             {content && (
                                <DropdownMenuItem onClick={handleTranslate} disabled={isAiBusy}>
                                    <Languages className="mr-2 h-4 w-4" />
                                    <span>{translatedContent ? (showOriginal ? 'Show Translation' : 'Show Original') : 'Translate Post'}</span>
                                </DropdownMenuItem>
                            )}
                             {imageUrl && (
                                <>
                                    <DropdownMenuItem onClick={handleTranslateImage} disabled={isAiBusy}>
                                        <Image className="mr-2 h-4 w-4" />
                                        <span>{showImageTranslation ? 'Hide Image Text' : 'Translate Image Text'}</span>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onClick={handleAnimateImage} disabled={isAiBusy || !!animatedVideoUrl}>
                                        <Film className="mr-2 h-4 w-4" />
                                        <span>Animate Image</span>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onClick={handleRemixImage} disabled={isAiBusy || !!remixedImageUrl}>
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        <span>Remix Image</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                     </DropdownMenu>

                    <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-primary" onClick={handleShare}>
                        <Share2 className="h-5 w-5" />
                        <span>Share</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
