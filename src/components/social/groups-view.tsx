'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, PlusCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import CreateGroupDialog from './create-group-dialog';
import type { CurrentUser } from './social-dashboard';
import Link from 'next/link';

export interface Group {
    id: string;
    name: string;
    description: string;
    coverUrl: string;
    memberCount: number;
    members: string[]; // array of user UIDs
    createdBy: string;
}

export default function GroupsView({ currentUser, onGroupSelect }: { currentUser: CurrentUser, onGroupSelect: (groupId: string) => void; }) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const groupsRef = collection(db, 'groups');
        const q = query(groupsRef, orderBy('memberCount', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const groupsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
            setGroups(groupsList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching groups:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch groups.' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <main className="col-span-9">
            {currentUser && <CreateGroupDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} currentUser={currentUser} />}
             <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3"><Users /> Groups</h1>
                    <p className="text-muted-foreground mt-2">
                        Discover and join communities based on your interests.
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
                </Button>
            </header>
            
            {isLoading ? (
                 <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map(group => (
                        <Card key={group.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
                            <Link href={`/?view=group-details&groupId=${group.id}`} onClick={() => onGroupSelect(group.id)} className='flex flex-col flex-grow'>
                                <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${group.coverUrl})` }} data-ai-hint="group cover image" />
                                <CardHeader>
                                    <CardTitle>{group.name}</CardTitle>
                                    <CardDescription>{group.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <div className="flex items-center space-x-2">
                                        <Badge variant='secondary'>
                                            {group.memberCount} members
                                        </Badge>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button 
                                        className="w-full"
                                        variant={group.members.includes(currentUser.uid) ? 'secondary' : 'default'}
                                    >
                                        {group.members.includes(currentUser.uid) ? 'View Group' : 'View Group'}
                                    </Button>
                                </CardFooter>
                            </Link>
                        </Card>
                    ))}
                </div>
            )}
        </main>
    );
}
