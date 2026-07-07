'use client';
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Share2, MoreHorizontal, UserPlus, UserMinus, Check, MessageSquare, Video, Phone, BadgeCheck, UserCheck, Clock, Link as LinkIcon, MessageSquareText, Star, Heart, Medal } from 'lucide-react';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EditProfileDialog, { type ProfileData } from './edit-profile-dialog';
import ProfileRoast from './profile-roast';
import AvatarGenerator from './avatar-generator';
import Link from 'next/link';
import LikesView from './likes-view';
import type { CurrentUser } from './social-dashboard';
import UnifiedReportDialog from './unified-report-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';


interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    isProfessional?: boolean;
    bio?: string;
    friendsCount?: number;
    followerPrivacy?: 'public' | 'private';
    businessUrl?: string;
    badges?: string[];
}

export type FriendStatus = 'not_friends' | 'pending_sent' | 'pending_received' | 'friends';

interface ProfileViewProps {
    user: UserProfile;
    posts: Post[];
    currentUser: CurrentUser;
    isCurrentUser: boolean;
    friendStatus: FriendStatus;
    onFriendAction: (action: 'add' | 'cancel' | 'accept' | 'unfriend', targetUser: UserProfile) => void;
    onMessage: () => void;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
    onStartCall: (type: 'audio' | 'video') => void;
    onUpdateProfile: (data: ProfileData) => Promise<boolean>;
}

const formatCount = (num: number = 0) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};


const ProfileView = ({ user, posts, currentUser, isCurrentUser, friendStatus, onFriendAction, onMessage, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds, onStartCall, onUpdateProfile }: ProfileViewProps) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isFriendsDialogOpen, setIsFriendsDialogOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [friendsList, setFriendsList] = useState<any[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);

    const handleSetProfessional = async () => {
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                isProfessional: true,
            });
            toast({ title: 'Account Upgraded', description: `${user.name} is now a professional creator.` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update account status.' });
        }
    };

    const handleViewFriends = async () => {
        if (user.followerPrivacy === 'private' && !isCurrentUser) {
            toast({ title: 'Private', description: 'This user has hidden their friends list.' });
            return;
        }
        setIsFriendsDialogOpen(true);
        if (friendsList.length > 0) return;
        setIsLoadingFriends(true);
        try {
            const friendsSnapshot = await getDocs(collection(db, 'users', user.uid, 'friends'));
            setFriendsList(friendsSnapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load friends.' });
        } finally {
            setIsLoadingFriends(false);
        }
    };
    
    const handleProfileUpdate = async (data: ProfileData) => {
        const success = await onUpdateProfile(data);
        if (success) {
            setIsEditOpen(false);
        }
        return success;
    };

    const mediaPosts = posts.filter(post => post.imageUrl || post.videoUrl);

    const RelationshipButton = () => {
        if (isCurrentUser) {
            return <Button variant="outline" onClick={() => setIsEditOpen(true)}>Edit Profile</Button>;
        }
        
        switch (friendStatus) {
            case 'friends':
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button><UserCheck className="mr-2 h-4 w-4" /> Friends</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onFriendAction('unfriend', user)} className="text-destructive">
                                Unfriend
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            case 'pending_sent':
                return (
                    <Button variant="outline" onClick={() => onFriendAction('cancel', user)} className="text-muted-foreground">
                        <UserMinus className="mr-2 h-4 w-4" /> Cancel Request
                    </Button>
                );
            case 'pending_received':
                 return (
                    <Button variant="default" onClick={() => onFriendAction('accept', user)} className="bg-green-600 hover:bg-green-700">
                        <UserPlus className="mr-2 h-4 w-4" /> Accept Request
                    </Button>
                );
            case 'not_friends':
            default:
                return <Button variant="outline" onClick={() => onFriendAction('add', user)}><UserPlus className="mr-2 h-4 w-4" /> Add Friend</Button>;
        }
    };

    return (
        <div className="w-full">
            {isCurrentUser && (
                 <EditProfileDialog 
                    isOpen={isEditOpen} 
                    onOpenChange={setIsEditOpen} 
                    currentUser={user}
                    onSave={handleProfileUpdate}
                />
            )}
            <Card className="mb-6 overflow-hidden">
                 <div className="h-48 bg-muted" />
                <CardContent className="flex flex-col md:flex-row items-center gap-6 p-6 pt-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Avatar className="w-32 h-32 -mt-16 border-4 border-background cursor-pointer hover:opacity-90 transition-opacity">
                                <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar" />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => window.open(user.avatarUrl, '_blank')}>
                                View Profile Picture
                            </DropdownMenuItem>
                            {isCurrentUser && (
                                <>
                                    <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                                        Change Picture
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toast({ title: 'Feature Coming Soon', description: 'Posting directly from profile picture is not yet available.' })}>
                                        Post
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toast({ title: 'Feature Coming Soon', description: 'Story feature is not yet available.' })}>
                                        Post Story
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                           <CardTitle className="text-3xl font-bold">{user.name}</CardTitle>
                           {user.isProfessional && <BadgeCheck className="h-8 w-8 text-primary" />}
                           {user.badges?.includes('Top Creator') && <span title="Top Creator"><Star className="h-8 w-8 fill-yellow-500 text-yellow-500" /></span>}
                           {user.badges?.includes('Top Supporter') && <span title="Top Supporter"><Heart className="h-8 w-8 fill-pink-500 text-pink-500" /></span>}
                           {user.badges?.includes('Whale') && <span title="Whale"><Medal className="h-8 w-8 fill-amber-600 text-amber-600" /></span>}
                        </div>
                        <p className="text-muted-foreground text-lg">@{user.handle}</p>
                        <p className="mt-2 text-sm max-w-prose">{user.bio || 'No bio available.'}</p>
                        {user.businessUrl && (
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                <a href={user.businessUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                                    {user.businessUrl.replace(/^https?:\/\//, '')}
                                </a>
                            </div>
                        )}
                        <div className="flex justify-center md:justify-start gap-6 mt-4 text-sm text-muted-foreground">
                            <div>
                                <span className="font-bold text-foreground">{posts.length}</span> Posts
                            </div>
                            <button onClick={handleViewFriends} className="hover:opacity-70 transition-opacity">
                                <span className="font-bold text-foreground">{formatCount(user.friendsCount)}</span> Friends
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 self-start md:self-auto">
                        {!isCurrentUser && (
                            <>
                                <Button variant="outline" onClick={onMessage}><MessageSquare className="mr-2 h-4 w-4"/> Message</Button>
                                <Button variant="outline" size="icon" onClick={() => onStartCall('video')}><Video className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={() => onStartCall('audio')}><Phone className="h-4 w-4" /></Button>
                            </>
                        )}
                        <RelationshipButton />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon"><Share2 className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Share Profile</p></TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setIsReportOpen(true)} className="cursor-pointer">
                                        Report User
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => toast({ title: 'User Blocked', description: 'You will no longer see content from this user.' })}>
                                        Block User
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleSetProfessional}>
                                        Set Account to Professional
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipProvider>
                    </div>
                </CardContent>
            </Card>

            {currentUser && (
                <UnifiedReportDialog
                    isOpen={isReportOpen}
                    onClose={() => setIsReportOpen(false)}
                    reporterUid={currentUser.uid}
                    reporterName={currentUser.name || 'Community Member'}
                    reporterHandle={currentUser.handle || 'anonymous'}
                    targetType="user"
                    targetId={user.uid}
                    targetOwnerUid={user.uid}
                    targetAuthorHandle={user.handle}
                    targetContentSnippet={user.bio || `Profile of ${user.name}`}
                />
            )}

            <Tabs defaultValue="posts" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="posts">Posts</TabsTrigger>
                    <TabsTrigger value="replies">Replies</TabsTrigger>
                    <TabsTrigger value="media">Media</TabsTrigger>
                    <TabsTrigger value="likes">Likes</TabsTrigger>
                    <TabsTrigger value="ai" className="text-orange-500 font-bold">✨ AI</TabsTrigger>
                </TabsList>
                <TabsContent value="posts" className="space-y-4 mt-4">
                    {posts.length > 0 ? (
                         posts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} onReact={onReact} onCommentClick={onComment} onSavePost={onSavePost} onDeletePost={onDeletePost} userReaction={userReactions.get(post.id)} isSaved={savedPostIds.has(post.id)}/>)
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <CardTitle className="mb-2">No Posts Yet</CardTitle>
                                <CardDescription>This user hasn't posted anything.</CardDescription>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
                 <TabsContent value="replies" className="space-y-4 mt-4">
                     <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <MessageSquareText className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">Coming Soon!</h3>
                            <p>This user's replies will appear here.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="media" className="space-y-4 mt-4">
                     {mediaPosts.length > 0 ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                             {mediaPosts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} onReact={onReact} onCommentClick={onComment} onSavePost={onSavePost} onDeletePost={onDeletePost} userReaction={userReactions.get(post.id)} isSaved={savedPostIds.has(post.id)}/>)}
                         </div>
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <CardTitle className="mb-2">No Media Yet</CardTitle>
                                <CardDescription>This user hasn't posted any photos or videos.</CardDescription>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
                 <TabsContent value="likes" className="space-y-4 mt-4">
                    <LikesView 
                        userId={user.uid}
                        currentUser={currentUser}
                        onReact={onReact}
                        onComment={onComment}
                        onSavePost={onSavePost}
                        onDeletePost={onDeletePost}
                        userReactions={userReactions}
                        savedPostIds={savedPostIds}
                    />
                </TabsContent>
                <TabsContent value="ai" className="space-y-6 mt-4">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🔥 Profile Roast</h2>
                            <p className="text-sm text-muted-foreground mb-4">Let AI roast {isCurrentUser ? 'your' : `@${user.handle}'s`} profile. Screenshot and share!</p>
                            <ProfileRoast
                                user={user}
                                postCount={posts.length}
                                isCurrentUser={isCurrentUser}
                            />
                        </CardContent>
                    </Card>
                    {isCurrentUser && (
                        <Card>
                            <CardContent className="p-6">
                                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🎨 AI Avatar Creator</h2>
                                <p className="text-sm text-muted-foreground mb-4">Generate unique avatar concepts in any art style. Screenshot and flex!</p>
                                <AvatarGenerator user={user} />
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isFriendsDialogOpen} onOpenChange={setIsFriendsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Friends</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 mt-4">
                        {isLoadingFriends ? (
                            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : friendsList.length === 0 ? (
                            <div className="text-center text-muted-foreground p-4">No friends yet.</div>
                        ) : (
                            friendsList.map((friend) => (
                                <Link 
                                    key={friend.uid} 
                                    href={`/profile/${friend.handle}`}
                                    onClick={() => setIsFriendsDialogOpen(false)}
                                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                                >
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={friend.avatarUrl} alt={friend.name} />
                                        <AvatarFallback>{friend.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{friend.name}</span>
                                        <span className="text-muted-foreground text-xs">@{friend.handle}</span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProfileView;
