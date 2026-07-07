'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Check, UserCheck, MessageSquare, Trash2, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FriendsViewProps {
    currentUser: any;
    friendRequests: any[];
    friendSuggestions: any[];
    onAcceptRequest: (notif: any, e: React.MouseEvent) => void;
    onAddFriend: (user: any) => void;
    sentRequests: Set<string>;
}

export default function FriendsView({
    currentUser,
    friendRequests,
    friendSuggestions,
    onAcceptRequest,
    onAddFriend,
    sentRequests
}: FriendsViewProps) {
    const [myFriends, setMyFriends] = useState<any[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);

    useEffect(() => {
        if (!currentUser?.uid) return;
        setIsLoadingFriends(true);
        const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
        const unsub = onSnapshot(friendsRef, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setMyFriends(list);
            setIsLoadingFriends(false);
        }, (error) => {
            console.error("Error loading friends:", error);
            setIsLoadingFriends(false);
        });
        return () => unsub();
    }, [currentUser?.uid]);

    const handleRemoveFriend = async (friendId: string, name: string) => {
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'friends', friendId));
            toast({ title: 'Friend Removed', description: `${name} has been removed from your friends list.` });
        } catch (error) {
            console.error("Error removing friend:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not remove friend.' });
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto py-2">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                            <Users className="h-4 w-4" /> Lonkind Social Graph
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Friends & Requests</h1>
                        <p className="text-indigo-100 max-w-xl text-sm md:text-base">
                            Manage your personal connections, accept friend requests, and discover inspiring people around the world.
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-white/10 backdrop-blur-lg px-6 py-4 rounded-2xl border border-white/20">
                        <div className="text-center">
                            <div className="text-2xl font-black">{myFriends.length}</div>
                            <div className="text-xs text-indigo-200 uppercase tracking-wider">Friends</div>
                        </div>
                        <div className="h-8 w-[1px] bg-white/20" />
                        <div className="text-center">
                            <div className="text-2xl font-black">{friendRequests.length}</div>
                            <div className="text-xs text-indigo-200 uppercase tracking-wider">Requests</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Tabs Layout */}
            <Tabs defaultValue="requests" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/60 p-1 rounded-xl">
                    <TabsTrigger value="requests" className="rounded-lg font-bold flex items-center gap-2">
                        <UserPlus className="h-4 w-4" /> Pending Requests 
                        {friendRequests.length > 0 && (
                            <Badge className="bg-indigo-600 text-white ml-1">{friendRequests.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="suggestions" className="rounded-lg font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" /> Discover People
                    </TabsTrigger>
                    <TabsTrigger value="my-friends" className="rounded-lg font-bold flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-500" /> My Friends ({myFriends.length})
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: PENDING REQUESTS */}
                <TabsContent value="requests" className="mt-6 space-y-4">
                    <Card className="border-none shadow-md bg-card/80 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <UserPlus className="h-5 w-5 text-indigo-500" /> Pending Friend Requests
                            </CardTitle>
                            <CardDescription>
                                People who want to connect with you on Lonkind.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {friendRequests.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/60">
                                    <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="font-semibold text-base">No pending requests</p>
                                    <p className="text-xs mt-1">When someone sends you a friend request, it will appear here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friendRequests.map((req, i) => (
                                        <div key={i} className="flex flex-col justify-between p-4 bg-background rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4 mb-4">
                                                <Avatar className="h-14 w-14 border-2 border-indigo-500/20">
                                                    <AvatarImage src={req.from?.avatarUrl} alt={req.from?.name} />
                                                    <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-lg">
                                                        {req.from?.name?.charAt(0) || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col overflow-hidden">
                                                    <Link href={`/profile/${req.from?.handle}`} className="text-base font-bold hover:text-indigo-600 transition-colors truncate">
                                                        {req.from?.name}
                                                    </Link>
                                                    <span className="text-sm text-muted-foreground truncate">@{req.from?.handle}</span>
                                                    <span className="text-xs text-indigo-500 font-medium mt-1">Wants to be friends</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                                                <Button 
                                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold shadow-sm" 
                                                    onClick={(e) => onAcceptRequest({ id: req.uid, type: 'friend_request', fromUser: req.from, timestamp: req.timestamp, read: false }, e)}
                                                >
                                                    <Check className="h-4 w-4 mr-2" /> Accept
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                                    onClick={() => {
                                                        deleteDoc(doc(db, 'users', currentUser.uid, 'friendRequests', req.uid));
                                                        toast({ title: 'Request declined' });
                                                    }}
                                                >
                                                    Decline
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: SUGGESTED FRIENDS */}
                <TabsContent value="suggestions" className="mt-6 space-y-4">
                    <Card className="border-none shadow-md bg-card/80 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Sparkles className="h-5 w-5 text-yellow-500" /> Recommended for You
                            </CardTitle>
                            <CardDescription>
                                Discover creators and leaders in the community to grow your social circle.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {friendSuggestions.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                                    <p>Loading community suggestions...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {friendSuggestions.map((suggestion, i) => {
                                        const requestSent = sentRequests.has(suggestion.uid);
                                        return (
                                            <div key={i} className="flex flex-col items-center text-center p-5 bg-background rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all group">
                                                <Link href={`/profile/${suggestion.handle}`} className="flex flex-col items-center">
                                                    <Avatar className="h-20 w-20 border-4 border-indigo-500/10 group-hover:border-indigo-500/30 transition-all mb-3 shadow-md">
                                                        <AvatarImage src={suggestion.avatarUrl} alt={suggestion.name} />
                                                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-2xl">
                                                            {suggestion.name?.charAt(0) || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <h3 className="font-bold text-base group-hover:text-indigo-600 transition-colors truncate max-w-[180px]">
                                                        {suggestion.name}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">@{suggestion.handle}</p>
                                                    {suggestion.bio && (
                                                        <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2 min-h-[32px] px-2">
                                                            {suggestion.bio}
                                                        </p>
                                                    )}
                                                </Link>
                                                <Button 
                                                    className={`w-full mt-4 font-bold rounded-xl shadow-sm transition-all ${
                                                        requestSent 
                                                        ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300' 
                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                    }`}
                                                    onClick={() => !requestSent && onAddFriend(suggestion)}
                                                    disabled={requestSent}
                                                >
                                                    {requestSent ? (
                                                        <span className="flex items-center justify-center gap-1">
                                                            <Check className="h-4 w-4" /> Request Sent
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1">
                                                            <UserPlus className="h-4 w-4" /> Add Friend
                                                        </span>
                                                    )}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: MY FRIENDS */}
                <TabsContent value="my-friends" className="mt-6 space-y-4">
                    <Card className="border-none shadow-md bg-card/80 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <UserCheck className="h-5 w-5 text-green-500" /> My Friends ({myFriends.length})
                            </CardTitle>
                            <CardDescription>
                                Your accepted social network on Lonkind.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingFriends ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                                    <p>Loading your friends list...</p>
                                </div>
                            ) : myFriends.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/60">
                                    <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="font-semibold text-base">No friends yet</p>
                                    <p className="text-xs mt-1">Explore suggested people or accept incoming requests to start building your community!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {myFriends.map((friend, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all">
                                            <Link href={`/profile/${friend.handle}`} className="flex items-center gap-3 overflow-hidden flex-1 group">
                                                <Avatar className="h-12 w-12 border border-border/50">
                                                    <AvatarImage src={friend.avatarUrl} alt={friend.name} />
                                                    <AvatarFallback className="bg-gradient-to-tr from-green-500 to-teal-500 text-white font-bold">
                                                        {friend.name?.charAt(0) || 'F'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-base font-bold text-foreground group-hover:text-indigo-600 transition-colors truncate">
                                                        {friend.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground truncate">@{friend.handle}</span>
                                                </div>
                                            </Link>
                                            <div className="flex items-center gap-2">
                                                <Link href={`/?view=messages&user=${friend.uid}`}>
                                                    <Button size="icon" variant="outline" className="h-9 w-9 rounded-full text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 border-indigo-200" title="Send Message">
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleRemoveFriend(friend.uid, friend.name)}
                                                    title="Remove Friend"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
