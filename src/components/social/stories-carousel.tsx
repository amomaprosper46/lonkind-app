'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, X, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import type { CurrentUser } from './social-dashboard';
import { compressImage } from '@/lib/image-compression';

export interface Story {
    id: string;
    authorUid: string;
    authorHandle: string;
    authorName: string;
    authorAvatarUrl: string;
    mediaUrl: string;
    timestamp: any;
    expiresAt: any;
}

interface StoriesCarouselProps {
    currentUser: CurrentUser;
    followingUids: string[];
    blockedUids: string[];
}

export default function StoriesCarousel({ currentUser, followingUids, blockedUids }: StoriesCarouselProps) {
    const [stories, setStories] = useState<Story[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);

    // Group stories by user
    const groupedStories = React.useMemo(() => {
        const groups = new Map<string, Story[]>();
        stories.forEach(story => {
            if (!groups.has(story.authorUid)) {
                groups.set(story.authorUid, []);
            }
            groups.get(story.authorUid)!.push(story);
        });
        return Array.from(groups.values());
    }, [stories]);

    useEffect(() => {
        if (!followingUids || followingUids.length === 0) {
            setIsLoading(false);
            return;
        }

        const now = Timestamp.now();
        const storiesRef = collection(db, 'stories');
        
        let validUids = followingUids.filter(uid => !blockedUids.includes(uid));
        if (validUids.length === 0) {
            setIsLoading(false);
            setStories([]);
            return;
        }

        const q = query(
            storiesRef,
            where('authorUid', 'in', validUids.slice(0, 30)),
            where('expiresAt', '>', now),
            orderBy('expiresAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedStories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
            // Also fetch current user's stories if not in the first 30 following
            setStories(fetchedStories.sort((a, b) => a.timestamp?.toMillis() - b.timestamp?.toMillis()));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching stories:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [followingUids, blockedUids]);

    const hasMyStory = groupedStories.some(group => group[0].authorUid === currentUser.uid);

    return (
        <div className="w-full mb-6 relative">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                
                {/* Create / My Story Button */}
                <div 
                    className="relative flex flex-col group min-w-[110px] w-[110px] h-[190px] rounded-xl overflow-hidden cursor-pointer snap-start bg-card border shadow-sm hover:brightness-95 transition-all" 
                    onClick={() => {
                        const myGroupIndex = groupedStories.findIndex(g => g[0].authorUid === currentUser.uid);
                        if (myGroupIndex !== -1) {
                            setSelectedStoryIndex(myGroupIndex);
                        } else {
                            setIsCreateOpen(true);
                        }
                    }}>
                    {hasMyStory ? (
                        <>
                            <div className="absolute inset-0 bg-black/20 z-10" />
                            <img src={groupedStories.find(g => g[0].authorUid === currentUser.uid)?.[0].mediaUrl || currentUser?.avatarUrl} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 z-20 rounded-full border-2 border-primary">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={currentUser?.avatarUrl} alt="You" />
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                            </div>
                            <span className="absolute bottom-2 left-2 right-2 text-[11px] font-semibold text-white z-20 truncate drop-shadow-md">
                                Your Story
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="h-[65%] w-full relative overflow-hidden">
                                <img src={currentUser?.avatarUrl || ''} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <div className="h-[35%] w-full bg-card flex flex-col items-center justify-end pb-2 relative">
                                <div className="absolute -top-4 bg-primary text-primary-foreground rounded-full p-1 border-4 border-card">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <span className="text-[11px] font-semibold">Create Story</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Other Users' Stories */}
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="min-w-[110px] w-[110px] h-[190px] rounded-xl bg-muted animate-pulse snap-start" />
                    ))
                ) : (
                    groupedStories.filter(g => g[0].authorUid !== currentUser.uid).map((userStories, index) => (
                        <div 
                            key={userStories[0].authorUid} 
                            className="relative flex flex-col min-w-[110px] w-[110px] h-[190px] rounded-xl overflow-hidden cursor-pointer snap-start bg-slate-800 shadow-sm hover:brightness-95 transition-all group" 
                            onClick={() => setSelectedStoryIndex(index + (hasMyStory ? 1 : 0))}>
                            
                            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 z-10" />
                            <img src={userStories[0].mediaUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            
                            <div className="absolute top-2 left-2 z-20 rounded-full border-[2.5px] border-primary ring-2 ring-background/20 overflow-hidden">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={userStories[0].authorAvatarUrl} alt={userStories[0].authorName} />
                                    <AvatarFallback>{userStories[0].authorName.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                            
                            <span className="absolute bottom-2 left-2 right-2 text-[11px] font-semibold text-white z-20 truncate drop-shadow-md">
                                {userStories[0].authorName.split(' ')[0]}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {isCreateOpen && (
                <CreateStoryDialog currentUser={currentUser} onClose={() => setIsCreateOpen(false)} />
            )}

            {selectedStoryIndex !== null && (
                <StoryViewer 
                    groupedStories={groupedStories} 
                    initialGroupIndex={selectedStoryIndex} 
                    onClose={() => setSelectedStoryIndex(null)} 
                />
            )}
        </div>
    );
}

function CreateStoryDialog({ currentUser, onClose }: { currentUser: CurrentUser, onClose: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        try {
            const fileToUpload = await compressImage(file);
            const storageRef = ref(storage, `stories/${currentUser.uid}/${Date.now()}_${fileToUpload.name}`);
            const uploadTask = await uploadBytesResumable(storageRef, fileToUpload);
            const downloadUrl = await getDownloadURL(uploadTask.ref);

            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

            await addDoc(collection(db, 'stories'), {
                authorUid: currentUser?.uid || '',
                authorHandle: currentUser?.handle || '',
                authorName: currentUser?.name || 'Unknown',
                authorAvatarUrl: currentUser?.avatarUrl || '',
                mediaUrl: downloadUrl,
                timestamp: serverTimestamp(),
                expiresAt: Timestamp.fromDate(expiresAt)
            });

            toast({ title: 'Story added!', description: 'Your story will disappear in 24 hours.' });
            onClose();
        } catch (error) {
            console.error('Error uploading story:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not upload story.' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add to your Story</DialogTitle>
                    <DialogDescription>Share a photo that disappears in 24 hours.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                    {preview ? (
                        <div className="relative w-full aspect-[9/16] max-h-[60vh] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                            <img src={preview} alt="Preview" className="object-contain w-full h-full" />
                            <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => { setFile(null); setPreview(null); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <label className="w-full aspect-[9/16] max-h-[60vh] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                            <span className="font-medium">Click to upload photo</span>
                            <Input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={!file || isUploading}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isUploading ? 'Adding...' : 'Add Story'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function StoryViewer({ groupedStories, initialGroupIndex, onClose }: { groupedStories: Story[][], initialGroupIndex: number, onClose: () => void }) {
    const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    
    const currentGroup = groupedStories[groupIndex];
    const currentStory = currentGroup?.[storyIndex];

    useEffect(() => {
        if (!currentStory) return;
        setProgress(0);
        
        let animationFrameId: number;
        let startTime: number;
        const duration = 5000; // 5 seconds per story

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            
            if (!isPaused) {
                const currentProgress = (elapsed / duration) * 100;
                if (currentProgress >= 100) {
                    handleNext();
                } else {
                    setProgress(currentProgress);
                    animationFrameId = requestAnimationFrame(animate);
                }
            } else {
                startTime = timestamp - (progress / 100) * duration;
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [groupIndex, storyIndex, isPaused, currentStory]);

    const handleNext = () => {
        if (storyIndex < currentGroup.length - 1) {
            setStoryIndex(prev => prev + 1);
        } else if (groupIndex < groupedStories.length - 1) {
            setGroupIndex(prev => prev + 1);
            setStoryIndex(0);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (storyIndex > 0) {
            setStoryIndex(prev => prev - 1);
        } else if (groupIndex > 0) {
            setGroupIndex(prev => prev - 1);
            setStoryIndex(groupedStories[groupIndex - 1].length - 1);
        }
    };

    if (!currentStory) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            {/* Background blur */}
            <div className="absolute inset-0 opacity-30 bg-cover bg-center blur-xl" style={{ backgroundImage: `url(${currentStory.mediaUrl})` }} />
            
            <div className="relative w-full max-w-[500px] h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl flex flex-col">
                
                {/* Progress Bars */}
                <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-4 pt-6 bg-gradient-to-b from-black/60 to-transparent">
                    {currentGroup.map((_, idx) => (
                        <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white transition-all duration-100 ease-linear"
                                style={{ width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%' }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="absolute top-10 left-0 right-0 z-20 flex justify-between items-center px-4 text-white">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/20">
                            <AvatarImage src={currentStory.authorAvatarUrl} />
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm drop-shadow-md">{currentStory.authorName}</p>
                            <p className="text-xs text-white/80 drop-shadow-md">@{currentStory.authorHandle}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={onClose}>
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                {/* Media Content */}
                <div 
                    className="flex-1 w-full h-full flex items-center justify-center relative cursor-pointer"
                    onPointerDown={() => setIsPaused(true)}
                    onPointerUp={() => setIsPaused(false)}
                    onPointerLeave={() => setIsPaused(false)}
                >
                    <img 
                        src={currentStory.mediaUrl} 
                        alt="Story" 
                        className="w-full h-full object-contain pointer-events-none" 
                    />

                    {/* Navigation Overlays */}
                    <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
                    <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
                </div>
            </div>
        </div>
    );
}
