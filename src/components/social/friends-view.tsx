'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  Check,
  UserCheck,
  MessageSquare,
  Trash2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Search,
  MoreHorizontal,
  User,
  BadgeCheck,
  X,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';

function PendingRequestCard({
  req,
  currentUserUid,
  onAcceptRequest,
}: {
  req: any;
  currentUserUid: string;
  onAcceptRequest: (notif: any, e: React.MouseEvent) => void;
}) {
  const fromUid = req.from?.uid || req.uid;
  const liveFrom = useLiveUserProfile(fromUid, req.from?.avatarUrl, req.from?.name, req.from?.handle);
  const resolvedFrom = {
    ...req.from,
    uid: fromUid,
    name: liveFrom.name,
    handle: liveFrom.handle,
    avatarUrl: liveFrom.avatarUrl,
  };

  return (
    <div className="flex flex-col justify-between p-4 bg-secondary/25 hover:bg-secondary/40 rounded-2xl border border-border/60 shadow-sm transition-all">
      <div className="flex items-center gap-3.5 mb-4">
        <Link href={`/profile/${resolvedFrom.handle}`} className="shrink-0">
          <Avatar className="h-14 w-14 border-2 border-indigo-500/30 shadow-md">
            <AvatarImage src={resolvedFrom.avatarUrl} alt={resolvedFrom.name} />
            <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-lg">
              {resolvedFrom.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col min-w-0 flex-1">
          <Link
            href={`/profile/${resolvedFrom.handle}`}
            className="text-base font-bold text-foreground hover:text-indigo-400 transition-colors truncate"
          >
            {resolvedFrom.name}
          </Link>
          <span className="text-xs text-muted-foreground truncate">@{resolvedFrom.handle}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-semibold mt-1">
            <UserPlus className="h-3 w-3" /> Sent you a friend request
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border/40">
        <Button
          size="sm"
          className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm"
          onClick={(e) =>
            onAcceptRequest(
              {
                id: req.uid,
                type: 'friend_request',
                fromUser: resolvedFrom,
                timestamp: req.timestamp,
                read: false,
              },
              e
            )
          }
        >
          <Check className="h-4 w-4 mr-1.5" /> Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
          onClick={() => {
            deleteDoc(doc(db, 'users', currentUserUid, 'friendRequests', req.uid));
            toast({ title: 'Request declined' });
          }}
        >
          <X className="h-4 w-4 mr-1" /> Decline
        </Button>
      </div>
    </div>
  );
}

function FriendListItem({
  friend,
  onRemoveFriend,
}: {
  friend: any;
  onRemoveFriend: (friendId: string, name: string) => void;
}) {
  const liveFriend = useLiveUserProfile(friend.uid, friend.avatarUrl, friend.name, friend.handle);
  const isVerified =
    Boolean(friend.isProfessional) ||
    liveFriend.handle?.toLowerCase() === 'lonkind' ||
    liveFriend.handle?.toLowerCase() === 'admin_lonkind';

  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-secondary/20 hover:bg-secondary/40 rounded-2xl border border-border/50 hover:border-indigo-500/40 shadow-sm transition-all group">
      <Link href={`/profile/${liveFriend.handle}`} className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14 border-2 border-indigo-500/25 group-hover:border-indigo-500/50 transition-all shadow-md">
            <AvatarImage src={liveFriend.avatarUrl} alt={liveFriend.name} />
            <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-lg">
              {liveFriend.name?.charAt(0) || 'F'}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm sm:text-base font-bold text-foreground group-hover:text-indigo-400 transition-colors truncate">
              {liveFriend.name}
            </span>
            {isVerified && <BadgeCheck className="h-4 w-4 text-indigo-400 shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground truncate">@{liveFriend.handle}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium mt-1">
            <UserCheck className="h-3 w-3" /> Friend
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-1.5 shrink-0">
        <Link href={`/?view=messages&user=${friend.uid}`}>
          <Button
            size="sm"
            className="h-9 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-semibold shadow-sm transition-all flex items-center gap-1.5"
            title="Send Message"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Message</span>
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              title="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs">
              <Link href={`/profile/${liveFriend.handle}`}>
                <User className="h-3.5 w-3.5" />
                View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs">
              <Link href={`/?view=messages&user=${friend.uid}`}>
                <MessageSquare className="h-3.5 w-3.5" />
                Send Direct Message
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemoveFriend(friend.uid, liveFriend.name)}
              className="cursor-pointer gap-2 text-xs text-rose-400 focus:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Friend
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

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
  sentRequests,
}: FriendsViewProps) {
  const [myFriends, setMyFriends] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('my-friends');

  useEffect(() => {
    if (!currentUser?.uid) return;
    setIsLoadingFriends(true);
    const friendsRef = collection(db, 'users', currentUser.uid, 'friends');
    const unsub = onSnapshot(
      friendsRef,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
        setMyFriends(list);
        setIsLoadingFriends(false);
      },
      (error) => {
        console.error('Error loading friends:', error);
        setIsLoadingFriends(false);
      }
    );
    return () => unsub();
  }, [currentUser?.uid]);

  const handleRemoveFriend = async (friendId: string, name: string) => {
    if (!currentUser?.uid) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', currentUser.uid, 'friends', friendId));
      batch.delete(doc(db, 'users', friendId, 'friends', currentUser.uid));
      batch.update(doc(db, 'users', currentUser.uid), { friendsCount: increment(-1) });
      batch.update(doc(db, 'users', friendId), { friendsCount: increment(-1) });
      await batch.commit();
      toast({ title: 'Friend Removed', description: `${name} has been removed from your friends list.` });
    } catch (error) {
      console.error('Error removing friend:', error);
      // Fallback single delete if cross-user update permission is restricted
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'friends', friendId));
        toast({ title: 'Friend Removed', description: `${name} has been removed from your friends list.` });
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not remove friend.' });
      }
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFriends = myFriends.filter(
    (f) =>
      !normalizedQuery ||
      f.name?.toLowerCase().includes(normalizedQuery) ||
      f.handle?.toLowerCase().includes(normalizedQuery)
  );

  const filteredSuggestions = friendSuggestions.filter(
    (s) =>
      !normalizedQuery ||
      s.name?.toLowerCase().includes(normalizedQuery) ||
      s.handle?.toLowerCase().includes(normalizedQuery)
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Compact Modern Header & Search Bar */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-indigo-950/50 to-slate-900/95 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300">
              <Users className="h-3.5 w-3.5" /> Your Social Network
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Friends & Connections
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Message your friends, respond to friend requests, and discover new people on Lonkind.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-secondary/40 px-5 py-3 rounded-2xl border border-border/60 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('my-friends')}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="text-xl sm:text-2xl font-black text-foreground">{myFriends.length}</div>
              <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                Friends
              </div>
            </button>
            <div className="h-8 w-[1px] bg-border" />
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="text-xl sm:text-2xl font-black text-indigo-400">{friendRequests.length}</div>
              <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                Requests
              </div>
            </button>
          </div>
        </div>

        {/* Pending Requests Quick Alert Banner if user is on My Friends tab */}
        {friendRequests.length > 0 && activeTab !== 'requests' && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-indigo-200">
              <UserPlus className="h-4 w-4 text-indigo-400 shrink-0" />
              <span>
                You have <strong>{friendRequests.length}</strong> pending friend{' '}
                {friendRequests.length === 1 ? 'request' : 'requests'} waiting!
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setActiveTab('requests')}
              className="h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 shrink-0"
            >
              View Requests
            </Button>
          </div>
        )}

        {/* Global Friends & People Filter Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter friends or people by name or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-9 h-10 bg-secondary/50 border-border/60 focus-visible:ring-indigo-500 rounded-xl text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Layout (My Friends First) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1.5 gap-1.5 bg-slate-900/90 border border-border/60 rounded-2xl">
          <TabsTrigger
            value="my-friends"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>My Friends ({myFriends.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="requests"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            <span>Requests</span>
            {friendRequests.length > 0 && (
              <Badge className="bg-rose-500 text-white px-1.5 py-0 text-[10px]">{friendRequests.length}</Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="suggestions"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Discover People</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MY FRIENDS */}
        <TabsContent value="my-friends" className="mt-0 space-y-4 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm bg-card">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                    My Friends ({filteredFriends.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tap any friend to view their profile or start a direct message.
                  </CardDescription>
                </div>
                {myFriends.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('suggestions')}
                    className="rounded-xl text-xs gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Find People
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {isLoadingFriends ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                  <p className="text-sm">Loading your friends list...</p>
                </div>
              ) : myFriends.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-secondary/15 rounded-2xl border border-dashed border-border/60 space-y-3">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <div>
                    <p className="font-bold text-base text-foreground">Your friends list is empty</p>
                    <p className="text-xs mt-1 max-w-sm mx-auto">
                      Connect with creators and friends in Discover People or accept incoming requests.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('suggestions')}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    Discover People to Add
                  </Button>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No friends match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredFriends.map((friend, i) => (
                    <FriendListItem key={friend.uid || i} friend={friend} onRemoveFriend={handleRemoveFriend} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PENDING REQUESTS */}
        <TabsContent value="requests" className="mt-0 space-y-4 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm bg-card">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <UserPlus className="h-4 w-4 text-indigo-400" />
                Pending Friend Requests ({friendRequests.length})
              </CardTitle>
              <CardDescription className="text-xs">
                People who want to connect with you on Lonkind.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {friendRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-secondary/15 rounded-2xl border border-dashed border-border/60">
                  <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-base text-foreground">No pending friend requests</p>
                  <p className="text-xs mt-1">When someone sends you a friend request, it will appear right here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friendRequests.map((req, i) => (
                    <PendingRequestCard
                      key={req.uid || i}
                      req={req}
                      currentUserUid={currentUser.uid}
                      onAcceptRequest={onAcceptRequest}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SUGGESTED FRIENDS */}
        <TabsContent value="suggestions" className="mt-0 space-y-4 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm bg-card">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Discover People on Lonkind
              </CardTitle>
              <CardDescription className="text-xs">
                Connect with creators, friends, and community members.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {friendSuggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                  <p className="text-sm">Loading community suggestions...</p>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No people match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSuggestions.map((suggestion, i) => {
                    const requestSent = sentRequests.has(suggestion.uid);
                    return (
                      <div
                        key={suggestion.uid || i}
                        className="flex flex-col justify-between p-4 bg-secondary/20 hover:bg-secondary/35 rounded-2xl border border-border/60 hover:border-indigo-500/40 shadow-sm transition-all group"
                      >
                        <Link href={`/profile/${suggestion.handle}`} className="flex items-center gap-3.5">
                          <Avatar className="h-14 w-14 border-2 border-indigo-500/20 group-hover:border-indigo-500/40 transition-all shadow-md shrink-0">
                            <AvatarImage src={suggestion.avatarUrl} alt={suggestion.name} />
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl">
                              {suggestion.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-indigo-400 transition-colors truncate">
                              {suggestion.name}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">@{suggestion.handle}</p>
                            {suggestion.bio && (
                              <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-1">
                                {suggestion.bio}
                              </p>
                            )}
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/40">
                          <Button
                            size="sm"
                            className={`flex-1 font-bold rounded-xl shadow-sm transition-all ${
                              requestSent
                                ? 'bg-secondary text-muted-foreground border border-border'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                            onClick={() => !requestSent && onAddFriend(suggestion)}
                            disabled={requestSent}
                          >
                            {requestSent ? (
                              <span className="flex items-center justify-center gap-1.5 text-xs">
                                <Check className="h-3.5 w-3.5 text-emerald-400" /> Request Sent
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1.5 text-xs">
                                <UserPlus className="h-3.5 w-3.5" /> Add Friend
                              </span>
                            )}
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="rounded-xl text-xs px-3"
                          >
                            <Link href={`/profile/${suggestion.handle}`}>Profile</Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
