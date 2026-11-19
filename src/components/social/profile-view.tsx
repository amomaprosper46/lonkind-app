'use client';

import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Share2,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  MessageSquare,
  Video,
  Phone,
  BadgeCheck,
  UserCheck,
  Link as LinkIcon,
  Star,
  Heart,
  Medal,
  Camera,
  Settings,
  Users,
  Lock,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Search,
  Loader2,
  Scissors,
} from 'lucide-react';
import type { Post, ReactionType } from './post-card';
import PostCard from './post-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditProfileDialog, { type ProfileData } from './edit-profile-dialog';
import ProfileRoast from './profile-roast';
import AvatarGenerator from './avatar-generator';
import Link from 'next/link';
import LikesView from './likes-view';
import type { CurrentUser } from './social-dashboard';
import UnifiedReportDialog from './unified-report-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';
import UpcomingLivesBanner, { type ScheduledStreamDoc } from './upcoming-lives-banner';
import { ProfileClipsTab } from './live-clip-recorder';

interface UserProfile {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
  coverUrl?: string;
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
  onOpenSettings?: () => void;
  onWatchLive?: (hostUid: string) => void;
  onStartScheduledLive?: (event: ScheduledStreamDoc) => void;
}

const formatCount = (num: number = 0) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

function ProfileFriendCard({ friend, onCloseModal }: { friend: any; onCloseModal?: () => void }) {
  const liveFriend = useLiveUserProfile(friend.uid, friend.avatarUrl, friend.name, friend.handle);
  const isVerified =
    Boolean(friend.isProfessional) ||
    liveFriend.handle?.toLowerCase() === 'lonkind' ||
    liveFriend.handle?.toLowerCase() === 'admin_lonkind';

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-secondary/25 hover:bg-secondary/45 border border-border/50 hover:border-indigo-500/40 transition-all group">
      <Link
        href={`/profile/${liveFriend.handle}`}
        onClick={onCloseModal}
        className="flex items-center gap-3 min-w-0 flex-1"
      >
        <Avatar className="h-12 w-12 border-2 border-indigo-500/20 group-hover:border-indigo-500/50 transition-all shrink-0">
          <AvatarImage src={liveFriend.avatarUrl} alt={liveFriend.name} />
          <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold">
            {liveFriend.name?.charAt(0) || 'F'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-foreground group-hover:text-indigo-400 transition-colors truncate">
              {liveFriend.name}
            </span>
            {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground truncate">@{liveFriend.handle}</span>
        </div>
      </Link>

      <div className="flex items-center gap-1.5 shrink-0">
        <Link href={`/?view=messages&user=${friend.uid}`} onClick={onCloseModal}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 rounded-xl text-xs gap-1 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/15"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Message</span>
          </Button>
        </Link>
        <Button asChild size="sm" variant="ghost" className="h-8 px-2.5 rounded-xl text-xs">
          <Link href={`/profile/${liveFriend.handle}`} onClick={onCloseModal}>
            Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}

const ProfileView = ({
  user,
  posts,
  currentUser,
  isCurrentUser,
  friendStatus,
  onFriendAction,
  onMessage,
  onReact,
  onComment,
  onSavePost,
  onDeletePost,
  userReactions,
  savedPostIds,
  onStartCall,
  onUpdateProfile,
  onOpenSettings,
  onWatchLive,
  onStartScheduledLive,
}: ProfileViewProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFriendsDialogOpen, setIsFriendsDialogOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [isApprovedFollower, setIsApprovedFollower] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [activeProfileTab, setActiveProfileTab] = useState<string>('posts');

  // Check real-time if currentUser is in this creator's `followers` subcollection
  useEffect(() => {
    if (!user?.uid || !currentUser?.uid || isCurrentUser) {
      setIsApprovedFollower(isCurrentUser);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'followers', currentUser.uid),
      (snap) => setIsApprovedFollower(snap.exists()),
      () => setIsApprovedFollower(false)
    );
    return () => unsub();
  }, [user?.uid, currentUser?.uid, isCurrentUser]);

  // Real-time subscription to user's friends subcollection so count & Friends tab are always accurate
  useEffect(() => {
    if (!user?.uid) return;
    setIsLoadingFriends(true);
    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsub = onSnapshot(
      friendsRef,
      (snap) => {
        setFriendsList(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        setIsLoadingFriends(false);
      },
      () => {
        setIsLoadingFriends(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const isCallerAdmin =
    currentUser?.name?.trim().toLowerCase() === 'lonkind' ||
    currentUser?.handle?.toLowerCase() === 'lonkind' ||
    currentUser?.email?.toLowerCase() === 'admin@lonkind.com' ||
    currentUser?.handle === 'admin_lonkind' ||
    Boolean((currentUser as any)?.isAdmin);

  const handleSetProfessional = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isProfessional: true,
      });
      toast({ title: 'Account Upgraded', description: `${user.name} is now a verified professional creator.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update account status.' });
    }
  };

  const handleShareProfile = async () => {
    const profileUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/profile/${user.handle}` : `/profile/${user.handle}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${user.name} (@${user.handle}) on Lonkind`,
          text: user.bio || `Connect with ${user.name} on Lonkind!`,
          url: profileUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: 'Profile Link Copied!',
        description: `${profileUrl} copied to your clipboard.`,
      });
    }
  };

  const handleViewFriendsModal = () => {
    if (!canViewPrivateContent) {
      toast({ title: 'Private Account', description: 'Follow this user and wait for approval to view their private content.' });
      return;
    }
    setIsFriendsDialogOpen(true);
  };

  const handleProfileUpdate = async (data: ProfileData) => {
    const success = await onUpdateProfile(data);
    if (success) {
      setIsEditOpen(false);
    }
    return success;
  };

  const mediaPosts = posts.filter((post) => post.imageUrl || post.videoUrl);
  const totalReactionsReceived = posts.reduce((acc, post) => {
    if (!post.reactions) return acc;
    return acc + Object.values(post.reactions).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, 0);
  const liveFriendsCount = Math.max(friendsList.length, user.friendsCount || 0);
  const canViewPrivateContent =
    isCurrentUser ||
    user.followerPrivacy !== 'private' ||
    friendStatus === 'friends' ||
    isApprovedFollower;
  const canViewFriendsList = canViewPrivateContent;

  const filteredFriends = friendsList.filter(
    (f) =>
      !friendSearchQuery.trim() ||
      f.name?.toLowerCase().includes(friendSearchQuery.trim().toLowerCase()) ||
      f.handle?.toLowerCase().includes(friendSearchQuery.trim().toLowerCase())
  );

  const RelationshipButton = () => {
    if (isCurrentUser) {
      return (
        <Button
          onClick={() => setIsEditOpen(true)}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5 shadow-md"
        >
          <Camera className="h-4 w-4" />
          Edit Profile
        </Button>
      );
    }

    switch (friendStatus) {
      case 'friends':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                <UserCheck className="mr-2 h-4 w-4" /> Friends
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl">
              <DropdownMenuItem onClick={() => onFriendAction('unfriend', user)} className="text-destructive cursor-pointer">
                Remove Friend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case 'pending_sent':
        return (
          <Button variant="outline" onClick={() => onFriendAction('cancel', user)} className="rounded-xl text-muted-foreground">
            <UserMinus className="mr-2 h-4 w-4" /> Request Sent
          </Button>
        );
      case 'pending_received':
        return (
          <Button
            variant="default"
            onClick={() => onFriendAction('accept', user)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Accept Request
          </Button>
        );
      case 'not_friends':
      default:
        return (
          <Button
            onClick={() => onFriendAction('add', user)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add Friend
          </Button>
        );
    }
  };

  return (
    <div className="w-full space-y-6">
      {isCurrentUser && (
        <EditProfileDialog
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          currentUser={user}
          onSave={handleProfileUpdate}
        />
      )}

      {/* Profile Hero Header Card */}
      <Card className="rounded-3xl border-border/60 shadow-xl overflow-hidden bg-card">
        {/* Cover Banner */}
        <div className="relative h-44 sm:h-56 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 overflow-hidden">
          {user.coverUrl && (
            <img src={user.coverUrl} alt={`${user.name} cover`} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
          {isCurrentUser && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsEditOpen(true)}
              className="absolute bottom-3 right-3 rounded-xl gap-1.5 bg-slate-950/80 text-white hover:bg-slate-900 border border-white/15 shadow-lg text-xs font-bold backdrop-blur-md"
            >
              <Camera className="h-3.5 w-3.5 text-indigo-400" />
              Edit Cover & Profile
            </Button>
          )}
        </div>

        {/* Profile Info & Actions */}
        <CardContent className="p-5 sm:p-6 pt-0">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 -mt-14 sm:-mt-16 relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="relative cursor-pointer group shrink-0">
                    <Avatar className="w-28 h-28 sm:w-32 sm:h-32 border-4 border-background shadow-2xl group-hover:opacity-95 transition-opacity">
                      <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar" />
                      <AvatarFallback className="bg-indigo-600 text-white font-extrabold text-3xl">
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {isCurrentUser && (
                      <span className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-background">
                        <Camera className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => window.open(user.avatarUrl, '_blank')} className="cursor-pointer">
                    View Full Photo
                  </DropdownMenuItem>
                  {isCurrentUser && (
                    <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="cursor-pointer">
                      Change Profile Picture
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="space-y-1 pb-1">
                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">{user.name}</CardTitle>
                  {(user.isProfessional ||
                    user.handle?.toLowerCase() === 'lonkind' ||
                    user.handle === 'admin_lonkind') && (
                    <span title="Verified">
                      <BadgeCheck className="h-6 w-6 text-indigo-400 shrink-0" />
                    </span>
                  )}
                  {user.badges?.includes('Top Creator') && (
                    <span title="Top Creator">
                      <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                    </span>
                  )}
                  {user.badges?.includes('Top Supporter') && (
                    <span title="Top Supporter">
                      <Heart className="h-5 w-5 fill-pink-500 text-pink-500" />
                    </span>
                  )}
                  {user.badges?.includes('Whale') && (
                    <span title="Whale">
                      <Medal className="h-5 w-5 fill-amber-500 text-amber-500" />
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm sm:text-base font-medium">@{user.handle}</p>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!isCurrentUser && (
                <>
                  <Button variant="outline" onClick={onMessage} className="rounded-xl font-semibold">
                    <MessageSquare className="mr-2 h-4 w-4 text-indigo-400" /> Message
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Audio Call"
                    onClick={() => onStartCall('audio')}
                    className="rounded-xl text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Video Call"
                    onClick={() => onStartCall('video')}
                    className="rounded-xl text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                </>
              )}

              <RelationshipButton />

              {isCurrentUser && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (onOpenSettings) onOpenSettings();
                    else window.location.href = '/settings';
                  }}
                  className="rounded-xl gap-1.5 font-semibold"
                >
                  <Settings className="h-4 w-4 text-indigo-400" />
                  <span>Settings</span>
                </Button>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleShareProfile} className="rounded-xl">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Share Profile Link</p>
                  </TooltipContent>
                </Tooltip>

                {(!isCurrentUser || isCallerAdmin) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="rounded-xl">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      {!isCurrentUser && (
                        <>
                          <DropdownMenuItem onClick={() => setIsReportOpen(true)} className="cursor-pointer">
                            Report User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() =>
                              toast({
                                title: 'User Blocked',
                                description: 'You will no longer see content from this user.',
                              })
                            }
                          >
                            Block User
                          </DropdownMenuItem>
                        </>
                      )}
                      {isCallerAdmin && (
                        <>
                          {!isCurrentUser && <DropdownMenuSeparator />}
                          <DropdownMenuItem onClick={handleSetProfessional} className="cursor-pointer text-indigo-400">
                            Grant Verified Badge
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TooltipProvider>
            </div>
          </div>

          {/* Bio, Website & Interactive Stat Pills */}
          <div className="mt-5 pt-4 border-t border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 text-center md:text-left max-w-2xl">
              <p className="text-sm text-foreground/90 leading-relaxed">
                {user.bio || (isCurrentUser ? 'Add a bio to tell the community about yourself.' : 'No bio yet.')}
              </p>
              {user.businessUrl && (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:underline">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <a href={user.businessUrl} target="_blank" rel="noopener noreferrer">
                    {user.businessUrl.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>

            {/* Stat Pills */}
            <div className="flex items-center justify-center md:justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveProfileTab('posts')}
                className="px-4 py-2 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/50 text-center transition-colors"
              >
                <div className="text-base sm:text-lg font-extrabold text-foreground">{formatCount(posts.length)}</div>
                <div className="text-[11px] text-muted-foreground font-semibold">Posts</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (canViewFriendsList) setActiveProfileTab('friends');
                  else handleViewFriendsModal();
                }}
                className="px-4 py-2 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/50 text-center transition-colors"
              >
                <div className="text-base sm:text-lg font-extrabold text-foreground">
                  {formatCount(liveFriendsCount)}
                </div>
                <div className="text-[11px] text-muted-foreground font-semibold">Friends</div>
              </button>

              <div className="px-4 py-2 rounded-2xl bg-secondary/40 border border-border/50 text-center">
                <div className="text-base sm:text-lg font-extrabold text-foreground">
                  {formatCount(totalReactionsReceived)}
                </div>
                <div className="text-[11px] text-muted-foreground font-semibold">Reactions</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {currentUser && !isCurrentUser && (
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

      {/* Creator's Upcoming Scheduled Lives Row */}
      <UpcomingLivesBanner
        currentUser={currentUser}
        hostFilterUid={user.uid}
        showEmptyForCreator={isCurrentUser}
        onWatchLive={(hostUid) => {
          if (onWatchLive) {
            onWatchLive(hostUid);
          } else if (typeof window !== 'undefined') {
            window.location.href = `/?view=live&host=${encodeURIComponent(hostUid)}`;
          }
        }}
        onStartScheduledLive={(event) => {
          if (onStartScheduledLive) {
            onStartScheduledLive(event);
          } else if (typeof window !== 'undefined') {
            window.location.href = `/?view=live&scheduleId=${encodeURIComponent(event.id)}`;
          }
        }}
      />

      {/* Profile Content Tabs */}
      <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab} className="w-full space-y-5">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto p-1.5 gap-1 bg-slate-900/90 border border-border/60 rounded-2xl">
          <TabsTrigger
            value="posts"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <FileText className="h-3.5 w-3.5 hidden sm:inline" />
            <span>Posts ({posts.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="clips"
            className="rounded-xl py-2.5 text-xs font-bold text-rose-300 flex items-center justify-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white"
          >
            <Scissors className="h-3.5 w-3.5" />
            <span>Clips</span>
          </TabsTrigger>

          <TabsTrigger
            value="media"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <ImageIcon className="h-3.5 w-3.5 hidden sm:inline" />
            <span>Media ({mediaPosts.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="friends"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Users className="h-3.5 w-3.5 hidden sm:inline" />
            <span>Friends ({liveFriendsCount})</span>
          </TabsTrigger>

          <TabsTrigger
            value="likes"
            className="rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Heart className="h-3.5 w-3.5 hidden sm:inline" />
            <span>Likes</span>
          </TabsTrigger>

          <TabsTrigger
            value="ai"
            className="rounded-xl py-2.5 text-xs font-bold text-amber-400 flex items-center justify-center gap-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: POSTS */}
        <TabsContent value="posts" className="mt-0 space-y-4 focus-visible:outline-none">
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onReact={onReact}
                  onCommentClick={onComment}
                  onSavePost={onSavePost}
                  onDeletePost={onDeletePost}
                  userReaction={userReactions.get(post.id)}
                  isSaved={savedPostIds.has(post.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-10 text-center text-muted-foreground space-y-2">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <CardTitle className="text-lg">No Posts Yet</CardTitle>
                <CardDescription>
                  {isCurrentUser
                    ? 'You have not shared any posts yet. Head to the Home Feed to create your first post!'
                    : 'This user has not posted anything yet.'}
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: MEDIA */}
        <TabsContent value="media" className="mt-0 space-y-4 focus-visible:outline-none">
          {mediaPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mediaPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onReact={onReact}
                  onCommentClick={onComment}
                  onSavePost={onSavePost}
                  onDeletePost={onDeletePost}
                  userReaction={userReactions.get(post.id)}
                  isSaved={savedPostIds.has(post.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-10 text-center text-muted-foreground space-y-2">
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <CardTitle className="text-lg">No Photos or Videos Yet</CardTitle>
                <CardDescription>
                  {isCurrentUser
                    ? 'Photos and videos you share in your posts will appear here.'
                    : 'This user has not posted any photos or videos.'}
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: FRIENDS LIST RIGHT ON PROFILE */}
        <TabsContent value="friends" className="mt-0 space-y-4 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-5 space-y-4">
              {!canViewFriendsList ? (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <Lock className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="font-bold text-base text-foreground">Private Friends List</p>
                  <p className="text-xs">This user has set their friends list to private.</p>
                </div>
              ) : isLoadingFriends ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2 text-indigo-500" />
                  <p className="text-xs">Loading friends...</p>
                </div>
              ) : friendsList.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="font-bold text-base text-foreground">No Friends Yet</p>
                  <p className="text-xs">
                    {isCurrentUser
                      ? 'Open Friends & Connections to discover and add friends on Lonkind.'
                      : 'This user has not added any friends yet.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-400" />
                        {isCurrentUser ? 'Your Friends' : `${user.name}'s Friends`} ({friendsList.length})
                      </h3>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search friends..."
                        value={friendSearchQuery}
                        onChange={(e) => setFriendSearchQuery(e.target.value)}
                        className="pl-9 h-9 rounded-xl bg-secondary/40 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredFriends.map((friend) => (
                      <ProfileFriendCard key={friend.uid} friend={friend} />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: LIVE HIGHLIGHT CLIPS */}
        <TabsContent value="clips" className="mt-0 space-y-4 focus-visible:outline-none">
          <ProfileClipsTab
            creatorUid={user.uid}
            creatorName={user.name}
            currentUserUid={currentUser?.uid}
            isOwnProfile={isCurrentUser}
          />
        </TabsContent>

        {/* TAB 4: LIKES */}
        <TabsContent value="likes" className="mt-0 space-y-4 focus-visible:outline-none">
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

        {/* TAB 5: AI STUDIO */}
        <TabsContent value="ai" className="mt-0 space-y-5 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🔥 Profile Roast</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Let AI roast {isCurrentUser ? 'your' : `@${user.handle}'s`} profile. Screenshot and share!
              </p>
              <ProfileRoast user={user} postCount={posts.length} isCurrentUser={isCurrentUser} />
            </CardContent>
          </Card>
          {isCurrentUser && (
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🎨 AI Avatar Creator</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate unique avatar concepts in any art style. Screenshot and flex!
                </p>
                <AvatarGenerator user={user} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Friends Modal Dialog */}
      <Dialog open={isFriendsDialogOpen} onOpenChange={setIsFriendsDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              Friends ({liveFriendsCount})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3 mt-2">
            {isLoadingFriends ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : friendsList.length === 0 ? (
              <div className="text-center text-muted-foreground p-6">No friends yet.</div>
            ) : (
              friendsList.map((friend) => (
                <ProfileFriendCard
                  key={friend.uid}
                  friend={friend}
                  onCloseModal={() => setIsFriendsDialogOpen(false)}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileView;
