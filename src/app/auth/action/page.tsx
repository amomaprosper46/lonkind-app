
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
    const router = useRouter();

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
            setMessage('Invalid or missing action link. Please try again.');
            return;
        }

        const handleAction = async () => {
            try {
                switch (mode) {
                    case 'resetPassword':
                        const email = await verifyPasswordResetCode(auth, oobCode);
                        setStatus('ready');
                        setMessage(`Create a new password for ${email}.`);
                        break;
                    case 'verifyEmail':
                        await applyActionCode(auth, oobCode);
                        setStatus('success');
                        setMessage('Your email address has been verified! You can now sign in.');
                        break;
                    default:
                        setStatus('invalid');
                        setMessage('Unsupported action type.');
                        break;
                }
            } catch (error: any) {
                console.error("Firebase action error:", error);
                if (error.code === 'auth/expired-action-code') {
                    setStatus('expired');
                    setMessage('This link has expired. Please request a new one.');
                } else {
                    setStatus('invalid');
                    setMessage('This link is invalid or has already been used.');
                }
            }
        };

        handleAction();
    }, [mode, oobCode]);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: 'Passwords do not match.' });
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
            setStatus('success');
            setMessage('Your password has been successfully reset. You can now sign in with your new password.');
            toast({ title: 'Password Reset Successful!' });
        } catch (error: any) {
            console.error("Password reset confirmation error:", error);
            setStatus('error');
            setMessage('Failed to reset password. The link may have expired.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground">Verifying your link...</p>
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
                                        placeholder="8+ characters"
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
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Reset Password
                                </Button>
                            </form>
                        </CardContent>
                    </>
                );
            case 'success':
                 return (
                    <div className="flex flex-col items-center gap-4 text-center p-6">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                        <CardTitle>Success!</CardTitle>
                        <p className="text-muted-foreground">{message}</p>
                        <Button asChild className="mt-4">
                            <Link href="/">Go to Sign In</Link>
                        </Button>
                    </div>
                );
            case 'invalid':
            case 'expired':
            case 'error':
                 return (
                    <div className="flex flex-col items-center gap-4 text-center p-6">
                        <AlertCircle className="h-16 w-16 text-destructive" />
                        <CardTitle>Link Error</CardTitle>
                        <p className="text-muted-foreground">{message}</p>
                         <Button asChild variant="outline" className="mt-4">
                            <Link href="/">Back to Home</Link>
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
            <Card className="w-full max-w-md">
                {renderContent()}
            </Card>
        </div>
    )
}


export default function AuthActionPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-secondary"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <AuthActionHandler />
        </Suspense>
    )
}
