
'use client';
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Share2, MoreHorizontal, UserPlus, Check, MessageSquare, Video, Phone, BadgeCheck, UserCheck, Clock, Link as LinkIcon, MessageSquareText, AlertTriangle, VolumeX, UserX, Loader2 } from 'lucide-react';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import { FriendshipStatus } from '@/app/profile/[handle]/page';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EditProfileDialog, { type ProfileData } from './edit-profile-dialog';
import Link from 'next/link';
import LikesView from './likes-view';
import type { CurrentUser } from './social-dashboard';
import { Timestamp } from 'firebase/firestore';
import PostCardSkeleton from './post-card-skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';


interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    isProfessional?: boolean;
    bio?: string;
    friendsCount?: number;
    businessUrl?: string;
    gender?: string;
    dateOfBirth?: Timestamp;
}

interface ProfileViewProps {
    user: UserProfile | null;
    posts: Post[];
    currentUser: CurrentUser;
    isCurrentUser: boolean;
    friendshipStatus: FriendshipStatus;
    onFriendAction: (action: 'add' | 'cancel' | 'accept' | 'reject' | 'unfriend' | 'block' | 'unblock', targetUser: UserProfile) => void;
    onMessage: () => void;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
    onStartCall: (type: 'audio' | 'video') => void;
    onUpdateProfile: (data: ProfileData) => Promise<boolean>;
    onReportPost: (post: Post) => void;
    onMuteUser: (user: Post['author']) => void;
    isBlocked: boolean;
    isLoadingPosts: boolean;
    hasMorePosts: boolean;
    loadMorePosts: () => void;
    isLoadingMore: boolean;
}

const formatCount = (num: number = 0) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};


const ProfileView = ({ user, posts, currentUser, isCurrentUser, friendshipStatus, onFriendAction, onMessage, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds, onStartCall, onUpdateProfile, onReportPost, onMuteUser, isBlocked, isLoadingPosts, hasMorePosts, loadMorePosts, isLoadingMore }: ProfileViewProps) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    
    const handleProfileUpdate = async (data: ProfileData) => {
        const success = await onUpdateProfile(data);
        if (success) {
            setIsEditOpen(false);
        }
        return success;
    };

    if (!user) {
        return <ProfileViewSkeleton />;
    }

    const mediaPosts = posts.filter(post => post.imageUrl || post.videoUrl);

    if (isBlocked) {
        return (
             <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <UserX className="h-12 w-12 mx-auto mb-4 text-destructive" />
                    <h3 className="text-xl font-semibold">User Blocked</h3>
                    <p>You have blocked this user. You cannot see their profile or posts.</p>
                    <Button variant="outline" className="mt-4" onClick={() => onFriendAction('unblock', user)}>
                        Unblock @{user.handle}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const RelationshipButton = () => {
        if (isCurrentUser) {
            return <Button variant="outline" onClick={() => setIsEditOpen(true)}>Edit Profile</Button>;
        }
        
        switch (friendshipStatus) {
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
            case 'request_sent':
                 return (
                    <Button variant="secondary" onClick={() => onFriendAction('cancel', user)}>
                        <Clock className="mr-2 h-4 w-4" /> Request Sent
                    </Button>
                );
            case 'request_received':
                 return (
                    <div className="flex gap-2">
                        <Button onClick={() => onFriendAction('accept', user)}>
                            <Check className="mr-2 h-4 w-4" /> Accept
                        </Button>
                        <Button variant="secondary" onClick={() => onFriendAction('reject', user)}>
                            Reject
                        </Button>
                    </div>
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
                    <Avatar className="w-32 h-32 -mt-16 border-4 border-background">
                        <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar" />
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                           <CardTitle className="text-3xl font-bold">{user.name}</CardTitle>
                           {user.isProfessional && <BadgeCheck className="h-8 w-8 text-primary" />}
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
                            <div>
                                <span className="font-bold text-foreground">{formatCount(user.friendsCount)}</span> Friends
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 self-start md:self-auto">
                        {!isCurrentUser && (
                            <>
                                <Button variant="outline" onClick={onMessage}><MessageSquare className="mr-2 h-4 w-4"/> Message</Button>
                                <Button variant="outline" size="icon" onClick={() => onStartCall('video')}><Video className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={() => onStartCall('audio')}><Phone className="h-4 w-4" /></Button>
                            </>
                        )}
                        <RelationshipButton />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share Profile
                                </DropdownMenuItem>
                                {!isCurrentUser && (
                                     <>
                                        <DropdownMenuItem onClick={() => onMuteUser(user)}>
                                            <VolumeX className="mr-2 h-4 w-4" />
                                            Mute @{user.handle}
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                    <UserX className="mr-2 h-4 w-4" />
                                                    Block @{user.handle}
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Block @{user.handle}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        They will not be able to find your profile, posts or message you. They will not be notified that you blocked them.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onFriendAction('block', user)} className="bg-destructive hover:bg-destructive/90">
                                                        Block
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="posts" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="posts">Posts</TabsTrigger>
                    <TabsTrigger value="replies">Replies</TabsTrigger>
                    <TabsTrigger value="media">Media</TabsTrigger>
                    <TabsTrigger value="likes">Likes</TabsTrigger>
                </TabsList>
                <TabsContent value="posts" className="space-y-4 mt-4">
                    {isLoadingPosts ? (
                        [...Array(2)].map((_, i) => <PostCardSkeleton key={i} />)
                    ) : posts.length > 0 ? (
                         posts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} onReact={onReact} onCommentClick={onComment} onSavePost={onSavePost} onDeletePost={onDeletePost} userReaction={userReactions.get(post.id)} isSaved={savedPostIds.has(post.id)} onReportPost={onReportPost} onMuteUser={onMuteUser}/>)
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <CardTitle className="mb-2">No Posts Yet</CardTitle>
                                <CardDescription>This user hasn't posted anything.</CardDescription>
                            </CardContent>
                        </Card>
                    )}
                     {hasMorePosts && !isLoadingPosts && (
                        <div className="flex justify-center">
                            <Button onClick={loadMorePosts} disabled={isLoadingMore}>
                                {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Load More'}
                            </Button>
                        </div>
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
                             {mediaPosts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} onReact={onReact} onCommentClick={onComment} onSavePost={onSavePost} onDeletePost={onDeletePost} userReaction={userReactions.get(post.id)} isSaved={savedPostIds.has(post.id)} onReportPost={onReportPost} onMuteUser={onMuteUser} />)}
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
                        onReportPost={onReportPost}
                        onMuteUser={onMuteUser}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ProfileView;
