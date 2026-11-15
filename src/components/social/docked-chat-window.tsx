'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Minus, Send, Loader2, Mic, Square } from 'lucide-react';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { cn } from '@/lib/utils';
import { useDockedChat, DockedChat } from './docked-chat-context';
import { sendPushNotification } from '@/app/actions/sendNotification';
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';
import { CallButton } from './CallButton';
import { toast } from '@/hooks/use-toast';

interface Message {
    id: string;
    senderId: string;
    text?: string;
    audioUrl?: string;
    imageUrl?: string;
    type: 'text' | 'audio' | 'image';
    timestamp: any;
}

export default function DockedChatWindow({ chat }: { chat: DockedChat }) {
    const { closeChat, toggleMinimize } = useDockedChat();
    const [user] = useAuthState(auth);
    const liveContact = useLiveUserProfile(chat.contactId, chat.contactAvatar, chat.contactName);
    const contactName = liveContact.name || chat.contactName;
    const contactAvatar = liveContact.avatarUrl || chat.contactAvatar;
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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

    const ensureConversation = async (): Promise<string | null> => {
        if (conversationId) return conversationId;
        if (!user) return null;
        const newConvoRef = await addDoc(collection(db, 'conversations'), {
            participantUids: [user.uid, chat.contactId],
            participants: [
                { uid: user.uid, name: user.displayName || 'You', avatarUrl: user.photoURL || '' },
                { uid: chat.contactId, name: contactName, avatarUrl: contactAvatar },
            ],
        });
        setConversationId(newConvoRef.id);
        return newConvoRef.id;
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !user) return;
        
        setIsSending(true);
        try {
            const currentConvoId = await ensureConversation();
            if (!currentConvoId) return;

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

    const toggleVoiceNoteRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            const chunks: Blob[] = [];

            recorder.ondataavailable = (ev) => {
                if (ev.data && ev.data.size > 0) chunks.push(ev.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                if (chunks.length === 0 || !user) return;
                setIsSending(true);
                try {
                    const currentConvoId = await ensureConversation();
                    if (!currentConvoId) return;
                    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                    const storageRef = ref(storage, `audio_messages/${currentConvoId}/${Date.now()}.webm`);
                    const snap = await uploadBytes(storageRef, blob);
                    const audioUrl = await getDownloadURL(snap.ref);

                    await addDoc(collection(db, 'conversations', currentConvoId, 'messages'), {
                        senderId: user.uid,
                        audioUrl,
                        type: 'audio',
                        timestamp: serverTimestamp(),
                    });

                    sendPushNotification(
                        chat.contactId,
                        `${user.displayName || 'Someone'} sent you a voice note`,
                        '🎙️ New voice note received.'
                    ).catch(() => {});
                } catch (err) {
                    toast({ variant: 'destructive', title: 'Voice Note Error', description: 'Could not send voice note.' });
                } finally {
                    setIsSending(false);
                }
            };

            recorder.start();
            setIsRecording(true);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Mic Access Denied', description: 'Allow microphone access to record voice notes.' });
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
                            <AvatarImage src={contactAvatar} />
                            <AvatarFallback>{contactName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-sm truncate">{contactName}</span>
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
        <Card className="w-[330px] h-[420px] flex flex-col shadow-2xl border-border rounded-t-xl rounded-b-none overflow-hidden bg-background">
            {/* Header */}
            <CardHeader className="p-2.5 border-b flex flex-row items-center justify-between bg-muted/20 cursor-pointer" onClick={() => toggleMinimize(chat.contactId)}>
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                    <div className="relative shrink-0">
                        <Avatar className="h-8 w-8 border">
                            <AvatarImage src={contactAvatar} />
                            <AvatarFallback>{contactName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                    </div>
                    <span className="font-semibold text-sm truncate hover:underline cursor-pointer">{contactName}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <CallButton
                        targetUserId={chat.contactId}
                        targetUserName={contactName}
                        targetUserAvatar={contactAvatar}
                        conversationId={conversationId}
                        compact
                    />
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
                                Say hi to {contactName}!
                            </div>
                        )}
                        {messages.map((msg) => {
                            const isMine = msg.senderId === user?.uid;
                            return (
                                <div key={msg.id} className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[82%] rounded-2xl px-3 py-1.5 text-sm",
                                        isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                                    )}>
                                        {msg.type === 'audio' && msg.audioUrl ? (
                                            <div className="flex flex-col gap-1 min-w-[180px]">
                                                <span className="text-[10px] font-bold opacity-80">🎙️ Voice Note</span>
                                                <audio controls src={msg.audioUrl} className="h-8 w-full" />
                                            </div>
                                        ) : msg.type === 'image' && msg.imageUrl ? (
                                            <img src={msg.imageUrl} alt="Chat photo" className="max-h-40 rounded-lg object-cover" />
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-2 border-t bg-background">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
                        <Input
                            placeholder={isRecording ? "Recording voice note..." : "Aa"}
                            disabled={isRecording || isSending}
                            className="rounded-full bg-muted/50 border-transparent focus-visible:ring-0 h-9 text-xs"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant={isRecording ? "destructive" : "ghost"}
                            onClick={toggleVoiceNoteRecording}
                            disabled={isSending}
                            title={isRecording ? "Stop & Send Voice Note" : "Record Voice Note"}
                            className="h-8 w-8 shrink-0 rounded-full"
                        >
                            {isRecording ? <Square className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-4 w-4 text-indigo-400" />}
                        </Button>
                        <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-primary hover:text-primary hover:bg-primary/10" disabled={isSending || !newMessage.trim()}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
}
