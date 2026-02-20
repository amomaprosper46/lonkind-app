'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Mic, MicOff, Phone, Hand, UserPlus, Loader2, Check, X, ShieldCheck } from 'lucide-react';
import { type Space, type SpaceParticipant } from './spaces-view';
import { type CurrentUser } from './social-dashboard';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, increment } from 'firebase/firestore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';

interface LiveSpaceDialogProps {
    space: Space;
    currentUser: CurrentUser;
    onLeave: () => void;
}

export default function LiveSpaceDialog({ space, currentUser, onLeave }: LiveSpaceDialogProps) {
    const [liveSpace, setLiveSpace] = useState<Space>(space);
    const [isMuted, setIsMuted] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [hasRequested, setHasRequested] = useState(false);
    const [pendingSpeakerProfiles, setPendingSpeakerProfiles] = useState<SpaceParticipant[]>([]);

    useEffect(() => {
        const spaceRef = doc(db, 'spaces', space.id);

        const joinSpace = async () => {
            const participant: SpaceParticipant = {
                uid: currentUser.uid,
                name: currentUser.name,
                avatarUrl: currentUser.avatarUrl,
                isMuted: true,
            };
            
            const spaceSnap = await getDoc(spaceRef);
            if (!spaceSnap.exists()) return;
            const spaceData = spaceSnap.data() as Space;
            const alreadyExists = spaceData.listeners.some(l => l.uid === currentUser.uid) || spaceData.speakers.some(s => s.uid === currentUser.uid);

            if (!alreadyExists) {
                await updateDoc(spaceRef, {
                    listeners: arrayUnion(participant),
                    listenerCount: increment(1)
                });
            }
        };

        const leaveSpace = async () => {
            const spaceSnap = await getDoc(spaceRef);
            if (!spaceSnap.exists()) return;
            const currentSpaceData = spaceSnap.data() as Space;

            const isCurrentUserHost = currentSpaceData.host.uid === currentUser.uid;

            if (isCurrentUserHost && currentSpaceData.speakers.length <= 1 && currentSpaceData.listeners.length === 0) {
                await deleteDoc(spaceRef);
                return;
            }
            
            const speakerToRemove = currentSpaceData.speakers.find(s => s.uid === currentUser.uid);
            const listenerToRemove = currentSpaceData.listeners.find(l => l.uid === currentUser.uid);
            
            if (speakerToRemove || listenerToRemove) {
                 await updateDoc(spaceRef, {
                    ...(listenerToRemove && { listeners: arrayRemove(listenerToRemove) }),
                    ...(speakerToRemove && { speakers: arrayRemove(speakerToRemove) }),
                    pendingSpeakers: arrayRemove(currentUser.uid),
                    listenerCount: increment(-1),
                });
            }
        };
        
        joinSpace();
        const unsubscribe = onSnapshot(spaceRef, (docSnap) => {
            if (docSnap.exists()) {
                const spaceData = { id: docSnap.id, ...docSnap.data() } as Space;
                setLiveSpace(spaceData);
                setIsHost(spaceData.host.uid === currentUser.uid);
                setIsSpeaker(spaceData.speakers.some(p => p.uid === currentUser.uid));
                setHasRequested(spaceData.pendingSpeakers.includes(currentUser.uid));
            } else {
                toast({ title: "Space Ended", description: "The host has ended this space." });
                onLeave();
            }
        });

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            leaveSpace();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            unsubscribe();
            leaveSpace();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [space.id, currentUser.uid, currentUser.name, currentUser.avatarUrl, onLeave]);

     useEffect(() => {
        const fetchPendingProfiles = async () => {
            if (liveSpace.pendingSpeakers.length > 0) {
                const profiles = await Promise.all(
                    liveSpace.pendingSpeakers.map(async (uid) => {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        return userDoc.exists() ? { uid, ...userDoc.data() } as SpaceParticipant : null;
                    })
                );
                setPendingSpeakerProfiles(profiles.filter(p => p !== null) as SpaceParticipant[]);
            } else {
                setPendingSpeakerProfiles([]);
            }
        };
        fetchPendingProfiles();
    }, [liveSpace.pendingSpeakers]);


    const handleRequestToSpeak = async () => {
        if (!isSpeaker && !hasRequested) {
            const spaceRef = doc(db, 'spaces', space.id);
            await updateDoc(spaceRef, {
                pendingSpeakers: arrayUnion(currentUser.uid),
            });
            toast({ title: 'Request Sent', description: 'Your request to speak has been sent to the host.' });
        }
    };
    
    const handleHostAction = async (targetUid: string, action: 'approve' | 'deny' | 'demote') => {
        if (!isHost) return;
        const spaceRef = doc(db, 'spaces', space.id);
        const spaceDoc = await getDoc(spaceRef);
        if(!spaceDoc.exists()) return;
        const spaceData = spaceDoc.data() as Space;

        if (action === 'approve') {
            const listenerToPromote = spaceData.listeners.find(l => l.uid === targetUid);
            if (!listenerToPromote) return;
             await updateDoc(spaceRef, {
                pendingSpeakers: arrayRemove(targetUid),
                listeners: arrayRemove(listenerToPromote),
                speakers: arrayUnion(listenerToPromote),
            });
        } else if (action === 'deny') {
            await updateDoc(spaceRef, {
                pendingSpeakers: arrayRemove(targetUid),
            });
        } else if (action === 'demote') {
            const speakerToDemote = spaceData.speakers.find(s => s.uid === targetUid);
            if (!speakerToDemote) return;
            await updateDoc(spaceRef, {
                speakers: arrayRemove(speakerToDemote),
                listeners: arrayUnion(speakerToDemote),
            });
        }
    }


    const handleLeave = () => {
        onLeave();
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && handleLeave()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="truncate">{liveSpace.topic}</DialogTitle>
                    <DialogDescription>Hosted by {liveSpace.host.name}</DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold mb-2">Speakers ({liveSpace.speakers.length})</h3>
                        <div className="grid grid-cols-4 gap-4">
                            {liveSpace.speakers.map(speaker => (
                                <div key={speaker.uid} className="relative flex flex-col items-center gap-1 text-center">
                                    <Avatar className="w-16 h-16">
                                        <AvatarImage src={speaker.avatarUrl} />
                                        <AvatarFallback>{speaker.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    {speaker.uid === liveSpace.host.uid && <ShieldCheck className="absolute top-0 right-0 h-5 w-5 text-primary fill-background" />}
                                    <p className="text-xs truncate w-full">{speaker.name}</p>
                                    {isHost && speaker.uid !== currentUser.uid && (
                                        <Button size="sm" variant="destructive" className="h-auto px-2 py-1 mt-1 text-xs" onClick={() => handleHostAction(speaker.uid, 'demote')}>Demote</Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                     {isHost && pendingSpeakerProfiles.length > 0 && (
                        <div>
                             <h3 className="text-sm font-semibold mb-2">Requests to Speak ({pendingSpeakerProfiles.length})</h3>
                             <div className="space-y-2">
                                {pendingSpeakerProfiles.map(p => (
                                    <div key={p.uid} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={p.avatarUrl} />
                                                <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <p className="text-sm font-medium">{p.name}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="icon" className="h-7 w-7" variant="outline" onClick={() => handleHostAction(p.uid, 'approve')}><Check /></Button>
                                            <Button size="icon" className="h-7 w-7" variant="destructive" onClick={() => handleHostAction(p.uid, 'deny')}><X /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-semibold mb-2">Listeners ({liveSpace.listeners.length})</h3>
                        <ScrollArea className="h-32">
                             <div className="grid grid-cols-5 gap-4">
                                {liveSpace.listeners.map(listener => (
                                   <div key={listener.uid} className="flex flex-col items-center gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Avatar className="w-12 h-12">
                                                        <AvatarImage src={listener.avatarUrl} />
                                                        <AvatarFallback>{listener.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{listener.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="flex items-center justify-between w-full !justify-between">
                     <Button variant="destructive" onClick={handleLeave}>
                        <Phone className="mr-2 h-4 w-4" />
                        Leave Quietly
                    </Button>
                    <div className="flex items-center gap-2">
                        {isSpeaker ? (
                             <Button size="icon" variant={isMuted ? 'secondary' : 'default'} onClick={() => setIsMuted(!isMuted)}>
                                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </Button>
                        ) : (
                             <Button variant="outline" onClick={handleRequestToSpeak} disabled={hasRequested}>
                                <Hand className="mr-2 h-4 w-4"/>
                                {hasRequested ? 'Request Sent' : 'Request to Speak'}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}