
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, PlusCircle, Loader2, Users, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { CurrentUser } from './social-dashboard';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import LiveSpaceDialog from './live-space-dialog.tsx';

export interface SpaceParticipant {
    uid: string;
    name: string;
    avatarUrl: string;
    isMuted?: boolean;
}

export interface Space {
    id: string;
    topic: string;
    host: SpaceParticipant;
    speakers: SpaceParticipant[];
    listeners: SpaceParticipant[];
    pendingSpeakers: string[]; // UIDs of users requesting to speak
    listenerCount: number;
    createdAt: any;
}

const CreateSpaceDialog = ({ isOpen, onOpenChange, currentUser, onSpaceCreated }: { isOpen: boolean, onOpenChange: (open: boolean) => void, currentUser: CurrentUser, onSpaceCreated: (id: string) => void }) => {
    const [topic, setTopic] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateSpace = async () => {
        if (!topic.trim()) return;
        setIsCreating(true);
        try {
            const hostParticipant = {
                uid: currentUser.uid,
                name: currentUser.name,
                avatarUrl: currentUser.avatarUrl,
                isMuted: true,
            };

            const newSpace = await addDoc(collection(db, 'spaces'), {
                topic,
                host: hostParticipant,
                speakers: [hostParticipant],
                listeners: [],
                pendingSpeakers: [],
                listenerCount: 0,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Space Created!", description: "Your live audio space is now active." });
            onOpenChange(false);
            onSpaceCreated(newSpace.id);
        } catch (error) {
            console.error("Error creating space:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create the space.' });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start a New Space</DialogTitle>
                    <DialogDescription>
                        Host a live audio conversation. What will you talk about?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <label htmlFor="topic" className="text-sm font-medium">Topic</label>
                    <Input id="topic" placeholder="e.g., The Future of AI" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={isCreating} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleCreateSpace} disabled={isCreating || !topic.trim()}>
                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Start Space
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function SpacesView({ currentUser }: { currentUser: CurrentUser }) {
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeSpace, setActiveSpace] = useState<Space | null>(null);

    useEffect(() => {
        setIsLoading(true);
        const spacesRef = collection(db, 'spaces');
        const q = query(spacesRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const spacesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
            setSpaces(spacesList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching spaces:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch spaces.' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleJoinSpace = async (space: Space) => {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if(!userDoc.exists()) return;

        const participant: SpaceParticipant = {
            uid: currentUser.uid,
            name: userDoc.data().name,
            avatarUrl: userDoc.data().avatarUrl,
            isMuted: true,
        };

        const spaceRef = doc(db, 'spaces', space.id);
        const spaceDoc = await getDoc(spaceRef);
        const spaceData = spaceDoc.data() as Space;

        // Don't add if already a speaker or listener
        const isSpeaker = spaceData.speakers.some(p => p.uid === currentUser.uid);
        const isListener = spaceData.listeners.some(p => p.uid === currentUser.uid);

        if (!isSpeaker && !isListener) {
            // This is handled in LiveSpaceDialog now to avoid race conditions
        }
        
        setActiveSpace({ ...spaceData, id: space.id });
    };

    return (
        <main className="col-span-9">
            <CreateSpaceDialog 
                isOpen={isCreateOpen} 
                onOpenChange={setIsCreateOpen} 
                currentUser={currentUser}
                onSpaceCreated={async (spaceId) => {
                    const spaceDoc = await getDoc(doc(db, 'spaces', spaceId));
                    if (spaceDoc.exists()) {
                         setActiveSpace({ id: spaceDoc.id, ...spaceDoc.data() } as Space);
                    }
                }}
            />
            {activeSpace && (
                <LiveSpaceDialog 
                    space={activeSpace}
                    currentUser={currentUser}
                    onLeave={() => setActiveSpace(null)}
                />
            )}

             <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3"><Radio /> Spaces</h1>
                    <p className="text-muted-foreground mt-2">
                        Join live audio conversations happening right now.
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create a Space
                </Button>
            </header>
            
            {isLoading ? (
                 <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            ) : spaces.length > 0 ? (
                <div className="space-y-4">
                    {spaces.map(space => (
                        <Card key={space.id} className="overflow-hidden">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className='flex-1'>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="destructive" className="animate-pulse">
                                            <Radio className="mr-2 h-3 w-3" />
                                            LIVE
                                        </Badge>
                                        <p className="text-lg font-semibold">{space.topic}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Users className="h-4 w-4" />
                                        <span>{space.listenerCount + space.speakers.length} participating</span>
                                        <span className='mx-1'>&middot;</span>
                                        <span>Hosted by <strong>{space.host.name}</strong></span>
                                    </div>
                                </div>
                                <Button onClick={() => handleJoinSpace(space)}>
                                    <Mic className="mr-2 h-4 w-4" /> Join Space
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                 <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <Radio className="h-12 w-12 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold">No Active Spaces</h3>
                        <p>There are no live audio spaces right now. Why not start your own?</p>
                    </CardContent>
                </Card>
            )}
        </main>
    );
}

    
