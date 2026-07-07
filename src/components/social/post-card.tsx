'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Heart, Smile, Frown, Loader2, Bookmark, BadgeCheck, Languages, Image, Film, Wand2, Trash2, Coins, AlertTriangle, VolumeX, Music, Lock } from 'lucide-react';
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
import { PulseLoader } from 'react-spinners';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import TipDialog from './tip-dialog';
import UnifiedReportDialog from './unified-report-dialog';
import type { CurrentUser } from './social-dashboard';
import { auth } from '@/lib/firebase';


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
    music?: { title: string, url: string } | null;
    isVipOnly?: boolean;
    unlockCoins?: number;
    unlockedBy?: string[];
    isCause?: boolean;
    causeTitle?: string;
    targetCoins?: number;
    raisedCoins?: number;
    isHidden?: boolean;
    moderationStatus?: string;
}

interface PostCardProps {
    post: Post;
    currentUser: CurrentUser;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onCommentClick: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReaction?: ReactionType | null;
    isSaved: boolean;
    onReportPost?: (post: Post) => void;
    onMuteUser?: (user: PostAuthor) => void;
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

export default function PostCard({ post, currentUser, onReact, onCommentClick, onSavePost, onDeletePost, userReaction, isSaved, onReportPost, onMuteUser }: PostCardProps) {
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

    const [activeAiTask, setActiveAiTask] = useState<string | null>(null);
    const [isTipOpen, setIsTipOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);

    const isAuthor = author.uid === currentUser.uid;
    const canViewVip = !post.isVipOnly || isAuthor || post.unlockedBy?.includes(currentUser?.uid) || isUnlocked;

    const handleUnlockVip = async () => {
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to unlock VIP content.' });
            return;
        }
        setIsUnlocking(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication token missing.");

            const res = await fetch('/api/vip-unlock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ postId: post.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to unlock post.');
            }
            setIsUnlocked(true);
            toast({ title: '🎉 Unlocked!', description: 'You now have permanent VIP access to this post!' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Unlock Failed', description: err.message || 'An error occurred.' });
        } finally {
            setIsUnlocking(false);
        }
    };


    const formattedTimestamp = timestamp && typeof (timestamp as any).toDate === 'function' ? formatDistanceToNow((timestamp as any).toDate(), { addSuffix: true }) : 'Just now';

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
            if (!currentUser) {
                 toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
                 return;
            }
            const result = await translateImageText({ userId: currentUser.uid, imageUrl });
            if (result.success && result.translation?.trim()) {
                setTranslatedImageText(result.translation);
                setShowImageTranslation(true);
            } else {
                 toast({ title: 'No Text Found', description: result.message || 'The AI could not find any text in this image.' });
            }
        } catch (error) {
            console.error("Image translation error:", error);
            toast({ variant: 'destructive', title: 'Translation Failed', description: 'Could not translate text in the image.' });
        } finally {
            setIsTranslatingImage(false);
            setActiveAiTask(null);
        }
    };

    const isAiBusy = isTranslating || isTranslatingImage;

    if (post.isHidden && currentUser?.uid !== post.author.uid) {
        return null;
    }

    return (
        <Card className={cn("overflow-hidden")}>
            {currentUser && <TipDialog isOpen={isTipOpen} onOpenChange={setIsTipOpen} currentUser={currentUser} recipient={post.author} postId={post.id} isCauseDonation={post.isCause} />}
            {currentUser && (
                <UnifiedReportDialog
                    isOpen={isReportOpen}
                    onClose={() => setIsReportOpen(false)}
                    reporterUid={currentUser.uid}
                    reporterName={currentUser.name || 'Community Member'}
                    reporterHandle={currentUser.handle || 'anonymous'}
                    targetType="post"
                    targetId={post.id}
                    targetOwnerUid={post.author.uid}
                    targetAuthorHandle={post.author.handle}
                    targetContentSnippet={post.content}
                />
            )}
            {post.isHidden && (
                <div className="bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>This post has been hidden from the public timeline by Lonkind Moderator AI following community safety reports.</span>
                </div>
            )}
            <CardHeader className="p-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href={`/profile/${author.handle}`}>
                        <Avatar>
                            <AvatarImage src={author.avatarUrl} alt={author.name} data-ai-hint="user avatar" />
                            <AvatarFallback>{author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </Link>
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Link href={`/profile/${author.handle}`} className="font-semibold hover:underline">{author.name}</Link>
                            {author.isProfessional && <BadgeCheck className="h-5 w-5 text-primary" />}
                            {(author as any).badges?.includes('Top Creator') && <span title="Top Creator" className="inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">👑 Top Creator</span>}
                            {(author as any).badges?.includes('Whale') && <span title="Whale" className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">🐋 Whale</span>}
                            {(author as any).badges?.includes('Top Supporter') && <span title="Top Supporter" className="inline-flex items-center rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-bold text-pink-600 dark:text-pink-400 border border-pink-500/30">💖 Top Supporter</span>}
                            {(author as any).badges?.includes('Rising Star') && <span title="Rising Star" className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">⭐ Rising Star</span>}
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
                            <DropdownMenuItem onClick={() => {
                                if (onReportPost) onReportPost(post);
                                else setIsReportOpen(true);
                            }} className="text-destructive cursor-pointer">
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Report Post
                            </DropdownMenuItem>
                            {!isAuthor && (
                                <DropdownMenuItem onClick={() => onMuteUser?.(author)}>
                                    <VolumeX className="mr-2 h-4 w-4" />
                                    Mute @{author.handle}
                                </DropdownMenuItem>
                            )}
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
                {!canViewVip ? (
                    <div className="my-4 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-amber-600/10 border-2 border-amber-500/30 text-center backdrop-blur-md relative overflow-hidden shadow-inner">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl" />
                        <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3 shadow-md">
                            <Lock className="h-7 w-7 text-amber-500 animate-pulse" />
                        </div>
                        <h4 className="text-lg font-extrabold text-amber-600 dark:text-amber-400">🔒 VIP Members-Only Content</h4>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                            This exclusive post is locked by <span className="font-bold text-foreground">@{author.name}</span>. Unlock it instantly with your Lonkind Coins!
                        </p>
                        <Button 
                            onClick={handleUnlockVip}
                            disabled={isUnlocking}
                            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold px-6 py-2 rounded-full shadow-lg transition-all transform hover:scale-105"
                        >
                            {isUnlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                            Unlock Post ({post.unlockCoins || 50} Coins)
                        </Button>
                    </div>
                ) : (
                    <>
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
                        
                        {post.music && (
                            <div className="mt-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/40 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                                        <Music className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-semibold truncate">{post.music.title}</p>
                                        <p className="text-xs text-muted-foreground">Attached Music</p>
                                    </div>
                                </div>
                                <audio controls src={post.music.url} className="w-full h-10" />
                            </div>
                        )}
                    </>
                )}

                {post.isCause && (
                    <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-purple-500/10 border border-pink-500/30 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1">
                                <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500 animate-pulse" /> Lonkind Cause Fundraise
                            </span>
                            <span className="text-xs font-bold bg-pink-500/20 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full">
                                {Math.min(100, Math.floor(((post.raisedCoins || 0) / (post.targetCoins || 5000)) * 100))}% Reached
                            </span>
                        </div>
                        <h4 className="font-extrabold text-base mb-1">{post.causeTitle || 'Community Cause'}</h4>
                        <div className="w-full bg-muted rounded-full h-2.5 mb-3 overflow-hidden border border-border/40">
                            <div 
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.floor(((post.raisedCoins || 0) / (post.targetCoins || 5000)) * 100))}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                            <span>Raised: <strong className="text-foreground font-bold">{post.raisedCoins || 0} Coins</strong></span>
                            <span>Goal: <strong className="text-foreground font-bold">{post.targetCoins || 5000} Coins</strong></span>
                        </div>
                        <Button 
                            size="sm" 
                            onClick={() => setIsTipOpen(true)}
                            className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold shadow-md rounded-lg transition-all transform hover:scale-[1.01]"
                        >
                            💖 Donate Coins to Support Cause
                        </Button>
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
                    {!isAuthor && (
                         <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-primary" onClick={() => setIsTipOpen(true)}>
                            <Coins className="h-5 w-5" />
                            <span>Tip</span>
                        </Button>
                    )}
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
                                    <DropdownMenuItem onClick={handleTranslateImage} disabled={isAiBusy}>
                                        <Image className="mr-2 h-4 w-4" />
                                        <span>{showImageTranslation ? 'Hide Image Text' : 'Translate Image Text'}</span>
                                    </DropdownMenuItem>
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
