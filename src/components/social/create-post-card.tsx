
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
        <Card className="mb-8">
            <CardContent className="p-4">
                <div className="flex gap-4">
                    <Avatar>
                        <AvatarImage src={currentUser.avatarUrl} alt="My Avatar" data-ai-hint="user avatar" />
                        <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="w-full">
                        <Textarea
                            placeholder="What's on your mind?"
                            className="mb-2"
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            disabled={isCreatingPost}
                        />
                        {newPostMedia && (
                            <div className="relative mt-2 border rounded-lg overflow-hidden">
                                {newPostMedia.type === 'image' ? (
                                    <img src={newPostMedia.url} alt="Preview" className="w-full h-auto" data-ai-hint="new post image preview" />
                                ) : (
                                    <video src={newPostMedia.url} controls className="w-full h-auto" data-ai-hint="new post video preview" />
                                )}
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7"
                                    onClick={() => setNewPostMedia(null)}
                                    disabled={isCreatingPost}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <div className="flex justify-between items-center mt-2">
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={mediaInputRef}
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    accept="image/*,video/*"
                                    disabled={isCreatingPost}
                                />
                                <Button variant="outline" size="sm" onClick={() => mediaInputRef.current?.click()} disabled={isCreatingPost}>
                                    <Paperclip className="mr-2 h-4 w-4" />
                                    Add Media
                                </Button>
                            </div>
                            <Button onClick={handleCreatePost} disabled={isCreatingPost || (!newPostContent.trim() && !newPostMedia)}>
                                {isCreatingPost ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Post
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
