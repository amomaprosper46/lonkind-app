'use client';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    reportedUserId: string;
    reportedUserName: string;
    reportType: 'spam' | 'scam' | 'abuse' | 'impersonation';
    reporterId: string;
}

export default function ReportDialog({ isOpen, onClose, reportedUserId, reportedUserName, reportType, reporterId }: ReportDialogProps) {
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'reports'), {
                reporterId,
                reportedUserId,
                reportType,
                details,
                timestamp: serverTimestamp(),
                status: 'pending'
            });
            toast({ title: 'Report Submitted', description: 'Thank you. We will review this shortly.' });
            onClose();
        } catch (error) {
            console.error('Error submitting report:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit report. Try again later.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const typeLabels = {
        spam: 'Spam or Unwanted',
        scam: 'Scam or Fraud',
        abuse: 'Abuse or Harassment',
        impersonation: 'Impersonating Someone'
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Report {reportedUserName}</DialogTitle>
                    <DialogDescription>
                        You are reporting this user for <strong>{typeLabels[reportType]}</strong>. Please provide any extra details below.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="details">Additional Details (Optional)</Label>
                        <Textarea 
                            id="details" 
                            placeholder="Please provide any helpful context..." 
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Submit Report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
