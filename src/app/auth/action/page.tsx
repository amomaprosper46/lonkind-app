'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

type Status = 'loading' | 'ready' | 'invalid' | 'expired' | 'success' | 'error';

function AuthActionHandler() {
    const searchParams = useSearchParams();

    const [status, setStatus] = useState<Status>('loading');
    const [message, setMessage] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    useEffect(() => {
        if (!mode || !oobCode) {
            setStatus('invalid');
            setMessage('Invalid or missing action link. Please request a new verification link.');
            return;
        }

        // 1. Thread Execution Flag to prevent duplicate/double token submission race conditions
        let isCurrentInstance = true;

        const handleAction = async () => {
            try {
                switch (mode) {
                    case 'resetPassword': {
                        const email = await verifyPasswordResetCode(auth, oobCode);
                        if (!isCurrentInstance) return;
                        
                        setStatus('ready');
                        setMessage(`Please choose a highly secure password for ${email}.`);
                        break;
                    }
                    case 'verifyEmail': {
                        await applyActionCode(auth, oobCode);
                        if (!isCurrentInstance) return;

                        setStatus('success');
                        setMessage('Your email address has been successfully verified! You can now sign in.');
                        break;
                    }
                    default: {
                        if (!isCurrentInstance) return;
                        setStatus('invalid');
                        setMessage('Unsupported or unknown authentication action type request.');
                        break;
                    }
                }
            } catch (error: any) {
                if (!isCurrentInstance) return;
                console.error("Firebase auth cryptographic verification exception:", error);
                
                if (error.code === 'auth/expired-action-code') {
                    setStatus('expired');
                    setMessage('This authentication link has expired. Please request a new one.');
                } else if (error.code === 'auth/invalid-action-code') {
                    setStatus('invalid');
                    setMessage('This link is invalid, malformed, or has already been used.');
                } else {
                    setStatus('error');
                    setMessage(error.message || 'An unexpected authentication routing error occurred.');
                }
            }
        };

        handleAction();

        // Cleanup function cancels state updates if the user leaves the page mid-flight
        return () => {
            isCurrentInstance = false;
        };
    }, [mode, oobCode]);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: 'Passwords do not match.', description: 'Please re-verify input constraints.' });
            return;
        }
        if (newPassword.length < 8) {
            toast({ variant: 'destructive', title: 'Password is too short.', description: 'Password must be at least 8 characters long.' });
            return;
        }

        if (!oobCode) return;

        setIsSubmitting(true);
        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            
            // 2. Clear sensitive plain text inputs from local state memory immediately upon success
            setNewPassword('');
            setConfirmPassword('');
            
            setStatus('success');
            setMessage('Your password has been successfully updated. You can safely sign in with your new password.');
            toast({ title: 'Password Reset Successful!' });
        } catch (error: any) {
            console.error("Password reset confirmation lifecycle error:", error);
            setStatus('error');
            setMessage(error.message || 'Failed to update password. The verification link may have expired.');
            toast({ variant: 'destructive', title: 'Error processing update request.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center gap-4 text-center p-8">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Verifying secure token signatures...</p>
                    </div>
                );
            case 'ready':
                return (
                    <>
                        <CardHeader>
                            <CardTitle>Reset Your Password</CardTitle>
                            <CardDescription>{message}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordReset} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <Input 
                                        id="new-password"
                                        type="password" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimally 8+ characters"
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Password
                                </Button>
                            </form>
                        </CardContent>
                    </>
                );
            case 'success':
                 return (
                    <div className="flex flex-col items-center gap-4 text-center p-8">
                        <CheckCircle className="h-16 w-16 text-emerald-500" />
                        <CardTitle>Action Completed</CardTitle>
                        <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
                        <Button asChild className="mt-4 w-full">
                            <Link href="/auth/login">Proceed to Sign In</Link>
                        </Button>
                    </div>
                );
            case 'invalid':
            case 'expired':
            case 'error':
                 return (
                    <div className="flex flex-col items-center gap-4 text-center p-8">
                        <AlertCircle className="h-16 w-16 text-destructive" />
                        <CardTitle>Link Invalidation</CardTitle>
                        <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
                         <Button asChild variant="outline" className="mt-4 w-full">
                            <Link href="/">Return to Homepage</Link>
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
            <Card className="w-full max-w-md shadow-lg border-zinc-200/80 dark:border-zinc-800">
                {renderContent()}
            </Card>
        </div>
    );
}

export default function AuthActionPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <AuthActionHandler />
        </Suspense>
    );
}