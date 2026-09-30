'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, MessageSquare, Loader2, Copy, Check, Mic, Square, Trash2, ChevronLeft, BadgeCheck, Star, Heart, Medal } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, onSnapshot, doc, addDoc, serverTimestamp, orderBy, limit, getDoc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
// duplicate arrayUnion import removed
import { CallButton } from '@/components/social/CallButton';
import { initUserKeys, encryptMessage, decryptMessage, getPublicKey } from '@/lib/e2ee';
import { cn } from '@/lib/utils';
import { sendPushNotification } from '@/app/actions/sendNotification';
import Link from 'next/link';
import { MessageActionMenu } from '@/components/social/MessageActionMenu';
import { useLongPress } from '@/hooks/useLongPress';

const conversationsRef = collection(db, 'conversations');

export interface Conversation {
    id: string;
    participants: { uid: string; name: string; avatarUrl: string; handle?: string; isProfessional?: boolean; badges?: string[]; }[];
    participantUids: string[];
    lastMessage: { text?: string; type: 'text' | 'audio', timestamp: any;
    deletedFor?: string[]; } | null;
    unreadCount?: number; 
    typingIndicator?: { [key: string]: boolean };
}

interface Message {
    id: string;
    senderId: string;
    text?: string;
    audioUrl?: string;
    type: 'text' | 'audio';
    timestamp: any;
}

interface MessagingViewProps {
    initialConversationId?: string;
    currentUser?: any;
}


function MessageBubble({ msg, user, setSelectedMessage, setActionMenuOpen, handleCopyMessage, copiedMessageId }: any) {
  const isOwn = msg.senderId === user?.uid;
  const longPressHandlers = useLongPress(() => {
    setSelectedMessage(msg);
    setActionMenuOpen(true);
  }, 3000);

  return (
    <div className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`} {...longPressHandlers}>
      {msg.senderId !== user?.uid && msg.type === 'text' && (
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyMessage(msg.text, msg.id)}>
          {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
      <div className={cn(
        `max-w-xs lg:max-w-md p-3 rounded-xl ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-background shadow-sm'} ${msg.type === 'audio' ? 'p-2' : ''}`
      )}>
        {msg.type === 'text' ? (
          <p>{msg.text}</p>
        ) : (
          <audio controls src={msg.audioUrl} className="h-10" />
        )}
        {msg.timestamp && (
          <p className={`text-xs mt-1 text-right ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {'editedAt' in msg && (
          <p className="text-xs text-muted-foreground italic">(edited)</p>
        )}
      </div>
      {isOwn && msg.type === 'text' && (
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyMessage(msg.text, msg.id)}>
          {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

export default function MessagingView({ initialConversationId }: MessagingViewProps) {
    const [user, loadingAuth] = useAuthState(auth);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [actionMenuOpen, setActionMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!user) return;

        if (user) {
        initUserKeys(user.uid, db).catch(console.error);
      }
        const q = query(conversationsRef, where('participantUids', 'array-contains', user.uid));

        let messageUnsubscribes: (() => void)[] = [];

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            messageUnsubscribes.forEach(unsub => unsub());
            messageUnsubscribes = [];

            if (querySnapshot.empty) {
                setConversations([]);
                setIsLoading(false);
                return;
            }

            const convosMap = new Map<string, Conversation>();
            let pendingUpdates = querySnapshot.docs.length;

            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                
                let participants = data.participants || [];
                if (participants.length === 0 && data.participantUids) {
                    for (const uid of data.participantUids) {
                        if (uid === user.uid) {
                            participants.push({ uid, name: user.displayName || 'You', avatarUrl: user.photoURL || '' });
                        } else {
                            try {
                                const userDoc = await getDoc(doc(db, 'users', uid));
                                if (userDoc.exists()) {
                                    const ud = userDoc.data();
                                    participants.push({ uid, name: ud.name || 'Unknown', avatarUrl: ud.avatarUrl || '', isProfessional: ud.isProfessional, badges: ud.badges });
                                } else {
                                    participants.push({ uid, name: 'Unknown', avatarUrl: '' });
                                }
                            } catch (e) {
                                console.error('Error fetching participant profile', e);
                            }
                        }
                    }
                }

                const convoBase: Conversation = {
                    id: docSnap.id,
                    participants,
                    participantUids: data.participantUids,
                    lastMessage: null,
                    typingIndicator: data.typingIndicator || {},
                };
                convosMap.set(docSnap.id, convoBase);

                const lastMessageQuery = query(collection(db, 'conversations', docSnap.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
                
                const unsubMsg = onSnapshot(lastMessageQuery, (lastMessageSnapshot) => {
                    const lastMessage = lastMessageSnapshot.empty ? null : lastMessageSnapshot.docs[0].data();
                    
                    const updatedConvo: Conversation = {
                        ...convosMap.get(docSnap.id)!,
                        lastMessage: lastMessage ? { 
                            text: lastMessage.text, 
                            type: lastMessage.type || 'text', 
                            timestamp: lastMessage.timestamp 
                        } : { text: 'No messages yet', type: 'text', timestamp: null },
                    };
                    
                    convosMap.set(docSnap.id, updatedConvo);
                    
                    const newConversationsList = Array.from(convosMap.values()).sort((a, b) => {
                        const timeA = a.lastMessage?.timestamp?.toMillis() || 0;
                        const timeB = b.lastMessage?.timestamp?.toMillis() || 0;
                        return timeB - timeA;
                    });
                    
                    setConversations(newConversationsList);

                    if (pendingUpdates > 0) {
                        pendingUpdates--;
                        if (pendingUpdates === 0) {
                            if (initialConversationId) {
                                const convoToSelect = newConversationsList.find(c => c.id === initialConversationId);
                                if (convoToSelect) {
                                    setSelectedConversation(convoToSelect);
                                }
                            }
                            setIsLoading(false);
                        }
                    }
                }, (error) => {
                    console.error('Error fetching last message:', error);
                    if (pendingUpdates > 0) {
                        pendingUpdates--;
                        if (pendingUpdates === 0) {
                            setIsLoading(false);
                        }
                    }
                });

                messageUnsubscribes.push(unsubMsg);
            }
        });

        return () => {
            unsubscribe();
            messageUnsubscribes.forEach(unsub => unsub());
        };
    }, [user, initialConversationId]);

    // Duplicate long‑press state removed – already defined earlier

    // Decrypt incoming messages
    useEffect(() => {
        if (!selectedConversation) return;
        const messagesRef = collection(db, 'conversations', selectedConversation.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const rawMsgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            // Decrypt text messages
            const decryptedMsgs = await Promise.all(
                rawMsgs.map(async (msg) => {
                    if (msg.type === 'text' && msg.text) {
                        try {
                            const otherUid = msg.senderId === user?.uid ? selectedConversation.participantUids.find(id => id !== user?.uid) : msg.senderId;
                            const pubKey = await getPublicKey(otherUid!);
                            const plain = await decryptMessage(msg.text, pubKey);
                            return { ...msg, text: plain };
                        } catch (e) {
                            console.error('Decryption failed', e);
                            return msg;
                        }
                    }
                    return msg;
                })
            );
            setMessages(decryptedMsgs);
        });

        return () => unsubscribe();
    }, [selectedConversation, user]);

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
    };
    
    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        if (!selectedConversation || !user) return;

        updateDoc(doc(db, 'conversations', selectedConversation.id), {
            [`typingIndicator.${user.uid}`]: true
        }).catch(console.error);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            updateDoc(doc(db, 'conversations', selectedConversation.id), {
                [`typingIndicator.${user.uid}`]: false
            }).catch(console.error);
        }, 2000);
    };

    
    const handleEditMessage = (msg: any) => {
        if (msg.senderId !== user?.uid) return;
        setEditingMessageId(msg.id);
        setNewMessage(msg.text || '');
    };

    const handleDeleteMessageForMe = async (msgId: string) => {
        if (!selectedConversation) return;
        try {
            const msgRef = doc(db, 'conversations', selectedConversation.id, 'messages', msgId);
            await updateDoc(msgRef, {
                deletedFor: arrayUnion(user?.uid)
            });
        } catch(e) { console.error('Error deleting for me:', e); }
    };

    const handleDeleteMessageForAll = async (msgId: string) => {
        if (!selectedConversation) return;
        try {
            const msgRef = doc(db, 'conversations', selectedConversation.id, 'messages', msgId);
            await deleteDoc(msgRef);
        } catch(e) { console.error('Error deleting for all:', e); }
    };

const handleSendMessage = async () => {
        if (!newMessage.trim() || !user || !selectedConversation) return;
        
        setIsSending(true);
        
        try {
            const encryptionRecipientUid = selectedConversation.participantUids.find(id => id !== user.uid);
            let encryptedText = newMessage;
            if (encryptionRecipientUid) {
                const recipientPublicKeyHex = await getPublicKey(encryptionRecipientUid, db);
                if (recipientPublicKeyHex) {
                    encryptedText = await encryptMessage(newMessage, recipientPublicKeyHex);
                }
            }
            if (editingMessageId) {
                await updateDoc(doc(db, 'conversations', selectedConversation.id, 'messages', editingMessageId), {
                    text: encryptedText,
                    editedAt: serverTimestamp(),
                });
                setEditingMessageId(null);
            } else {
                await addDoc(collection(db, 'conversations', selectedConversation.id, 'messages'), {
                    senderId: user.uid,
                    text: encryptedText,
                    type: 'text',
                    timestamp: serverTimestamp(),
                });
            }
            
            // Clear typing state immediately
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            updateDoc(doc(db, 'conversations', selectedConversation.id), {
                [`typingIndicator.${user.uid}`]: false
            }).catch(console.error);

            setNewMessage('');
            
            const recipientUid = selectedConversation.participantUids.find(id => id !== user.uid);
            if (recipientUid) {
                 sendPushNotification(
                     recipientUid,
                     `${user.displayName || 'Someone'} sent you a message`,
                     newMessage.length > 50 ? newMessage.substring(0, 50) + '...' : newMessage,
                     { url: `/?view=messages&conversationId=${selectedConversation.id}`, type: 'new_message', conversationId: selectedConversation.id }
                 ).catch(console.error);
            }
            
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

            const recipientUid = selectedConversation.participantUids.find(id => id !== user.uid);
            if (recipientUid) {
                 sendPushNotification(
                     recipientUid,
                     `${user.displayName || 'Someone'} sent you a voice message`,
                     '🎙️ New voice message received.',
                     { url: `/?view=messages&conversationId=${selectedConversation.id}`, type: 'new_message', conversationId: selectedConversation.id }
                 ).catch(console.error);
            }

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
            setTimeout(() => setCopiedMessageId(null), 2000);
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
        return convo.lastMessage.text || "";
    }

    return (
        <main className="col-span-9">
            <Card className="h-[calc(100vh-10rem)] flex overflow-hidden">
                {/* Conversation List */}
                <div className={cn("border-r flex flex-col transition-all", selectedConversation ? "hidden md:flex md:w-1/3" : "w-full md:w-1/3")}>
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
                                    className={`flex items-center p-4 cursor-pointer border-b border-border/50 hover:bg-accent/50 transition-colors ${selectedConversation?.id === convo.id ? 'bg-accent' : ''}`}
                                    onClick={() => handleSelectConversation(convo)}>
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={otherUser.avatarUrl} alt={otherUser.name || 'User'} />
                                        {/* Added optional chaining and fallback character */}
                                        <AvatarFallback>{otherUser.name?.charAt(0) || '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="ml-4 flex-1 overflow-hidden">
                                        <div className="flex justify-between items-center select-none">
                                            <div className="flex items-center gap-1 overflow-hidden">
                                                {otherUser.handle ? (
                                                    <Link href={`/profile/${otherUser.handle}`} className="font-semibold truncate hover:underline" onClick={(e) => e.stopPropagation()}>
                                                        {otherUser.name || 'Unknown'}
                                                    </Link>
                                                ) : (
                                                    <p className="font-semibold truncate">{otherUser.name || 'Unknown'}</p>
                                                )}
                                                {(otherUser.isProfessional || otherUser.handle === 'admin_lonkind') && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                                            </div>
                                            {convo.lastMessage?.timestamp && (
                                                 <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(convo.lastMessage.timestamp.toDate(), { addSuffix: true })}
                                                 </p>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm text-muted-foreground truncate">{lastMessageText(convo)}</p>
                                        </div>
                                    </div>
                                </div>
                            )})
                        )}
                    </ScrollArea>
                </div>

                {/* Chat Window */}
                <div className={cn("flex flex-col bg-secondary/30 transition-all", selectedConversation ? "w-full md:w-2/3" : "hidden md:flex md:w-2/3")}>
                    {selectedConversation ? (
                        <>
                            <CardHeader className="p-4 border-b flex-row items-center gap-4 bg-background">
                                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedConversation(null)}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Avatar>
                                    {getOtherParticipant(selectedConversation)?.handle ? (
                                        <Link href={`/profile/${getOtherParticipant(selectedConversation)?.handle}`}>
                                            <AvatarImage src={getOtherParticipant(selectedConversation)?.avatarUrl} alt={getOtherParticipant(selectedConversation)?.name || 'User'} />
                                            <AvatarFallback>{getOtherParticipant(selectedConversation)?.name?.charAt(0) || '?'}</AvatarFallback>
                                        </Link>
                                    ) : (
                                        <>
                                            <AvatarImage src={getOtherParticipant(selectedConversation)?.avatarUrl} alt={getOtherParticipant(selectedConversation)?.name || 'User'} />
                                            <AvatarFallback>{getOtherParticipant(selectedConversation)?.name?.charAt(0) || '?'}</AvatarFallback>
                                        </>
                                    )}
                                </Avatar>
                                 <div className="flex items-center gap-1 select-none overflow-hidden">
                                    {getOtherParticipant(selectedConversation)?.handle ? (
                                        <Link href={`/profile/${getOtherParticipant(selectedConversation)?.handle}`}>
                                            <h2 className="text-xl font-bold truncate hover:underline">{getOtherParticipant(selectedConversation)?.name || 'Unknown'}</h2>
                                        </Link>
                                    ) : (
                                        <h2 className="text-xl font-bold truncate">{getOtherParticipant(selectedConversation)?.name || 'Unknown'}</h2>
                                    )}
                                     {(getOtherParticipant(selectedConversation)?.isProfessional || getOtherParticipant(selectedConversation)?.handle === 'admin_lonkind') && <BadgeCheck className="h-5 w-5 text-primary shrink-0" />}
                                 </div>
                                 <CallButton targetUserId={getOtherParticipant(selectedConversation)?.uid} />
                            </CardHeader>
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2">
                                                    {messages
                      // Filter out messages the user has deleted
                      .filter(msg => !(msg.deletedFor?.includes(user?.uid)))
                      .map(msg => {
                        return (
                          <MessageBubble
                            key={msg.id}
                            msg={msg}
                            user={user}
                            setSelectedMessage={setSelectedMessage}
                            setActionMenuOpen={setActionMenuOpen}
                            handleCopyMessage={handleCopyMessage}
                            copiedMessageId={copiedMessageId}
                          />
                        );
                      })}
                    {/* Action menu */}
                    <MessageActionMenu
                      isOpen={actionMenuOpen}
                      isSender={selectedMessage?.senderId === user?.uid}
                      onClose={() => setActionMenuOpen(false)}
                      onCopy={() => {
                        if (selectedMessage) {
                          handleCopyMessage(selectedMessage.text!, selectedMessage.id);
                        }
                        setActionMenuOpen(false);
                      }}
                      onDeleteForMe={() => {
                        if (selectedMessage) {
                          handleDeleteMessageForMe(selectedMessage.id);
                        }
                        setActionMenuOpen(false);
                      }}
                      onDeleteForAll={() => {
                        if (selectedMessage) {
                          handleDeleteMessageForAll(selectedMessage.id);
                        }
                        setActionMenuOpen(false);
                      }}
                      onEdit={() => {
                        if (selectedMessage) {
                          handleEditMessage(selectedMessage);
                        }
                        setActionMenuOpen(false);
                      }}
                      onMore={() => {
                        // placeholder for future actions
                        setActionMenuOpen(false);
                      }}
                    />
                                {selectedConversation && user && getOtherParticipant(selectedConversation) && selectedConversation.typingIndicator?.[getOtherParticipant(selectedConversation)!.uid] && (
                                     <div className="flex items-center gap-2 text-muted-foreground p-3 max-w-[80px] bg-background shadow-sm rounded-xl">
                                         <div className="flex space-x-1 mx-auto">
                                           <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                           <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                           <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                         </div>
                                     </div>
                                 )}
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
                                            onChange={handleTyping}
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