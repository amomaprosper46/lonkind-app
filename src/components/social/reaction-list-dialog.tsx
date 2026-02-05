
'use client';

import React, { useState, useEffect } from 'react';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Loader2, ThumbsUp, Heart, Smile, Frown } from 'lucide-react';
import Link from 'next/link';
import type { ReactionType } from './post-card';

interface Reaction {
    id: string;
    type: ReactionType;
    user: {
        uid: string;
        name: string;
        handle: string;
        avatarUrl: string;
    };
    timestamp: Timestamp;
}

interface ReactionListDialogProps {
    postId: string;
    open: boolean;
}

const reactionMeta: { [key in ReactionType]: { icon: React.ElementType, title: string } } = {
    like: { icon: ThumbsUp, title: 'Likes' },
    love: { icon: Heart, title: 'Loves' },
    laugh: { icon: Smile, title: 'Laughs' },
    sad: { icon: Frown, title: 'Sads' },
};

export default function ReactionListDialog({ postId, open }: ReactionListDialogProps) {
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (open && postId) {
            setIsLoading(true);
            const reactionsRef = collection(db, 'posts', postId, 'reactions');
            const q = query(reactionsRef, orderBy('timestamp', 'desc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const reactionList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reaction));
                setReactions(reactionList);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching reactions:", error);
                setIsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [postId, open]);

    const groupedReactions = reactions.reduce((acc, reaction) => {
        (acc[reaction.type] = acc[reaction.type] || []).push(reaction);
        return acc;
    }, {} as Record<ReactionType, Reaction[]>);
    
    const reactionTypesPresent = Object.keys(groupedReactions) as ReactionType[];

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Reactions</DialogTitle>
            </DialogHeader>
            {isLoading ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : reactionTypesPresent.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground">No reactions yet.</div>
            ): (
                <Tabs defaultValue={reactionTypesPresent[0]} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        {reactionTypesPresent.map(type => {
                             const Icon = reactionMeta[type].icon;
                             return (
                                <TabsTrigger key={type} value={type}>
                                    <Icon className="h-4 w-4 mr-2" />
                                    {reactionMeta[type].title}
                                </TabsTrigger>
                            )
                        })}
                    </TabsList>
                    {reactionTypesPresent.map(type => (
                        <TabsContent key={type} value={type}>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto p-1">
                                {groupedReactions[type].map(reaction => (
                                     <div key={reaction.id} className="flex items-center justify-between">
                                        <Link href={`/profile/${reaction.user.handle}`} className="flex items-center gap-3 group">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={reaction.user.avatarUrl} alt={reaction.user.name} data-ai-hint="user avatar" />
                                                <AvatarFallback>{reaction.user.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold group-hover:underline">{reaction.user.name}</p>
                                                <p className="text-sm text-muted-foreground">@{reaction.user.handle}</p>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </DialogContent>
    );
}
