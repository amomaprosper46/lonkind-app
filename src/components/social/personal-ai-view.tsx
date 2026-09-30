'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BrainCircuit, Sparkles, Send, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export default function PersonalAiView() {
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
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
        
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = '48px';
        }
        
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
            // Focus textarea again after sending if on desktop (optional, might pop up keyboard on mobile)
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setQuestion(e.target.value);
        e.target.style.height = '48px'; // Reset height to recalculate
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; // Max height 150px
    };
    
    return (
        <Card className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] lg:h-[700px] border-none shadow-none md:border-solid md:shadow-lg overflow-hidden bg-background md:bg-card">
            {/* Header */}
            <CardHeader className="border-b bg-background/80 backdrop-blur-xl shrink-0 z-10 px-4 py-3 flex flex-row items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <BrainCircuit className="h-5 w-5 text-white animate-pulse" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
                            Lonki AI
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Online & Ready
                        </p>
                    </div>
                </div>
            </CardHeader>

            {/* Chat History */}
            <CardContent className="flex flex-col flex-1 p-0 overflow-hidden relative bg-slate-50 dark:bg-[#0a0a0a]">
                
                <div 
                    ref={scrollRef} 
                    className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
                >
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-sm mx-auto">
                            <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 to-pink-500/20 flex items-center justify-center mb-6 border border-indigo-500/10 shadow-2xl">
                                <Sparkles className="h-10 w-10 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Welcome to Lonki 2.0</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Experience a smarter, faster, and more conversational AI companion. 
                                Ask me anything about the Lonkind platform, content strategy, or just say hello!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 pb-2">
                            <AnimatePresence initial={false}>
                                {messages.map((msg, index) => (
                                    <motion.div 
                                        key={index} 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                        className={cn(
                                            "flex w-full gap-3",
                                            msg.role === 'user' ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        {msg.role === 'model' && (
                                            <Avatar className="h-8 w-8 shrink-0 shadow-sm border border-border/50">
                                                <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
                                                    <BrainCircuit className="h-4 w-4 text-white" />
                                                </div>
                                            </Avatar>
                                        )}
                                        
                                        <div 
                                            className={cn(
                                                "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                                                msg.role === 'user' 
                                                    ? "bg-indigo-600 text-white rounded-tr-sm" 
                                                    : "bg-background border border-border/60 text-foreground rounded-tl-sm"
                                            )}
                                        >
                                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed break-words">{msg.content}</p>
                                        </div>

                                        {msg.role === 'user' && (
                                            <Avatar className="h-8 w-8 shrink-0 shadow-sm border border-border/50">
                                                <AvatarFallback className="bg-slate-800 text-slate-300 text-xs">Me</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Typing Indicator */}
                            {isLoading && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex w-full gap-3 justify-start"
                                >
                                    <Avatar className="h-8 w-8 shrink-0 shadow-sm border border-border/50">
                                        <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
                                            <BrainCircuit className="h-4 w-4 text-white" />
                                        </div>
                                    </Avatar>
                                    <div className="bg-background border border-border/60 rounded-2xl rounded-tl-sm px-4 py-4 flex items-center gap-1.5 shadow-sm h-[46px]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input Dock */}
                <div className="p-3 md:p-4 bg-background/80 backdrop-blur-xl border-t border-border/60 shrink-0">
                    <div className="flex items-end gap-2 max-w-3xl mx-auto relative bg-background border border-border/80 rounded-3xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all">
                        <Textarea 
                            ref={textareaRef}
                            placeholder="Message Lonki... (Shift+Enter for new line)"
                            value={question}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            className="min-h-[44px] max-h-[150px] resize-none border-0 focus-visible:ring-0 bg-transparent py-3 px-4 text-[15px] no-scrollbar shadow-none"
                            rows={1}
                        />
                        <Button 
                            onClick={handleAsk} 
                            disabled={isLoading || !question.trim()}
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            <Send className="h-5 w-5 ml-0.5" />
                        </Button>
                    </div>
                </div>
                
            </CardContent>
        </Card>
    );
}