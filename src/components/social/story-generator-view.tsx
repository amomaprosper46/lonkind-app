'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Share2, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateStory, GenerateStoryOutput } from '@/ai/flows/generate-story';
import { CurrentUser } from '@/components/social/social-dashboard';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function StoryGeneratorView({ currentUser }: { currentUser: CurrentUser }) {
    const [prompt, setPrompt] = useState('A brave cat who wants to fly');
    const [story, setStory] = useState<GenerateStoryOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [hasShared, setHasShared] = useState(false);

    const handleGenerateStory = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setStory(null);
        setHasShared(false);
        try {
            const result = await generateStory({ userId: currentUser.uid, prompt });
            setStory(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the story.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareToFeed = async () => {
        if (!story?.story || !currentUser?.uid) return;
        setIsSharing(true);
        try {
            const content = `✨ AI Storyteller: "${prompt.trim()}"\n\n${story.story}\n\n#LonkindAI #Storyteller`;
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
                hashtags: ['lonkindai', 'storyteller'],
                timestamp: serverTimestamp(),
            });
            setHasShared(true);
            toast({
                title: 'Story Published to Home Feed!',
                description: 'Your AI story is now live on the community timeline.',
            });
        } catch (error) {
            console.error('Error sharing story to feed:', error);
            toast({ variant: 'destructive', title: 'Share Failed', description: 'Could not post story to feed.' });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <Card className="rounded-2xl border-border/60 shadow-lg">
            <CardHeader>
                <CardTitle>Story Writer</CardTitle>
                <CardDescription>Let Lonkind AI write an original story from your prompt and share it with the community.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="prompt" className="text-sm font-medium">Your Prompt</label>
                    <Input 
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A robot who falls in love with a toaster"
                        disabled={isLoading}
                    />
                </div>
                <Button onClick={handleGenerateStory} disabled={isLoading} className="w-full rounded-xl font-bold">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Wand2 className="mr-2 h-5 w-5" /> Write a Story</>}
                </Button>
                
                {isLoading && (
                    <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                )}

                {story && (
                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold">Your AI-Generated Story:</h3>
                            <Button
                                size="sm"
                                onClick={handleShareToFeed}
                                disabled={isSharing || hasShared}
                                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5"
                            >
                                {isSharing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : hasShared ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Share2 className="h-4 w-4" />
                                )}
                                {hasShared ? 'Shared to Feed' : 'Share to Home Feed'}
                            </Button>
                        </div>
                        <Textarea 
                            value={story.story} 
                            readOnly 
                            className="h-48 bg-muted rounded-xl"
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
