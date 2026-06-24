
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, BrainCircuit, Sparkles, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export default function PersonalAiView() {
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleAsk = async () => {
        const text = question.trim();
        if (!text) return;

        const newMessages = [...messages, { role: 'user' as const, content: text }];
        setMessages(newMessages);
        setQuestion('');
        setIsLoading(true);
        
        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: text,
                    history: messages.map(m => ({
                        role: m.role,
                        content: [{ text: m.content }]
                    }))
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch AI response');
            }

            setMessages([...newMessages, { role: 'model', content: data.answer }]);
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not get an answer from the AI.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card className="flex flex-col h-[calc(100vh-100px)] md:h-[600px] max-h-[800px]">
            <CardHeader className="border-b shrink-0 bg-background/95 backdrop-blur z-10 rounded-t-xl">
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Ask Lonki</CardTitle>
                <CardDescription>Your friendly AI guide for everything Lonkind.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 p-0 overflow-hidden relative">
                
                {/* Chat History Area */}
                <div 
                    ref={scrollRef} 
                    className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                >
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground opacity-60">
                            <BrainCircuit className="h-12 w-12 mb-4 text-primary opacity-50" />
                            <p>I'm Lonki, your platform assistant.</p>
                            <p className="text-sm">Ask me how to tip creators, start a space, or join a group!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div 
                                key={index} 
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div 
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                                            : 'bg-muted border border-border/50 text-foreground rounded-tl-sm shadow-sm'
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="bg-muted border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center shadow-sm">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <span className="ml-2 text-sm text-muted-foreground">Lonki is typing...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-background shrink-0">
                    <div className="flex items-center gap-2 max-w-3xl mx-auto relative">
                        <Input 
                            placeholder="Type a message to Lonki..."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                            disabled={isLoading}
                            className="pr-12 rounded-full h-12 bg-secondary/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
                        />
                        <Button 
                            onClick={handleAsk} 
                            disabled={isLoading || !question.trim()}
                            size="icon"
                            className="absolute right-1.5 h-9 w-9 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                
            </CardContent>
        </Card>
    );
}

    