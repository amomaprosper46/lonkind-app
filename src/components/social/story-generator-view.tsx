
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateStory, GenerateStoryOutput } from '@/ai/flows/generate-story';

export default function StoryGeneratorView() {
    const [prompt, setPrompt] = useState('A brave cat who wants to fly');
    const [story, setStory] = useState<GenerateStoryOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleGenerateStory = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setStory(null);
        try {
            const result = await generateStory({ prompt });
            setStory(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the story.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Story Writer</CardTitle>
                <CardDescription>Let the AI write a short, fun story for you based on a prompt.</CardDescription>
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
                 <Button onClick={handleGenerateStory} disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Wand2 className="mr-2 h-5 w-5" /> Write a Story</>}
                </Button>
                
                 {isLoading && (
                    <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                )}

                {story && (
                     <div className="space-y-2 pt-4">
                         <h3 className="text-lg font-semibold">Your AI-Generated Story:</h3>
                         <Textarea 
                            value={story.story} 
                            readOnly 
                            className="h-48 bg-muted"
                        />
                     </div>
                )}
            </CardContent>
        </Card>
    );
}
