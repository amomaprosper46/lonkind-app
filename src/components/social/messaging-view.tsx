'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, MessageSquare, Loader2, Copy, Check, Mic, Square, Trash2, ChevronLeft, BadgeCheck, Star, Heart, Medal, Globe, Languages, Image as ImageIcon } from 'lucide-react';
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
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';

function ConversationListItem({
    convo,
    otherUser,
    isSelected,
    onSelect,
    lastMessageText,
}: {
    convo: Conversation;
    otherUser: { uid: string; name: string; avatarUrl: string; handle?: string; isProfessional?: boolean; badges?: string[] };
    isSelected: boolean;
    onSelect: (convo: Conversation) => void;
    lastMessageText: (convo: Conversation) => string;
}) {
    const liveOther = useLiveUserProfile(otherUser.uid, otherUser.avatarUrl, otherUser.name, otherUser.handle);
    const displayHandle = liveOther.handle !== 'member' ? liveOther.handle : otherUser.handle;

    return (
        <div
            className={`flex items-center p-4 cursor-pointer border-b border-border/50 hover:bg-accent/50 transition-colors ${isSelected ? 'bg-accent' : ''}`}
            onClick={() => onSelect(convo)}
        >
            <Avatar className="h-12 w-12">
                <AvatarImage src={liveOther.avatarUrl} alt={liveOther.name || 'User'} />
                <AvatarFallback>{liveOther.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="ml-4 flex-1 overflow-hidden">
                <div className="flex justify-between items-center select-none">
                    <div className="flex items-center gap-1 overflow-hidden">
                        {displayHandle ? (
                            <Link href={`/profile/${displayHandle}`} className="font-semibold truncate hover:underline" onClick={(e) => e.stopPropagation()}>
                                {liveOther.name || 'Unknown'}
                            </Link>
                        ) : (
                            <p className="font-semibold truncate">{liveOther.name || 'Unknown'}</p>
                        )}
                        {(liveOther.isProfessional || otherUser.isProfessional || displayHandle === 'admin_lonkind') && (
                            <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                        )}
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
    );
}

function ActiveChatHeader({
    otherUser,
    conversationId,
    onBack,
}: {
    otherUser?: { uid: string; name: string; avatarUrl: string; handle?: string; isProfessional?: boolean; badges?: string[] };
    conversationId?: string;
    onBack: () => void;
}) {
    const liveOther = useLiveUserProfile(otherUser?.uid, otherUser?.avatarUrl, otherUser?.name, otherUser?.handle);
    const displayHandle = liveOther.handle !== 'member' ? liveOther.handle : otherUser?.handle;

    return (
        <CardHeader className="p-4 border-b flex-row items-center justify-between gap-4 bg-background">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="relative shrink-0">
                    <Avatar>
                        {displayHandle ? (
                            <Link href={`/profile/${displayHandle}`}>
                                <AvatarImage src={liveOther.avatarUrl} alt={liveOther.name || 'User'} />
                                <AvatarFallback>{liveOther.name?.charAt(0) || '?'}</AvatarFallback>
                            </Link>
                        ) : (
                            <>
                                <AvatarImage src={liveOther.avatarUrl} alt={liveOther.name || 'User'} />
                                <AvatarFallback>{liveOther.name?.charAt(0) || '?'}</AvatarFallback>
                            </>
                        )}
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" title="Active" />
                </div>
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1 select-none overflow-hidden">
                        {displayHandle ? (
                            <Link href={`/profile/${displayHandle}`}>
                                <h2 className="text-base sm:text-lg font-bold truncate hover:underline">{liveOther.name || 'Unknown'}</h2>
                            </Link>
                        ) : (
                            <h2 className="text-base sm:text-lg font-bold truncate">{liveOther.name || 'Unknown'}</h2>
                        )}
                        {(liveOther.isProfessional || otherUser?.isProfessional || displayHandle === 'admin_lonkind') && (
                            <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                        )}
                    </div>
                    <span className="text-[11px] text-emerald-500 font-medium">Audio & Video Call Ready</span>
                </div>
            </div>
            <CallButton
                targetUserId={otherUser?.uid}
                targetUserName={liveOther.name || otherUser?.name || 'User'}
                targetUserAvatar={liveOther.avatarUrl || otherUser?.avatarUrl || ''}
                conversationId={conversationId}
            />
        </CardHeader>
    );
}

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
    imageUrl?: string;
    audioDurationSec?: number;
    type: 'text' | 'audio' | 'image';
    timestamp: any;
    deletedFor?: string[];
}

interface MessagingViewProps {
    initialConversationId?: string;
    currentUser?: any;
}


function MessageBubble({ msg, user, setSelectedMessage, setActionMenuOpen, handleCopyMessage, copiedMessageId }: any) {
  const isOwn = msg.senderId === user?.uid;
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const longPressHandlers = useLongPress(() => {
    setSelectedMessage(msg);
    setActionMenuOpen(true);
  }, 3000);

  const handleTranslate = async (lang: string = 'English') => {
    const textToTranslate = msg.text || (msg.type === 'audio' ? 'Audio Voice Note' : '');
    if (!textToTranslate) return;

    setIsTranslating(true);
    try {
      const res = await fetch('/api/ai/voice-translator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, targetLanguage: lang }),
      });
      const data = await res.json();
      if (data.success && data.translatedText) {
        setTranslatedText(data.translatedText);
      } else {
        toast({ title: 'Translation Error', description: data.error || 'Failed to translate message', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`} {...longPressHandlers}>
      {!isOwn && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-400 hover:text-indigo-300" onClick={() => handleTranslate('English')} title="Translate with Lonkind AI">
            {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          </Button>
          {msg.type === 'text' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyMessage(msg.text, msg.id)}>
              {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
      <div className={cn(
        `max-w-xs lg:max-w-md p-3 rounded-xl ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-background shadow-sm'} ${msg.type === 'audio' ? 'p-2' : ''}`
      )}>
        {msg.type === 'text' ? (
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        ) : msg.type === 'image' && msg.imageUrl ? (
          <div className="space-y-1.5">
            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={msg.imageUrl}
                alt="Chat attachment"
                className="max-h-64 rounded-lg object-cover border border-border/30"
              />
            </a>
            {msg.text && <p className="text-sm pt-1">{msg.text}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 min-w-[210px] sm:min-w-[240px]">
            <div className="flex items-center justify-between text-[11px] font-bold opacity-90 px-1">
              <span className="inline-flex items-center gap-1">
                <Mic className="h-3.5 w-3.5" /> Voice Note
              </span>
              {typeof msg.audioDurationSec === 'number' && msg.audioDurationSec > 0 && (
                <span>
                  {Math.floor(msg.audioDurationSec / 60)}:
                  {String(msg.audioDurationSec % 60).padStart(2, '0')}
                </span>
              )}
            </div>
            <audio controls src={msg.audioUrl} preload="metadata" className="h-9 w-full rounded-lg" />
          </div>
        )}

        {/* AI Voice Note & Chat Translator Result Banner */}
        {translatedText && (
          <div className="mt-2 pt-2 border-t border-indigo-400/30 text-xs bg-indigo-500/10 p-2 rounded-lg text-indigo-200">
            <div className="flex items-center justify-between font-bold mb-1 text-[10px] text-indigo-400">
              <span className="flex items-center gap-1">✨ Lonkind AI:</span>
              <button onClick={() => setTranslatedText(null)} className="hover:underline text-[9px] opacity-70">Close</button>
            </div>
            <p className="italic">{translatedText}</p>
          </div>
        )}

        {msg.timestamp && (
          <p className={`text-xs mt-1 text-right flex items-center justify-end gap-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            <span>{new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isOwn && (
              <span className="ml-1 inline-flex items-center" title={msg.read ? 'Read' : 'Delivered'}>
                {msg.read ? (
                  <span className="text-emerald-400 font-extrabold text-xs tracking-tighter">✓✓</span>
                ) : (
                  <span className="text-primary-foreground/70 text-xs">✓</span>
                )}
              </span>
            )}
          </p>
        )}
        {'editedAt' in msg && (
          <p className="text-xs text-muted-foreground italic">(edited)</p>
        )}
      </div>
      {isOwn && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-400 hover:text-indigo-300" onClick={() => handleTranslate('English')} title="Translate with Lonkind AI">
            {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          </Button>
          {msg.type === 'text' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyMessage(msg.text, msg.id)}>
              {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>
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
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    
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
                            const pubKey = otherUid ? await getPublicKey(otherUid, db) : null;
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
    
    const handleSendAudioBlob = async (blobToUpload: Blob, durationSec?: number) => {
        if (!blobToUpload || !user || !selectedConversation) return;
        setIsSending(true);
        try {
            const ext = blobToUpload.type.includes('mp4') ? 'm4a' : 'webm';
            const storageRef = ref(storage, `audio_messages/${selectedConversation.id}/${Date.now()}.${ext}`);
            const snapshot = await uploadBytes(storageRef, blobToUpload, {
                contentType: blobToUpload.type || 'audio/webm',
            });
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'conversations', selectedConversation.id, 'messages'), {
                senderId: user.uid,
                audioUrl: downloadURL,
                audioDurationSec: durationSec ?? recordingSeconds,
                type: 'audio',
                timestamp: serverTimestamp(),
            });

            setAudioBlob(null);
            setRecordingSeconds(0);

            const recipientUid = selectedConversation.participantUids.find(id => id !== user.uid);
            if (recipientUid) {
                sendPushNotification(
                    recipientUid,
                    `${user.displayName || 'Someone'} sent you a voice note`,
                    '🎙️ New voice note received.',
                    { url: `/?view=messages&conversationId=${selectedConversation.id}`, type: 'new_message', conversationId: selectedConversation.id }
                ).catch(console.error);
            }
        } catch (e) {
            console.error("Error sending audio message:", e);
            toast({ variant: 'destructive', title: 'Send Failed', description: 'Could not send voice note.' });
        } finally {
            setIsSending(false);
        }
    };

    const handleSendAudio = async () => {
        if (!audioBlob) return;
        await handleSendAudioBlob(audioBlob, recordingSeconds);
    };

    const handleSendImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !selectedConversation) return;
        setIsSending(true);
        try {
            const storageRef = ref(storage, `chat_images/${selectedConversation.id}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'conversations', selectedConversation.id, 'messages'), {
                senderId: user.uid,
                imageUrl: downloadURL,
                text: newMessage.trim() || undefined,
                type: 'image',
                timestamp: serverTimestamp(),
            });

            setNewMessage('');
        } catch (err) {
            console.error('Error sending image in chat:', err);
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not send image.' });
        } finally {
            setIsSending(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

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
            const preferredMimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
            ];
            let selectedMime = '';
            if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
                selectedMime = preferredMimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
            }
            const recorder = selectedMime
                ? new MediaRecorder(stream, { mimeType: selectedMime })
                : new MediaRecorder(stream);

            mediaRecorderRef.current = recorder;
            const audioChunks: Blob[] = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                const mimeType = recorder.mimeType || selectedMime || 'audio/webm';
                const recordedBlob = new Blob(audioChunks, { type: mimeType });
                setAudioBlob(recordedBlob);
                stream.getTracks().forEach((track) => track.stop());
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                    recordingTimerRef.current = null;
                }
            };

            setRecordingSeconds(0);
            setAudioBlob(null);
            recorder.start();
            setIsRecording(true);
            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            toast({ variant: 'destructive', title: 'Mic Access Denied', description: 'Please allow microphone access to record a voice note.' });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = () => {
                mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
            };
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        }
        setIsRecording(false);
        setAudioBlob(null);
        setRecordingSeconds(0);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
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
        if (convo.lastMessage.type === 'audio') return "🎙️ Voice note";
        if ((convo.lastMessage as any).type === 'image') return "📷 Sent a photo";
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
                                    <ConversationListItem
                                        key={convo.id}
                                        convo={convo}
                                        otherUser={otherUser}
                                        isSelected={selectedConversation?.id === convo.id}
                                        onSelect={handleSelectConversation}
                                        lastMessageText={lastMessageText}
                                    />
                                );
                            })
                        )}
                    </ScrollArea>
                </div>

                {/* Chat Window */}
                <div className={cn("flex flex-col bg-secondary/30 transition-all", selectedConversation ? "w-full md:w-2/3" : "hidden md:flex md:w-2/3")}>
                    {selectedConversation ? (
                        <>
                            <ActiveChatHeader
                                otherUser={getOtherParticipant(selectedConversation)}
                                conversationId={selectedConversation.id}
                                onBack={() => setSelectedConversation(null)}
                            />
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2">
                                                    {messages
                      // Filter out messages the user has deleted
                      .filter(msg => !(user?.uid && msg.deletedFor?.includes(user.uid)))
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
                                    <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-3.5 py-2">
                                        <Button size="icon" variant="ghost" onClick={cancelRecording} className="h-9 w-9 rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/20" title="Cancel Voice Note">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="flex-1 flex items-center justify-center gap-2.5 text-sm font-semibold text-rose-400">
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                                            </span>
                                            <span>
                                                Recording Voice Note ({Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')})
                                            </span>
                                        </div>
                                        <Button size="sm" variant="destructive" onClick={stopRecording} className="rounded-xl gap-1.5 font-bold">
                                            <Square className="h-3.5 w-3.5" /> Stop & Preview
                                        </Button>
                                    </div>
                                ) : audioBlob ? (
                                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl px-3 py-2">
                                        <Button size="icon" variant="ghost" onClick={() => { setAudioBlob(null); setRecordingSeconds(0); }} className="h-9 w-9 rounded-full text-rose-400 hover:bg-rose-500/20" title="Discard Voice Note">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <audio controls src={URL.createObjectURL(audioBlob)} className="flex-1 h-9" />
                                        <Button size="sm" onClick={handleSendAudio} disabled={isSending} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5">
                                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Send Voice Note
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSendImageFile}
                                            className="hidden"
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => imageInputRef.current?.click()}
                                            disabled={isSending}
                                            title="Send Photo"
                                            className="rounded-full shrink-0 text-muted-foreground hover:text-indigo-400"
                                        >
                                            <ImageIcon className="h-5 w-5" />
                                        </Button>
                                        <Input 
                                            placeholder="Type a message or record a voice note..." 
                                            value={newMessage}
                                            onChange={handleTyping}
                                            onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                                            disabled={isSending}
                                            className="rounded-full"
                                        />
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={startRecording}
                                            disabled={isSending}
                                            title="Record Voice Note"
                                            className="rounded-full shrink-0 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                                        >
                                            <Mic className="h-5 w-5" />
                                        </Button>
                                        <Button size="icon" onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} className="rounded-full shrink-0">
                                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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