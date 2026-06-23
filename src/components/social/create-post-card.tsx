
'use client';

import React, { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CurrentUser {
    name: string;
    avatarUrl: string;
}

interface NewPostMedia {
    file: File;
    url: string;
    type: 'image' | 'video';
}

interface CreatePostCardProps {
    currentUser: CurrentUser;
    newPostContent: string;
    setNewPostContent: (content: string) => void;
    newPostMedia: NewPostMedia | null;
    setNewPostMedia: (media: NewPostMedia | null) => void;
    handleCreatePost: () => Promise<void>;
    isCreatingPost: boolean;
}

export default function CreatePostCard({ 
    currentUser,
    newPostContent,
    setNewPostContent,
    newPostMedia,
    setNewPostMedia,
    handleCreatePost,
    isCreatingPost 
}: CreatePostCardProps) {
    const mediaInputRef = useRef<HTMLInputElement>(null);

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
                
                <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                    <div className="flex gap-1 w-full justify-around">
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
                            className="flex-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg h-10" 
                            onClick={() => mediaInputRef.current?.click()} 
                            disabled={isCreatingPost}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="mr-2 h-6 w-6 text-green-500">
                                <path d="M20.5 4h-17A1.5 1.5 0 0 0 2 5.5v13A1.5 1.5 0 0 0 3.5 20h17a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 20.5 4zm-11 5.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM4 18l4.5-6 3.5 4.5 4.5-6 3.5 4.5v1.5H4V18z" />
                            </svg>
                            Photo/video
                        </Button>
                    </div>
                    
                    { (newPostContent.trim() || newPostMedia) && (
                        <Button 
                            onClick={handleCreatePost} 
                            disabled={isCreatingPost}
                            className="ml-2 font-semibold w-24 transition-all"
                        >
                            {isCreatingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
