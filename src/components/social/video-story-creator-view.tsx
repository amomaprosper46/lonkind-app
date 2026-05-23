'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Share } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateVideoStory, GenerateVideoStoryOutput } from '@/ai/flows/generate-video-story';
import { createVideoPost } from '@/ai/flows/create-video-post';
import { PulseLoader } from 'react-spinners';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export default function VideoStoryCreatorView() {
    const [user] = useAuthState(auth);
    const [prompt, setPrompt] = useState('A tiny robot explorer discovers a giant, glowing flower in a mysterious cave. The robot cautiously approaches the flower, which pulses with gentle light. The robot reaches out a small metal hand to touch a petal, and the whole cave brightens, revealing ancient, sparkling crystals on the walls.');
    const [storyData, setStoryData] = useState<GenerateVideoStoryOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setStoryData(null);
        try {
            const result = await generateVideoStory({ story: prompt });
            setStoryData(result);
        } catch (error: any) {
            console.error(error);
            toast({ 
                variant: 'destructive', 
                title: 'Story Generation Failed', 
                description: `Could not generate the video story. This is a very resource-intensive process and may fail under high demand. Please try again in a few minutes. Error: ${error.message}`
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePostToFeed = async () => {
        if (!storyData || !storyData.videoUrl || !user) return;
        setIsPosting(true);
        try {
             await createVideoPost({
                story: prompt,
                videoDataUri: storyData.videoUrl,
                authorUid: user.uid,
            });
            toast({
                title: "Story Posted!",
                description: "Your video story has been shared to your feed.",
            });
            setStoryData(null); // Clear the video after posting
        } catch (error: any) {
            console.error(error);
            toast({ 
                variant: 'destructive', 
                title: 'Posting Failed', 
                description: `Could not post your video story. Please try again. Error: ${error.message}`
            });
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>AI Video Story Creator</CardTitle>
                <CardDescription>Write a short story, and the AI Director will turn it into a video with sound.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Textarea 
                    placeholder="Write your story here..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    disabled={isLoading || isPosting}
                />
                <Button onClick={handleGenerate} disabled={isLoading || isPosting} className="w-full">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Wand2 className="mr-2 h-5 w-5" /> Generate Video Story</>}
                </Button>

                {isLoading && (
                     <div className="aspect-video w-full flex flex-col items-center justify-center bg-muted text-center p-4 rounded-lg">
                        <PulseLoader color="hsl(var(--primary))" loading={true} size={15} />
                        <p className="mt-6 text-muted-foreground font-semibold">The AI Director is at work...</p>
                        <p className="text-sm text-muted-foreground">Generating video with sound. This can take up to a minute.</p>
                    </div>
                )}
                
                {storyData && (
                     <div className="space-y-4">
                        <div className="relative aspect-video w-full rounded-lg bg-black overflow-hidden border">
                           <video
                                key={storyData.videoUrl}
                                src={storyData.videoUrl}
                                controls
                                autoPlay
                                loop
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <Button onClick={handlePostToFeed} disabled={isPosting || isLoading} className="w-full">
                            {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share className="mr-2 h-4 w-4" />}
                            Post to Feed
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
