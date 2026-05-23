
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Newspaper } from 'lucide-react';
import { askAssistant, AssistantOutput } from '@/ai/flows/assistant';
import { generateNewsPost, GenerateNewsPostOutput } from '@/ai/flows/news-reporter';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function AssistantView() {
    const [user] = useAuthState(auth);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<AssistantOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [newsTopic, setNewsTopic] = useState('Technology');
    const [newsPost, setNewsPost] = useState<GenerateNewsPostOutput | null>(null);
    const [isNewsLoading, setIsNewsLoading] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

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

    const handleGenerateNews = async () => {
        setIsNewsLoading(true);
        setNewsPost(null);
        try {
            const result = await generateNewsPost({ topic: newsTopic });
            setNewsPost(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate news post.' });
        } finally {
            setIsNewsLoading(false);
        }
    };

    const handlePostToFeed = async () => {
        if (!newsPost || !user) return;
        setIsPosting(true);
        try {
            const userDocRef = collection(db, 'users');
            const adminUser = await db.collection('users').where('email', '==', 'admin@lonkind.com').limit(1).get();

            if (adminUser.empty) {
                toast({ variant: 'destructive', title: 'Error', description: 'Admin user not found.' });
                return;
            }
            const adminData = adminUser.docs[0].data();

            await addDoc(collection(db, 'posts'), {
                content: newsPost.postContent,
                author: {
                    name: adminData.name,
                    handle: adminData.handle,
                    avatarUrl: adminData.avatarUrl,
                    uid: adminData.uid,
                },
                reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
                comments: 0,
                timestamp: serverTimestamp(),
            });
            toast({ title: 'Posted!', description: 'The news has been posted to the main feed.' });
            setNewsPost(null);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not post to feed.' });
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>AI Assistant</CardTitle>
                    <CardDescription>Ask a question and get a response from the AI.</CardDescription>
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
            <Card>
                <CardHeader>
                    <CardTitle>News Bot</CardTitle>
                    <CardDescription>Generate a news post on a topic and post it to the feed as the admin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Select value={newsTopic} onValueChange={setNewsTopic} disabled={isNewsLoading || isPosting}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a topic" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Technology">Technology</SelectItem>
                                <SelectItem value="World News">World News</SelectItem>
                                <SelectItem value="Science">Science</SelectItem>
                                <SelectItem value="Business">Business</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateNews} disabled={isNewsLoading || isPosting}>
                             {isNewsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Newspaper className="h-5 w-5" />}
                        </Button>
                    </div>
                     {isNewsLoading && (
                         <div className="flex justify-center items-center py-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        </div>
                    )}
                    {newsPost && (
                        <div>
                            <Card className="bg-muted p-4">
                                <p>{newsPost.postContent}</p>
                            </Card>
                            <Button className="w-full mt-4" onClick={handlePostToFeed} disabled={isPosting}>
                                {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Post to Feed
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
