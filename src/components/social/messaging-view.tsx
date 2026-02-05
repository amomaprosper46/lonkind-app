
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, MessageSquare, Loader2, Copy, Check, Mic, Square, Trash2 } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

export interface Conversation {
    id: string;
    participants: { uid: string; name: string; avatarUrl: string; }[];
    participantUids: string[];
    lastMessage: { text?: string; type: 'text' | 'audio', timestamp: any; } | null;
    unreadCount?: number; 
}

interface Message {
    id: string;
    senderId: string;
    text?: string;
    audioUrl?: string;
    type: 'text' | 'audio';
    timestamp: any;
}

interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
}

interface MessagingViewProps {
    initialConversationId?: string;
}

export default function MessagingView({ initialConversationId }: MessagingViewProps) {
    const [user, loadingAuth] = useAuthState(auth);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    useEffect(() => {
        if (!user) return;

        setIsLoading(true);
        const conversationsRef = collection(db, 'conversations');
        const q = query(conversationsRef, where('participantUids', 'array-contains', user.uid));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const convos: Conversation[] = await Promise.all(
                querySnapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const lastMessageQuery = query(collection(db, 'conversations', doc.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
                    const lastMessageSnapshot = await getDocs(lastMessageQuery);
                    const lastMessage = lastMessageSnapshot.empty ? null : lastMessageSnapshot.docs[0].data();

                    return {
                        id: doc.id,
                        participants: data.participants,
                        participantUids: data.participantUids,
                        lastMessage: lastMessage ? { text: lastMessage.text, type: lastMessage.type || 'text', timestamp: lastMessage.timestamp } : { text: 'No messages yet', type: 'text', timestamp: null },
                    } as Conversation;
                })
            );
            setConversations(convos);

             // If there's an initialConversationId, select it
            if (initialConversationId) {
                const convoToSelect = convos.find(c => c.id === initialConversationId);
                if (convoToSelect) {
                    setSelectedConversation(convoToSelect);
                }
            }

            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, initialConversationId]);

    useEffect(() => {
        if (!selectedConversation) return;

        const messagesRef = collection(db, 'conversations', selectedConversation.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [selectedConversation]);


    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
    };
    
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user || !selectedConversation) return;
        
        setIsSending(true);
        
        try {
            await addDoc(collection(db, 'conversations', selectedConversation.id, 'messages'), {
                senderId: user.uid,
                text: newMessage,
                type: 'text',
                timestamp: serverTimestamp(),
            });
            setNewMessage('');
        } catch(e) {
            console.error("Error sending message: ", e);
        } finally {
            setIsSending(false);
        }
    };
    
    const handleSendAudio = async () => {
        if (!audioBlob || !user || !selectedConversation) return;
        setIsSending(true);
        try {
            const storageRef = ref(storage, `audio_messages/${selectedConversation.id}/${Date.now()}.webm`);
            const snapshot = await uploadBytes(storageRef, audioBlob);
            const downloadURL = await getDownloadURL(snapshot.ref);

             await addDoc(collection(db, 'conversations', selectedConversation.id, 'messages'), {
                senderId: user.uid,
                audioUrl: downloadURL,
                type: 'audio',
                timestamp: serverTimestamp(),
            });

            setAudioBlob(null);
        } catch (e) {
            console.error("Error sending audio message:", e);
            toast({ variant: 'destructive', title: 'Send Failed', description: 'Could not send voice message.' });
        } finally {
            setIsSending(false);
        }
    }

     const handleCopyMessage = (text: string, messageId: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy message to clipboard.' });
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            const audioChunks: Blob[] = [];

            mediaRecorderRef.current.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                setAudioBlob(audioBlob);
                // Stop all tracks on the stream
                 stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            toast({ variant: 'destructive', title: 'Mic Access Denied', description: 'Please allow microphone access to record audio.' });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    if(loadingAuth){
        return (
            <div className="flex col-span-9 items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            </div>
        )
    }
    
    const getOtherParticipant = (convo: Conversation) => {
        return convo.participants.find(p => p.uid !== user?.uid);
    }

    const lastMessageText = (convo: Conversation) => {
        if (!convo.lastMessage) return "No messages yet";
        if (convo.lastMessage.type === 'audio') return "Sent a voice message";
        return convo.lastMessage.text;
    }

    return (
        <main className="col-span-9">
            <Card className="h-[calc(100vh-10rem)] flex">
                {/* Conversation List */}
                <div className="w-1/3 border-r flex flex-col">
                    <CardHeader className="p-4 border-b">
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder="Search messages" className="pl-10" />
                        </div>
                    </CardHeader>
                     <ScrollArea className="flex-1">
                        {isLoading ? (
                            <div className="p-4 space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                                            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : conversations.length === 0 ? (
                             <div className="p-8 text-center text-muted-foreground">
                                <MessageSquare className="h-10 w-10 mx-auto mb-2" />
                                <p>No conversations yet.</p>
                                <p className="text-xs">Start a chat from a user's profile.</p>
                            </div>
                        ) : (
                            conversations.map(convo => {
                                const otherUser = getOtherParticipant(convo);
                                if (!otherUser) return null;

                                return (
                                <div key={convo.id} 
                                    className={`flex items-center p-4 cursor-pointer hover:bg-accent/50 ${selectedConversation?.id === convo.id ? 'bg-accent' : ''}`}
                                    onClick={() => handleSelectConversation(convo)}>
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={otherUser.avatarUrl} alt={otherUser.name} data-ai-hint="user avatar" />
                                        <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="ml-4 flex-1 overflow-hidden">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold truncate">{otherUser.name}</p>
                                            {convo.lastMessage?.timestamp && (
                                                 <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(convo.lastMessage.timestamp.toDate(), { addSuffix: true })}
                                                 </p>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm text-muted-foreground truncate">{lastMessageText(convo)}</p>
                                            {/* Unread count logic would go here */}
                                        </div>
                                    </div>
                                </div>
                            )})
                        )}
                    </ScrollArea>
                </div>

                {/* Chat Window */}
                <div className="w-2/3 flex flex-col bg-secondary/30">
                    {selectedConversation ? (
                        <>
                            <CardHeader className="p-4 border-b flex-row items-center gap-4 bg-background">
                                <Avatar>
                                    <AvatarImage src={getOtherParticipant(selectedConversation)?.avatarUrl} alt={getOtherParticipant(selectedConversation)?.name} data-ai-hint="user avatar" />
                                    <AvatarFallback>{getOtherParticipant(selectedConversation)?.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                 <h2 className="text-xl font-bold">{getOtherParticipant(selectedConversation)?.name}</h2>
                            </CardHeader>
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2">
                                {messages.map(msg => (
                                     <div key={msg.id} className={`group flex items-end gap-2 ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                                        {msg.senderId !== user?.uid && msg.type === 'text' && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyMessage(msg.text!, msg.id)}>
                                                {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        )}
                                        <div className={cn(`max-w-xs lg:max-w-md p-3 rounded-xl`, 
                                          msg.senderId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-background shadow-sm',
                                          msg.type === 'audio' && 'p-2'
                                        )}>
                                            {msg.type === 'text' ? (
                                                <p>{msg.text}</p>
                                            ) : (
                                                <audio controls src={msg.audioUrl} className="h-10"></audio>
                                            )}
                                            {msg.timestamp && (
                                                <p className={`text-xs mt-1 text-right ${msg.senderId === user?.uid ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                    {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                         {msg.senderId === user?.uid && msg.type === 'text' && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyMessage(msg.text!, msg.id)}>
                                                {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                                </div>
                            </ScrollArea>
                            <CardContent className="p-4 border-t bg-background">
                                {isRecording ? (
                                    <div className="flex items-center gap-2">
                                        <Button size="icon" variant="destructive" onClick={stopRecording}>
                                            <Square className="h-5 w-5"/>
                                        </Button>
                                        <div className="flex-1 text-center text-muted-foreground flex items-center justify-center gap-2">
                                           <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                            </span>
                                            Recording...
                                        </div>
                                    </div>
                                ) : audioBlob ? (
                                     <div className="flex items-center gap-2">
                                        <Button size="icon" variant="destructive" onClick={() => setAudioBlob(null)}>
                                            <Trash2 className="h-5 w-5"/>
                                        </Button>
                                        <audio controls src={URL.createObjectURL(audioBlob)} className="flex-1 h-10"></audio>
                                        <Button size="icon" onClick={handleSendAudio} disabled={isSending}>
                                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5"/>}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Type a message..." 
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                                            disabled={isSending}
                                        />
                                        <Button size="icon" onClick={handleSendMessage} disabled={isSending || !newMessage.trim()}>
                                            <Send className="h-5 w-5"/>
                                        </Button>
                                        <Button size="icon" variant="outline" onClick={startRecording}>
                                            <Mic className="h-5 w-5"/>
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
                            <p className="text-muted-foreground mt-4 font-semibold">Select a conversation</p>
                             <p className="text-muted-foreground text-sm">Choose from your existing conversations to start chatting.</p>
                        </div>
                    )}
                </div>
            </Card>
        </main>
    );
}

    
