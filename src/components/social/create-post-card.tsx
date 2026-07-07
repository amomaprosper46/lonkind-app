'use client';

import React, { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Loader2, Music, Lock, Heart, Sparkles, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CurrentUser {
    name: string;
    avatarUrl: string;
    isRestricted?: boolean;
}

interface NewPostMedia {
    file: File;
    url: string;
    type: 'image' | 'video';
}

const ROYALTY_FREE_MUSIC = [
    { title: "Upbeat Pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { title: "Chill Electronic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { title: "Acoustic Vibes", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { title: "Smooth Jazz", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
    { title: "Lofi Study Beat", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
];

interface CreatePostCardProps {
    currentUser: CurrentUser;
    newPostContent: string;
    setNewPostContent: (content: string) => void;
    newPostMedia: NewPostMedia | null;
    setNewPostMedia: (media: NewPostMedia | null) => void;
    newPostMusic?: { title: string, url: string } | null;
    setNewPostMusic?: (music: { title: string, url: string } | null) => void;
    handleCreatePost: (extraSettings?: any) => Promise<void>;
    isCreatingPost: boolean;
}

export default function CreatePostCard({ 
    currentUser,
    newPostContent,
    setNewPostContent,
    newPostMedia,
    setNewPostMedia,
    newPostMusic,
    setNewPostMusic,
    handleCreatePost,
    isCreatingPost 
}: CreatePostCardProps) {
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const [isVipOnly, setIsVipOnly] = React.useState(false);
    const [unlockCoins, setUnlockCoins] = React.useState(50);
    const [isCause, setIsCause] = React.useState(false);
    const [causeTitle, setCauseTitle] = React.useState('');
    const [targetCoins, setTargetCoins] = React.useState(5000);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('image/')) {
                setNewPostMedia({ file, url, type: 'image' });
            } else if (file.type.startsWith('video/')) {
                setNewPostMedia({ file, url, type: 'video' });
            } else {
                toast({
                    variant: "destructive",
                    title: "Unsupported File Type",
                    description: "Please select an image or video file.",
                });
            }
             // Reset the input value to allow selecting the same file again
            if(mediaInputRef.current) {
              mediaInputRef.current.value = "";
            }
        }
    };

    if (currentUser?.isRestricted) {
        return (
            <Card className="mb-6 shadow-sm border-destructive/50 bg-destructive/5">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-destructive">Posting Temporarily Restricted</h4>
                            <p className="text-xs text-muted-foreground">
                                Your account has been temporarily restricted by Lonkind Moderator AI following community safety reports.
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => toast({ title: "Appeal Instruction", description: "Please visit your profile or contact moderation to submit an appeal." })}>
                        Appeal
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mb-6 shadow-sm border-border/40">
            <CardContent className="p-4">
                <div className="flex gap-3 items-center mb-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={currentUser?.avatarUrl || undefined} alt="My Avatar" data-ai-hint="user avatar" />
                        <AvatarFallback>{currentUser?.name ? currentUser.name.charAt(0) : 'U'}</AvatarFallback>
                    </Avatar>
                    <Textarea
                        placeholder={`What's on your mind, ${currentUser?.name?.split(' ')[0] || ''}?`}
                        className="bg-muted/50 border-transparent hover:bg-muted focus-visible:ring-0 focus-visible:bg-transparent resize-none min-h-[44px] py-3 overflow-hidden rounded-full px-4"
                        value={newPostContent}
                        onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                            e.target.style.borderRadius = e.target.value ? '1rem' : '9999px';
                            setNewPostContent(e.target.value);
                        }}
                        disabled={isCreatingPost}
                    />
                </div>
                
                {newPostMedia && (
                    <div className="relative mt-2 mb-3 border rounded-lg overflow-hidden mx-12">
                        {newPostMedia.type === 'image' ? (
                            <img src={newPostMedia.url} alt="Preview" className="w-full h-auto max-h-[300px] object-cover" data-ai-hint="new post image preview" />
                        ) : (
                            <video src={newPostMedia.url} controls className="w-full h-auto max-h-[300px]" data-ai-hint="new post video preview" />
                        )}
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-md"
                            onClick={() => setNewPostMedia(null)}
                            disabled={isCreatingPost}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                
                {newPostMusic && (
                    <div className="mt-2 bg-indigo-50 dark:bg-indigo-950/30 p-2 rounded-lg flex items-center justify-between border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="h-8 w-8 rounded bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                                <Music className="h-4 w-4 text-indigo-500" />
                            </div>
                            <span className="text-sm font-medium truncate">{newPostMusic.title}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-500" onClick={() => setNewPostMusic?.(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {isVipOnly && (
                    <div className="mt-2 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-amber-500 animate-pulse" />
                            <div>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">🔒 VIP Members-Only Post</p>
                                <p className="text-xs text-muted-foreground">Requires <span className="font-semibold text-amber-500">{unlockCoins} Coins</span> to unlock content.</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-amber-500/20" onClick={() => setIsVipOnly(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {isCause && (
                    <div className="mt-2 bg-gradient-to-r from-pink-500/10 to-rose-500/10 p-3 rounded-xl border border-pink-500/30 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                            <Heart className="h-5 w-5 text-pink-500 fill-pink-500 animate-bounce" />
                            <div>
                                <p className="text-sm font-bold text-pink-600 dark:text-pink-400">❤️ Lonkind Cause Fundraise: {causeTitle || 'Untitled Cause'}</p>
                                <p className="text-xs text-muted-foreground">Target Goal: <span className="font-semibold text-pink-500">{targetCoins} Coins</span></p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-pink-500/20" onClick={() => setIsCause(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                
                <div className="border-t border-border/60 pt-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-1 flex-wrap items-center">
                        <input
                            type="file"
                            ref={mediaInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept="image/*,video/*"
                            disabled={isCreatingPost}
                        />
                        <Button 
                            variant="ghost" 
                            className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg h-9 px-3 text-xs md:text-sm" 
                            onClick={() => mediaInputRef.current?.click()} 
                            disabled={isCreatingPost}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="mr-1.5 h-5 w-5 text-green-500">
                                <path d="M20.5 4h-17A1.5 1.5 0 0 0 2 5.5v13A1.5 1.5 0 0 0 3.5 20h17a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 20.5 4zm-11 5.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM4 18l4.5-6 3.5 4.5 4.5-6 3.5 4.5v1.5H4V18z" />
                            </svg>
                            Media
                        </Button>

                        {setNewPostMusic && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg h-9 px-3 text-xs md:text-sm" 
                                        disabled={isCreatingPost}
                                    >
                                        <Music className="mr-1.5 h-4 w-4 text-indigo-500" />
                                        Music
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="start">
                                    <div className="p-3 border-b border-border bg-muted/50">
                                        <p className="text-sm font-semibold">Attach Music</p>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {ROYALTY_FREE_MUSIC.map((track, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => setNewPostMusic({ title: track.title, url: track.url })}
                                                className="w-full text-left px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group"
                                            >
                                                <span className="font-medium truncate">{track.title}</span>
                                                <Music className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    className={`rounded-lg h-9 px-3 text-xs md:text-sm transition-all ${isVipOnly ? 'bg-amber-500/10 text-amber-600 font-semibold border border-amber-500/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    disabled={isCreatingPost}
                                >
                                    <Lock className="mr-1.5 h-4 w-4 text-amber-500" />
                                    VIP Club
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-4 shadow-xl border-amber-500/30" align="start">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <Lock className="h-4 w-4" /> VIP Members Post
                                        </h4>
                                        <input 
                                            type="checkbox" 
                                            checked={isVipOnly} 
                                            onChange={(e) => {
                                                setIsVipOnly(e.target.checked);
                                                if (e.target.checked) setIsCause(false); // mutually exclusive
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Lock this post so only users who spend Coins can view the content. You earn 100% of unlock coins as Diamonds!
                                    </p>
                                    {isVipOnly && (
                                        <div className="space-y-1.5 pt-2 border-t border-border">
                                            <Label className="text-xs font-semibold">Unlock Fee (Coins)</Label>
                                            <Input 
                                                type="number" 
                                                min={5} 
                                                max={10000} 
                                                value={unlockCoins} 
                                                onChange={(e) => setUnlockCoins(Math.max(5, parseInt(e.target.value) || 50))} 
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    className={`rounded-lg h-9 px-3 text-xs md:text-sm transition-all ${isCause ? 'bg-pink-500/10 text-pink-600 font-semibold border border-pink-500/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    disabled={isCreatingPost}
                                >
                                    <Heart className="mr-1.5 h-4 w-4 text-pink-500 fill-pink-500" />
                                    Cause
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4 shadow-xl border-pink-500/30" align="start">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-sm text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                            <Heart className="h-4 w-4 fill-pink-500" /> Lonkind Cause Fundraise
                                        </h4>
                                        <input 
                                            type="checkbox" 
                                            checked={isCause} 
                                            onChange={(e) => {
                                                setIsCause(e.target.checked);
                                                if (e.target.checked) setIsVipOnly(false); // mutually exclusive
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Launch a crowdfunding cause with a real-time progress bar. Community donations go directly to your creator balance!
                                    </p>
                                    {isCause && (
                                        <div className="space-y-2 pt-2 border-t border-border">
                                            <div>
                                                <Label className="text-xs font-semibold">Campaign Title</Label>
                                                <Input 
                                                    placeholder="e.g. Clean Water Fund" 
                                                    value={causeTitle} 
                                                    onChange={(e) => setCauseTitle(e.target.value)} 
                                                    className="h-8 text-sm mt-1"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold">Target Goal (Coins)</Label>
                                                <Input 
                                                    type="number" 
                                                    min={100} 
                                                    max={1000000} 
                                                    value={targetCoins} 
                                                    onChange={(e) => setTargetCoins(Math.max(100, parseInt(e.target.value) || 5000))} 
                                                    className="h-8 text-sm mt-1"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    
                    { (newPostContent.trim() || newPostMedia) && (
                        <Button 
                            onClick={() => {
                                handleCreatePost({
                                    isVipOnly,
                                    unlockCoins: isVipOnly ? unlockCoins : undefined,
                                    isCause,
                                    causeTitle: isCause ? (causeTitle || 'Community Cause') : undefined,
                                    targetCoins: isCause ? targetCoins : undefined,
                                });
                                setIsVipOnly(false);
                                setIsCause(false);
                                setCauseTitle('');
                            }} 
                            disabled={isCreatingPost || (isCause && !causeTitle.trim())}
                            className="font-semibold w-20 md:w-24 transition-all bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-md"
                        >
                            {isCreatingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
