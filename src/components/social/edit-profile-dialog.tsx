'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Camera } from 'lucide-react';

interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    coverUrl?: string;
    bio?: string;
    businessUrl?: string;
}

export interface ProfileData {
    name?: string;
    handle?: string;
    bio?: string;
    avatarFile?: File;
    coverFile?: File;
    businessUrl?: string;
    followerPrivacy?: 'public' | 'private';
}

interface EditProfileDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUser: UserProfile;
    onSave: (data: ProfileData) => Promise<boolean>;
}

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(50, "Name cannot be longer than 50 characters."),
  handle: z.string()
    .min(3, "Handle must be at least 3 characters.")
    .max(15, "Handle cannot be longer than 15 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Handle can only contain letters, numbers, and underscores."),
  bio: z.string().max(160, "Bio cannot be longer than 160 characters.").optional(),
  businessUrl: z.string().url("Please enter a valid URL (e.g., https://example.com)").or(z.literal('')).optional(),
  followerPrivacy: z.enum(['public', 'private']).default('public'),
});


export default function EditProfileDialog({ isOpen, onOpenChange, currentUser, onSave }: EditProfileDialogProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: currentUser.name,
            handle: currentUser.handle,
            bio: currentUser.bio || '',
            businessUrl: currentUser.businessUrl || '',
            followerPrivacy: (currentUser as any).followerPrivacy || 'public',
        },
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                name: currentUser.name,
                handle: currentUser.handle,
                bio: currentUser.bio || '',
                businessUrl: currentUser.businessUrl || '',
            });
            setAvatarFile(null);
            setAvatarPreview(null);
            setCoverFile(null);
            setCoverPreview(null);
        }
    }, [isOpen, currentUser, reset]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    };
    
    const handleFormSubmit = async (data: z.infer<typeof profileSchema>) => {
        setIsSaving(true);
        const success = await onSave({
            name: data.name,
            handle: data.handle,
            bio: data.bio,
            businessUrl: data.businessUrl,
            followerPrivacy: data.followerPrivacy,
            avatarFile: avatarFile || undefined,
            coverFile: coverFile || undefined,
        });
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                     <div className="relative h-28 w-full rounded-xl overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 border border-border/60">
                        {(coverPreview || currentUser.coverUrl) && (
                            <img
                                src={coverPreview || currentUser.coverUrl}
                                alt="Cover banner"
                                className="h-full w-full object-cover"
                            />
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            ref={coverInputRef}
                            onChange={handleCoverChange}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="absolute bottom-2 right-2 rounded-lg text-xs h-7 px-2.5 gap-1 bg-slate-950/75 text-white hover:bg-slate-900"
                            onClick={() => coverInputRef.current?.click()}
                        >
                            <Camera className="h-3.5 w-3.5" />
                            Change Cover
                        </Button>
                     </div>
                     <div className="flex justify-center -mt-12">
                        <div className="relative">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src={avatarPreview || currentUser.avatarUrl} alt={currentUser.name} />
                                <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="absolute bottom-0 right-0 rounded-full"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" {...register('name')} />
                        {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="handle">Handle</Label>
                        <Input id="handle" {...register('handle')} />
                        {errors.handle && <p className="text-destructive text-sm mt-1">{errors.handle.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea id="bio" {...register('bio')} />
                        {errors.bio && <p className="text-destructive text-sm mt-1">{errors.bio.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="businessUrl">Business URL</Label>
                        <Input id="businessUrl" {...register('businessUrl')} placeholder="https://example.com" />
                        {errors.businessUrl && <p className="text-destructive text-sm mt-1">{errors.businessUrl.message}</p>}
                    </div>
                    <div className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                            <Label htmlFor="followerPrivacy" className="font-semibold">Public Followers List</Label>
                            <p className="text-sm text-muted-foreground">Allow others to see who follows you.</p>
                        </div>
                        <Controller
                            name="followerPrivacy"
                            control={control}
                            render={({ field }) => (
                                <input
                                    type="checkbox"
                                    id="followerPrivacy"
                                    checked={field.value === 'public'}
                                    onChange={(e) => field.onChange(e.target.checked ? 'public' : 'private')}
                                    className="h-4 w-4"
                                />
                            )}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
