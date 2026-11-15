'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lightbulb, ThumbsUp, ThumbsDown, Share2, Check } from 'lucide-react';
import { generateIdeas } from '@/ai/flows/generate-ideas';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { CurrentUser } from '@/components/social/social-dashboard';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface IdeaWithVotes {
  text: string;
  votes: number;
}

export default function IdeasView({ currentUser }: { currentUser: CurrentUser }) {
    const [topic, setTopic] = useState('Renewable Energy');
    const [keywords, setKeywords] = useState('solar, community, affordable');
    const [ideas, setIdeas] = useState<IdeaWithVotes[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [userVotes, setUserVotes] = useState<Map<number, 'up' | 'down'>>(new Map());
    const [sharingIdx, setSharingIdx] = useState<number | null>(null);
    const [sharedIndices, setSharedIndices] = useState<Set<number>>(new Set());

    const handleGenerateIdeas = async () => {
        setIsLoading(true);
        setIdeas(null);
        setUserVotes(new Map());
        setSharedIndices(new Set());
        try {
            const result = await generateIdeas({ userId: currentUser.uid, topic, keywords });
            if (result.success && result.ideas) {
                const ideasWithVotes = result.ideas.map(idea => ({ text: idea, votes: 0 }));
                setIdeas(ideasWithVotes);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message || 'Could not generate ideas.' });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate ideas.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVote = (index: number, voteType: 'up' | 'down') => {
        if (!ideas) return;

        const newIdeas = [...ideas];
        const idea = newIdeas[index];
        const newVotes = new Map(userVotes);
        const currentVote = newVotes.get(index);

        if (currentVote === voteType) {
            idea.votes += (voteType === 'up' ? -1 : 1);
            newVotes.delete(index);
        } else if (currentVote) {
            idea.votes += (voteType === 'up' ? 2 : -2);
            newVotes.set(index, voteType);
        } else {
            idea.votes += (voteType === 'up' ? 1 : -1);
            newVotes.set(index, voteType);
        }
        
        setIdeas(newIdeas);
        setUserVotes(newVotes);
    };

    const handleShareIdeaToFeed = async (ideaText: string, index: number) => {
        if (!currentUser?.uid) return;
        setSharingIdx(index);
        try {
            const content = `💡 Impactful Idea (${topic}):\n\n"${ideaText}"\n\n#ImpactfulIdeas #LonkindAI`;
            await addDoc(collection(db, 'posts'), {
                author: {
                    uid: currentUser.uid,
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    isProfessional: (currentUser as any).isProfessional || false,
                },
                content,
                reactions: {},
                comments: 0,
                hashtags: ['impactfulideas', 'lonkindai'],
                timestamp: serverTimestamp(),
            });
            setSharedIndices((prev) => new Set(prev).add(index));
            toast({
                title: 'Idea Shared to Home Feed!',
                description: 'Your generated idea has been posted to the community feed.',
            });
        } catch (err) {
            console.error('Error posting idea to feed:', err);
            toast({ variant: 'destructive', title: 'Share Failed', description: 'Could not post idea to feed.' });
        } finally {
            setSharingIdx(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-muted-foreground mb-1">Topic</label>
                    <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={isLoading} />
                </div>
                 <div>
                    <label htmlFor="keywords" className="block text-sm font-medium text-muted-foreground mb-1">Keywords</label>
                    <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} disabled={isLoading} />
                </div>
            </div>
            <Button onClick={handleGenerateIdeas} disabled={isLoading} className="w-full rounded-xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lightbulb className="mr-2 h-5 w-5" /> Generate Ideas</>}
            </Button>
            {isLoading && (
                <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            )}
            {ideas && (
                <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-semibold">Generated Ideas:</h3>
                    <div className="space-y-3">
                        {ideas.map((idea, index) => {
                            const isShared = sharedIndices.has(index);
                            return (
                                <Card key={index} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-muted/50 rounded-xl">
                                    <p className="flex-1 pr-2 text-sm sm:text-base">{idea.text}</p>
                                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                        <Button
                                            variant={userVotes.get(index) === 'up' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleVote(index, 'up')}
                                        >
                                            <ThumbsUp className="h-4 w-4" />
                                        </Button>
                                        <span className="font-bold w-6 text-center text-sm">{idea.votes}</span>
                                        <Button
                                            variant={userVotes.get(index) === 'down' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleVote(index, 'down')}
                                        >
                                            <ThumbsDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={isShared ? 'secondary' : 'outline'}
                                            disabled={sharingIdx === index || isShared}
                                            onClick={() => handleShareIdeaToFeed(idea.text, index)}
                                            className="ml-1 rounded-xl text-xs gap-1 font-bold"
                                        >
                                            {sharingIdx === index ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : isShared ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                            ) : (
                                                <Share2 className="h-3.5 w-3.5" />
                                            )}
                                            {isShared ? 'Posted' : 'Post to Feed'}
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
