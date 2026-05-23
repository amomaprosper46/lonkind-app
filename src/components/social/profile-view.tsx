
'use client';
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Share2, MoreHorizontal, UserPlus, Check, MessageSquare, Video, Phone, BadgeCheck, UserCheck, Clock, Link as LinkIcon, MessageSquareText } from 'lucide-react';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import { FollowStatus } from '@/app/profile/[handle]/page';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EditProfileDialog, { type ProfileData } from './edit-profile-dialog';
import Link from 'next/link';
import LikesView from './likes-view';
import type { CurrentUser } from './social-dashboard';


interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    isProfessional?: boolean;
    bio?: string;
    followersCount?: number;
    followingCount?: number;
    businessUrl?: string;
}

interface ProfileViewProps {
    user: UserProfile;
    posts: Post[];
    currentUser: CurrentUser;
    isCurrentUser: boolean;
    followStatus: FollowStatus;
    onFollowAction: (action: 'follow' | 'unfollow', targetUser: UserProfile) => void;
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


const ProfileView = ({ user, posts, currentUser, isCurrentUser, followStatus, onFollowAction, onMessage, onReact, onComment, onSavePost, onDeletePost, userReactions, savedPostIds, onStartCall, onUpdateProfile }: ProfileViewProps) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    
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
        
        switch (followStatus) {
            case 'following':
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button><UserCheck className="mr-2 h-4 w-4" /> Following</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onFollowAction('unfollow', user)} className="text-destructive">
                                Unfollow
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            case 'not_following':
            default:
                return <Button variant="outline" onClick={() => onFollowAction('follow', user)}><UserPlus className="mr-2 h-4 w-4" /> Follow</Button>;
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
                                <span className="font-bold text-foreground">{formatCount(user.followersCount)}</span> Followers
                            </div>
                            <div>
                                <span className="font-bold text-foreground">{formatCount(user.followingCount)}</span> Following
                            </div>
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
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent><p>More Options</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
            </Tabs>
        </div>
    );
};

export default ProfileView;
