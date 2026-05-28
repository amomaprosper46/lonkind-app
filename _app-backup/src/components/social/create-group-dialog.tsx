
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import type { CurrentUser } from './social-dashboard';
import { createGroup } from '@/ai/flows/create-group';
import { Loader2 } from 'lucide-react';
import { PulseLoader } from 'react-spinners';

interface CreateGroupDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUser: CurrentUser;
}

const groupSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name cannot exceed 50 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(250, "Description cannot exceed 250 characters."),
});

export default function CreateGroupDialog({ isOpen, onOpenChange, currentUser }: CreateGroupDialogProps) {
    const [isCreating, setIsCreating] = useState(false);

    const form = useForm<z.infer<typeof groupSchema>>({
        resolver: zodResolver(groupSchema),
        defaultValues: {
            name: '',
            description: '',
        },
    });

    const handleCreateGroup = async (values: z.infer<typeof groupSchema>) => {
        setIsCreating(true);
        try {
            const result = await createGroup({
                name: values.name,
                description: values.description,
                creator: {
                    uid: currentUser.uid,
                    name: currentUser.name,
                    handle: currentUser.handle,
                },
            });
            toast({
                title: 'Group Created!',
                description: `Your new group "${values.name}" is now live.`,
            });
            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating group:', error);
            toast({
                variant: 'destructive',
                title: 'Creation Failed',
                description: 'Could not create the group. Please try again.',
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a New Group</DialogTitle>
                    <DialogDescription>
                        Start a community around a shared interest. A cover image will be generated for you by AI.
                    </DialogDescription>
                </DialogHeader>
                {isCreating ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                        <PulseLoader color="hsl(var(--primary))" loading={true} size={15} />
                        <p className="mt-6 text-muted-foreground">Creating your group and generating an AI cover image... this may take a moment.</p>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleCreateGroup)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Group Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Hiking Enthusiasts" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="What is this group about?" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button type="submit">
                                    Create Group
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
