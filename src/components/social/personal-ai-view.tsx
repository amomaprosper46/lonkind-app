
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, BrainCircuit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { askPersonalAi, PersonalAiOutput } from '@/ai/flows/personal-ai';

export default function PersonalAiView() {
    const [question, setQuestion] = useState('What is the purpose of the social-dashboard.tsx component?');
    const [answer, setAnswer] = useState<PersonalAiOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleAsk = async () => {
        if (!question.trim()) return;
        setIsLoading(true);
        setAnswer(null);
        try {
            const result = await askPersonalAi({ question });
            setAnswer(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not get an answer from the AI.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Personal Project AI</CardTitle>
                <CardDescription>Ask your specialized AI assistant questions about the Lonkind project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex gap-2">
                    <Input 
                        placeholder="e.g., How does the friend model work?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                        disabled={isLoading}
                    />
                    <Button onClick={handleAsk} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />}
                    </Button>
                </div>

                {isLoading && (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                )}

                {answer && (
                     <Card className="bg-muted p-4 mt-4">
                        <p className="whitespace-pre-wrap">{answer.answer}</p>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}

    