'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Users, UserPlus, Mail, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import CreatePostCard from './create-post-card';
import PostCard from './post-card';
import type { Post, ReactionType } from './post-card';
import type { CurrentUser } from './social-dashboard';
import type { Group } from './groups-view';
import ngeohash from 'ngeohash';

interface NewPostMedia {
    file: File;
    url: string;
    type: 'image' | 'video';
}

interface GroupDetailsViewProps {
    groupId: string;
    currentUser: CurrentUser;
    onReact: (postId: string, reaction: ReactionType, authorUid: string) => void;
    onComment: (post: Post) => void;
    onSavePost: (postId: string) => void;
    onDeletePost: (postId: string) => void;
    userReactions: Map<string, ReactionType>;
    savedPostIds: Set<string>;
}

const getUserLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
        } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
            });
        }
    });
};

export default function GroupDetailsView({ 
    groupId,
    currentUser, 
    onReact,
    onComment,
    onSavePost,
    onDeletePost,
    userReactions,
    savedPostIds
}: GroupDetailsViewProps) {
    const [group, setGroup] = useState<Group | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostMedia, setNewPostMedia] = useState<NewPostMedia | null>(null);
    const [isCreatingPost, setIsCreatingPost] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const groupRef = doc(db, 'groups', groupId);

        const unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
            if (docSnap.exists()) {
                setGroup({ id: docSnap.id, ...docSnap.data() } as Group);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Group not found.' });
            }
        });

        const postsRef = collection(db, 'posts');
        const q = query(postsRef, where('groupId', '==', groupId), orderBy('timestamp', 'desc'));

        const unsubscribePosts = onSnapshot(q, (snapshot) => {
            const postList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setPosts(postList);
            setIsLoading(false);
        });

        return () => {
            unsubscribeGroup();
            unsubscribePosts();
        };
    }, [groupId]);

    const handleCreatePost = async () => {
        if (!currentUser || (!newPostContent.trim() && !newPostMedia) || !group) return;
        setIsCreatingPost(true);

        try {
            let mediaUrl: string | undefined;
            let mediaType: 'image' | 'video' | undefined;
            let geohash: string | undefined;

             try {
                const location = await getUserLocation();
                geohash = ngeohash.encode(location.coords.latitude, location.coords.longitude, 7);
            } catch (locationError) {
                console.warn("Could not get user location:", locationError);
            }

            if (newPostMedia) {
                const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${newPostMedia.file.name}`);
                const snapshot = await uploadBytes(storageRef, newPostMedia.file);
                mediaUrl = await getDownloadURL(snapshot.ref);
                mediaType = newPostMedia.type;
            }
            
            const postData: any = {
                author: {
                    name: currentUser.name,
                    handle: currentUser.handle,
                    avatarUrl: currentUser.avatarUrl,
                    uid: currentUser.uid,
                    isProfessional: currentUser.isProfessional || false,
                },
                content: newPostContent,
                reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
                comments: 0,
                timestamp: serverTimestamp(),
                groupId: group.id,
            };
            if(mediaType === 'image' && mediaUrl) postData.imageUrl = mediaUrl;
            if(mediaType === 'video' && mediaUrl) postData.videoUrl = mediaUrl;
            if(geohash) postData.geohash = geohash;

            await addDoc(collection(db, 'posts'), postData);
            
            setNewPostContent('');
            setNewPostMedia(null);
            toast({ title: 'Post created!', description: `Your post has been added to ${group.name}.` });
        } catch (e) {
            console.error("Error during post creation: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create post. Please try again.' });
        } finally {
            setIsCreatingPost(false);
        }
    };
    
    const handleJoinLeaveGroup = async () => {
        if (!group) return;
        const groupRef = doc(db, 'groups', group.id);
        const isMember = group.members.includes(currentUser.uid);

        try {
            if (isMember) {
                await updateDoc(groupRef, {
                    members: arrayRemove(currentUser.uid),
                    memberCount: increment(-1),
                });
                toast({ title: "You've left the group" });
            } else {
                 await updateDoc(groupRef, {
                    members: arrayUnion(currentUser.uid),
                    memberCount: increment(1),
                });
                toast({ title: 'Group Joined!', description: `You are now a member of ${group.name}.` });
            }
        } catch(e) {
            console.error("Error joining/leaving group", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update your group membership.' });
        }
    }


    if (isLoading) {
        return <div className="col-span-9 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!group) {
        return (
            <main className="col-span-9">
                 <Card>
                    <CardHeader>
                        <CardTitle>Group Not Found</CardTitle>
                        <CardDescription>This group may have been deleted or the link is incorrect.</CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }
    
    const isMember = group.members.includes(currentUser.uid);

    return (
        <main className="col-span-12 md:col-span-8 lg:col-span-6">
            <Card className="mb-6 overflow-hidden">
                <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${group.coverUrl})` }} />
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <CardTitle className="text-3xl">{group.name}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-2">
                                <Users className="h-4 w-4" /> {group.memberCount} members
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button onClick={handleJoinLeaveGroup}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                {isMember ? 'Leave Group' : 'Join Group'}
                            </Button>
                            <Button variant="outline"><Mail className="mr-2 h-4 w-4" /> Message All</Button>
                            <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                </CardContent>
            </Card>
            
            {isMember ? (
                <>
                    <CreatePostCard
                        currentUser={currentUser}
                        newPostContent={newPostContent}
                        setNewPostContent={setNewPostContent}
                        newPostMedia={newPostMedia}
                        setNewPostMedia={setNewPostMedia}
                        handleCreatePost={handleCreatePost}
                        isCreatingPost={isCreatingPost}
                    />
                     <div className="space-y-6 mt-8">
                        {posts.length > 0 ? (
                            posts.map(post => (
                                <PostCard 
                                    key={post.id} 
                                    post={post}
                                    currentUserUid={currentUser.uid}
                                    onReact={onReact} 
                                    onCommentClick={onComment} 
                                    onSavePost={onSavePost} 
                                    onDeletePost={onDeletePost}
                                    userReaction={userReactions.get(post.id)} 
                                    isSaved={savedPostIds.has(post.id)}
                                />
                            ))
                        ) : (
                            <Card>
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    <h3 className="text-xl font-semibold">This Group is Quiet</h3>
                                    <p>Be the first to post something in this group!</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <h3 className="text-xl font-semibold">Join to Participate</h3>
                        <p>You must be a member of this group to see and create posts.</p>
                        <Button className="mt-4" onClick={handleJoinLeaveGroup}>
                            <UserPlus className="mr-2 h-4 w-4" /> Join Group
                        </Button>
                    </CardContent>
                </Card>
            )}

        </main>
    );
}