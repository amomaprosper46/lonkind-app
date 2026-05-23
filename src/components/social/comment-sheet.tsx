
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, BadgeCheck, Languages } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import type { Post } from './post-card';
import Link from 'next/link';
import { translateText } from '@/ai/flows/translate-text';
import { toast } from '@/hooks/use-toast';

interface Comment {
    id: string;
    text: string;
    author: {
        uid: string;
        name: string;
        handle: string;
        avatarUrl: string;
        isProfessional?: boolean;
    };
    timestamp: Timestamp;
}

interface CurrentUser {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    email: string;
}

interface CommentSheetProps {
    post: Post | null;
    onOpenChange: (isOpen: boolean) => void;
    onCommentSubmit: (postId: string, commentText: string) => Promise<boolean>;
    currentUser: CurrentUser;
}

export default function CommentSheet({ post, onOpenChange, onCommentSubmit, currentUser }: CommentSheetProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [translatedComments, setTranslatedComments] = useState<Map<string, string>>(new Map());
    const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);
    const [showOriginalComment, setShowOriginalComment] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (post) {
            setIsLoading(true);
            const commentsRef = collection(db, 'posts', post.id, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'asc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const commentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
                setComments(commentsList);
                setIsLoading(false);
                // Clear translations when post changes
                setTranslatedComments(new Map());
                setShowOriginalComment(new Set());
                setTranslatingCommentId(null);
            });

            return () => unsubscribe();
        }
    }, [post]);
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !post) return;
        
        setIsSubmitting(true);
        const success = await onCommentSubmit(post.id, newComment);
        if(success) {
            setNewComment('');
        }
        setIsSubmitting(false);
    };

    const handleTranslateComment = async (comment: Comment) => {
        const { id, text } = comment;
        if (translatedComments.has(id)) {
            setShowOriginalComment(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) {
                    newSet.delete(id);
                } else {
                    newSet.add(id);
                }
                return newSet;
            });
            return;
        }

        setTranslatingCommentId(id);
        try {
            const result = await translateText({ text });
            setTranslatedComments(prev => new Map(prev).set(id, result.translation));
            setShowOriginalComment(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } catch (error) {
            console.error("Translation error:", error);
            toast({ variant: 'destructive', title: 'Translation Failed', description: 'Could not translate the comment.' });
        } finally {
            setTranslatingCommentId(null);
        }
    };

    const getCommentText = (comment: Comment) => {
        if (showOriginalComment.has(comment.id) || !translatedComments.has(comment.id)) {
            return comment.text;
        }
        return translatedComments.get(comment.id) || comment.text;
    }


    return (
        <Sheet open={!!post} onOpenChange={onOpenChange}>
            <SheetContent className="flex flex-col p-0" side="right">
                {post ? (
                    <>
                        <SheetHeader className="p-6 pb-4 border-b">
                            <SheetTitle>Comments on {post.author.name}'s post</SheetTitle>
                            <SheetDescription>
                                Join the conversation.
                            </SheetDescription>
                        </SheetHeader>

                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-6">
                                {isLoading ? (
                                    <div className="flex justify-center items-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : comments.length > 0 ? (
                                    comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3">
                                            <Link href={`/profile/${comment.author.handle}`}>
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={comment.author.avatarUrl} alt={comment.author.name} data-ai-hint="user avatar" />
                                                    <AvatarFallback>{comment.author.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </Link>
                                            <div className="flex-1">
                                                <div className="bg-muted rounded-lg px-4 py-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-1">
                                                            <Link href={`/profile/${comment.author.handle}`} className="font-semibold text-sm hover:underline">{comment.author.name}</Link>
                                                            {comment.author.isProfessional && <BadgeCheck className="h-4 w-4 text-primary" />}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true }) : ''}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm mt-1 whitespace-pre-wrap">{getCommentText(comment)}</p>
                                                    
                                                     <div className="mt-1">
                                                        {translatingCommentId === comment.id ? (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Loader2 className="h-3 w-3 animate-spin" /> Translating...
                                                            </div>
                                                        ) : (
                                                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => handleTranslateComment(comment)}>
                                                                <Languages className="mr-1 h-3 w-3" />
                                                                {translatedComments.has(comment.id) ? (showOriginalComment.has(comment.id) ? 'Show translation' : 'Show original') : 'Translate'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-muted-foreground py-16">
                                        <p className="font-semibold">No comments yet</p>
                                        <p className="text-sm">Be the first to comment.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-4 bg-background border-t">
                             <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} data-ai-hint="user avatar" />
                                    <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Input 
                                    placeholder="Write a comment..." 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    disabled={isSubmitting}
                                    className="flex-1"
                                />
                                <Button type="submit" size="icon" disabled={isSubmitting || !newComment.trim()}>
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5"/>}
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
