'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Minus, Send, Loader2, Maximize2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { cn } from '@/lib/utils';
import { useDockedChat, DockedChat } from './docked-chat-context';
import { sendPushNotification } from '@/app/actions/sendNotification';

interface Message {
    id: string;
    senderId: string;
    text?: string;
    type: 'text' | 'audio';
    timestamp: any;
}

export default function DockedChatWindow({ chat }: { chat: DockedChat }) {
    const { closeChat, toggleMinimize } = useDockedChat();
    const [user] = useAuthState(auth);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, chat.isMinimized]);

    // Find existing conversation
    useEffect(() => {
        if (!user) return;
        
        const findConversation = async () => {
            const conversationsRef = collection(db, 'conversations');
            const q = query(conversationsRef, where('participantUids', 'array-contains', user.uid));
            const snapshot = await getDocs(q);
            
            for (const doc of snapshot.docs) {
                const uids = doc.data().participantUids as string[];
                if (uids.includes(chat.contactId)) {
                    setConversationId(doc.id);
                    return;
                }
            }
        };
        findConversation();
    }, [user, chat.contactId]);

    // Listen to messages
    useEffect(() => {
        if (!conversationId) return;

        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [conversationId]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !user) return;
        
        setIsSending(true);
        let currentConvoId = conversationId;

        try {
            // Create conversation if it doesn't exist
            if (!currentConvoId) {
                const newConvoRef = await addDoc(collection(db, 'conversations'), {
                    participantUids: [user.uid, chat.contactId],
                    participants: [
                        { uid: user.uid, name: user.displayName || 'You', avatarUrl: user.photoURL || '' },
                        { uid: chat.contactId, name: chat.contactName, avatarUrl: chat.contactAvatar }
                    ]
                });
                currentConvoId = newConvoRef.id;
                setConversationId(currentConvoId);
            }

            await addDoc(collection(db, 'conversations', currentConvoId, 'messages'), {
                senderId: user.uid,
                text: newMessage,
                type: 'text',
                timestamp: serverTimestamp(),
            });
            
            setNewMessage('');
            
            sendPushNotification(
                chat.contactId,
                `${user.displayName || 'Someone'} sent you a message`,
                newMessage.length > 50 ? newMessage.substring(0, 50) + '...' : newMessage
            ).catch(err => console.error("Push Notification error:", err));
            
        } catch(e) {
            console.error("Error sending message: ", e);
        } finally {
            setIsSending(false);
        }
    };

    if (chat.isMinimized) {
        return (
            <div 
                className="w-[280px] bg-background border border-border shadow-lg rounded-t-xl overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleMinimize(chat.contactId)}
            >
                <div className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar className="h-6 w-6 border">
                            <AvatarImage src={chat.contactAvatar} />
                            <AvatarFallback>{chat.contactName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-sm truncate">{chat.contactName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-foreground" onClick={(e) => { e.stopPropagation(); closeChat(chat.contactId); }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className="w-[320px] h-[400px] flex flex-col shadow-2xl border-border rounded-t-xl rounded-b-none overflow-hidden bg-background">
            {/* Header */}
            <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-muted/20 cursor-pointer" onClick={() => toggleMinimize(chat.contactId)}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="relative">
                        <Avatar className="h-8 w-8 border">
                            <AvatarImage src={chat.contactAvatar} />
                            <AvatarFallback>{chat.contactName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                    </div>
                    <span className="font-semibold text-sm truncate hover:underline cursor-pointer">{chat.contactName}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-foreground" onClick={(e) => { e.stopPropagation(); toggleMinimize(chat.contactId); }}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-foreground" onClick={(e) => { e.stopPropagation(); closeChat(chat.contactId); }}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-muted/5">
                <ScrollArea className="flex-1 p-3">
                    <div className="flex flex-col gap-3 min-h-full justify-end">
                        {!conversationId && (
                            <div className="text-center text-xs text-muted-foreground my-4">
                                Say hi to {chat.contactName}!
                            </div>
                        )}
                        {messages.map((msg) => {
                            const isMine = msg.senderId === user?.uid;
                            return (
                                <div key={msg.id} className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm",
                                        isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                                    )}>
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-2 border-t bg-background">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input
                            placeholder="Aa"
                            className="rounded-full bg-muted/50 border-transparent focus-visible:ring-0 h-9"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-primary hover:text-primary hover:bg-primary/10" disabled={isSending || !newMessage.trim()}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
}
