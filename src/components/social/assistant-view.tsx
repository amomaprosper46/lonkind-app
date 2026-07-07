'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Newspaper } from 'lucide-react';

// ✅ Separate the runtime execution calls...
import { askAssistant } from '@/ai/flows/assistant';

// ✅ ...from the TypeScript compilation type checking structures!
import type { AssistantOutput } from '@/ai/flows/assistant';

import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDoc, collection, serverTimestamp, query, where, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function AssistantView() {
    const [user] = useAuthState(auth);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<AssistantOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAskAssistant = async () => {
        if (!question.trim()) return;
        setIsLoading(true);
        setAnswer(null);
        try {
            const result = await askAssistant({ question });
            setAnswer(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not get an answer from the assistant.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        Lonki AI
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Active Now
                        </span>
                    </CardTitle>
                    <CardDescription>Ask Lonki a question or get help navigating Lonkind.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="e.g., How does photosynthesis work?"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAskAssistant()}
                            disabled={isLoading}
                        />
                        <Button onClick={handleAskAssistant} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        </Button>
                    </div>
                    {isLoading && (
                         <div className="flex justify-center items-center py-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        </div>
                    )}
                    {answer && (
                        <Card className="bg-muted p-4">
                            <p>{answer.answer}</p>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}