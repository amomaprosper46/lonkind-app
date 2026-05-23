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
    bio?: string;
    businessUrl?: string;
}

export interface ProfileData {
    name?: string;
    handle?: string;
    bio?: string;
    avatarFile?: File;
    businessUrl?: string;
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
});


export default function EditProfileDialog({ isOpen, onOpenChange, currentUser, onSave }: EditProfileDialogProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: currentUser.name,
            handle: currentUser.handle,
            bio: currentUser.bio || '',
            businessUrl: currentUser.businessUrl || '',
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
        }
    }, [isOpen, currentUser, reset]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };
    
    const handleFormSubmit = async (data: z.infer<typeof profileSchema>) => {
        setIsSaving(true);
        const success = await onSave({
            name: data.name,
            handle: data.handle,
            bio: data.bio,
            businessUrl: data.businessUrl,
            avatarFile: avatarFile || undefined
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
                     <div className="flex justify-center">
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
