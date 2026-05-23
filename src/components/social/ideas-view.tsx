
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lightbulb, ThumbsUp, ThumbsDown } from 'lucide-react';
import { generateIdeas } from '@/ai/flows/generate-ideas';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';

interface IdeaWithVotes {
  text: string;
  votes: number;
}

export default function IdeasView() {
    const [topic, setTopic] = useState('Renewable Energy');
    const [keywords, setKeywords] = useState('solar, community, affordable');
    const [ideas, setIdeas] = useState<IdeaWithVotes[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [userVotes, setUserVotes] = useState<Map<number, 'up' | 'down'>>(new Map());

    const handleGenerateIdeas = async () => {
        setIsLoading(true);
        setIdeas(null);
        setUserVotes(new Map()); // Reset votes on new generation
        try {
            const result = await generateIdeas({ topic, keywords });
            const ideasWithVotes = result.ideas.map(idea => ({ text: idea, votes: 0 }));
            setIdeas(ideasWithVotes);
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
            // Un-voting
            idea.votes += (voteType === 'up' ? -1 : 1);
            newVotes.delete(index);
        } else if (currentVote) {
            // Changing vote from up to down or vice-versa
            idea.votes += (voteType === 'up' ? 2 : -2);
            newVotes.set(index, voteType);
        } else {
            // New vote
            idea.votes += (voteType === 'up' ? 1 : -1);
            newVotes.set(index, voteType);
        }
        
        setIdeas(newIdeas);
        setUserVotes(newVotes);
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
            <Button onClick={handleGenerateIdeas} disabled={isLoading} className="w-full">
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
                        {ideas.map((idea, index) => (
                            <Card key={index} className="p-4 flex justify-between items-center bg-muted/50">
                                <p className="flex-1 pr-4">{idea.text}</p>
                                <div className="flex items-center gap-1">
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
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
