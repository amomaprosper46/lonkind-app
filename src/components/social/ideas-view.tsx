
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lightbulb } from 'lucide-react';
import { generateIdeas, GenerateIdeasOutput } from '@/ai/flows/generate-ideas';
import { toast } from '@/hooks/use-toast';

export default function IdeasView() {
    const [topic, setTopic] = useState('Renewable Energy');
    const [keywords, setKeywords] = useState('solar, community, affordable');
    const [ideas, setIdeas] = useState<GenerateIdeasOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateIdeas = async () => {
        setIsLoading(true);
        setIdeas(null);
        try {
            const result = await generateIdeas({ topic, keywords });
            setIdeas(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate ideas.' });
        } finally {
            setIsLoading(false);
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
                    <ul className="list-disc list-inside space-y-2">
                        {ideas.ideas.map((idea, index) => (
                            <li key={index} className="p-3 bg-muted rounded-md">{idea}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
