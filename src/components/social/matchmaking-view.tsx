'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Sparkles, UserPlus } from 'lucide-react';
import { findMatches, type MatchmakingOutput } from '@/ai/flows/matchmaking-flow';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import Link from 'next/link';
import { doc, getDoc, writeBatch, increment, serverTimestamp, collection } from 'firebase/firestore';
import type { CurrentUser } from './social-dashboard';

export default function MatchmakingView() {
    const [user] = useAuthState(auth);
    const [suggestions, setSuggestions] = useState<MatchmakingOutput['suggestions'] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());

     const handleFindMatches = async () => {
        if (!user) return;
        setIsLoading(true);
        setSuggestions(null);
        try {
            const result = await findMatches({ userId: user.uid });
            setSuggestions(result.suggestions);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find matches. Please try again later.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFollow = async (targetUser: MatchmakingOutput['suggestions'][0]) => {
        if (!user) return;

        const currentUserDoc = await getDoc(doc(db, 'users', user.uid));
        if (!currentUserDoc.exists()) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not find your user profile.' });
             return;
        }
        const currentUser = currentUserDoc.data() as CurrentUser;

        const batch = writeBatch(db);

        // Add target to current user's following subcollection
        const followingRef = doc(db, 'users', user.uid, 'following', targetUser.uid);
        batch.set(followingRef, {
            name: targetUser.name,
            handle: targetUser.handle,
            avatarUrl: targetUser.avatarUrl,
            timestamp: serverTimestamp(),
        });

        // Add current user to target's followers subcollection
        const followerRef = doc(db, 'users', targetUser.uid, 'followers', user.uid);
        batch.set(followerRef, {
            name: currentUser.name,
            handle: currentUser.handle,
            avatarUrl: currentUser.avatarUrl,
            timestamp: serverTimestamp(),
        });
        
        // Increment/decrement counts
        batch.update(doc(db, 'users', user.uid), { followingCount: increment(1) });
        batch.update(doc(db, 'users', targetUser.uid), { followersCount: increment(1) });
        
        // Send notification
        const notificationRef = doc(collection(db, 'users', targetUser.uid, 'notifications'));
        batch.set(notificationRef, {
            type: 'new_follower',
            fromUser: { name: currentUser.name, handle: currentUser.handle, avatarUrl: currentUser.avatarUrl, uid: currentUser.uid },
            timestamp: serverTimestamp(),
            read: false,
        });

        try {
            await batch.commit();
            toast({ title: 'Followed!', description: `You are now following ${targetUser.name}.` });
            setFollowedUsers(prev => new Set(prev).add(targetUser.uid));
        } catch (e) {
            console.error("Follow error:", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not complete follow action.' });
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>AI Matchmaking</CardTitle>
                <CardDescription>Discover new people to connect with based on your profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Button onClick={handleFindMatches} disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Sparkles className="mr-2 h-5 w-5" /> Find New Connections</>}
                </Button>
                 {isLoading && (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                )}
                {suggestions && (
                    <div>
                        {suggestions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {suggestions.map(person => (
                                    <Card key={person.uid}>
                                        <CardContent className="p-4 flex flex-col items-center text-center">
                                            <Link href={`/profile/${person.handle}`}>
                                                <Avatar className="h-20 w-20 mb-3">
                                                    <AvatarImage src={person.avatarUrl} alt={person.name} />
                                                    <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </Link>
                                            <Link href={`/profile/${person.handle}`} className="font-semibold hover:underline">{person.name}</Link>
                                            <p className="text-sm text-muted-foreground">@{person.handle}</p>
                                            <p className="text-xs mt-2 p-2 bg-accent/50 rounded-md">"{person.matchReason}"</p>
                                            <Button 
                                                className="mt-4 w-full" 
                                                size="sm"
                                                onClick={() => handleFollow(person)}
                                                disabled={followedUsers.has(person.uid)}
                                            >
                                                <UserPlus className="mr-2 h-4 w-4"/>
                                                {followedUsers.has(person.uid) ? 'Followed' : 'Follow'}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-12">
                                <Users className="h-12 w-12 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold">No new matches right now</h3>
                                <p>Try again later or check out the Explore page!</p>
                            </div>
                        )}
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
