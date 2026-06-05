import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Trash2, UserX, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Report {
    id: string;
    reporter: { uid: string; name: string; handle: string; };
    reportedPost: { id: string; authorUid: string; content: string; };
    timestamp: any;
    status: 'pending' | 'resolved' | 'dismissed';
}

export default function AdminDashboardView() {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'reports'), where('status', '==', 'pending'));
            const snapshot = await getDocs(q);
            const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
            setReports(fetchedReports);
        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load reports.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (report: Report, action: 'delete_post' | 'ban_user' | 'dismiss') => {
        setProcessingId(report.id);
        try {
            const reportRef = doc(db, 'reports', report.id);

            if (action === 'delete_post' || action === 'ban_user') {
                // Try deleting the post first
                try {
                    await deleteDoc(doc(db, 'posts', report.reportedPost.id));
                } catch (e) {
                    console.error("Post already deleted or missing:", e);
                }
            }

            if (action === 'ban_user') {
                // Ban the user
                const userRef = doc(db, 'users', report.reportedPost.authorUid);
                await updateDoc(userRef, { isBanned: true });
                toast({ title: 'User Banned', description: 'The user has been permanently banned.' });
            } else if (action === 'delete_post') {
                toast({ title: 'Post Deleted', description: 'The reported post has been removed.' });
            } else {
                toast({ title: 'Report Dismissed', description: 'No action was taken on this report.' });
            }

            // Update report status
            await updateDoc(reportRef, { 
                status: action === 'dismiss' ? 'dismissed' : 'resolved',
                resolvedAt: serverTimestamp() 
            });

            // Remove from UI
            setReports(prev => prev.filter(r => r.id !== report.id));
            
        } catch (error) {
            console.error("Error processing action:", error);
            toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not process the report.' });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card className="col-span-12 md:col-span-9 border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-3xl font-bold flex items-center gap-2 text-destructive">
                    <ShieldAlert className="h-8 w-8" />
                    Admin Moderation Panel
                </CardTitle>
                <CardDescription>
                    Review user reports, delete abusive content, and ban violating accounts.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                {isLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : reports.length === 0 ? (
                    <div className="text-center p-12 border rounded-lg bg-muted/50">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold">All caught up!</h3>
                        <p className="text-muted-foreground mt-2">There are no pending reports to review.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {reports.map(report => (
                            <Card key={report.id} className="overflow-hidden border-destructive/20">
                                <div className="bg-destructive/10 p-4 flex justify-between items-center border-b border-destructive/20">
                                    <div>
                                        <p className="text-sm font-semibold text-destructive">Reported by @{report.reporter.handle}</p>
                                        <p className="text-xs text-muted-foreground">Report ID: {report.id}</p>
                                    </div>
                                    <Badge variant="destructive">Pending</Badge>
                                </div>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-semibold text-muted-foreground mb-1">Reported Content:</p>
                                            <div className="p-4 bg-muted rounded-md text-sm border">
                                                {report.reportedPost.content || <span className="italic text-muted-foreground">Media only post</span>}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/30 p-4 flex gap-2 justify-end">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleAction(report, 'dismiss')}
                                        disabled={processingId === report.id}
                                    >
                                        Dismiss Report
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
                                        onClick={() => handleAction(report, 'delete_post')}
                                        disabled={processingId === report.id}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Post
                                    </Button>
                                    <Button 
                                        variant="destructive" 
                                        onClick={() => handleAction(report, 'ban_user')}
                                        disabled={processingId === report.id}
                                    >
                                        <UserX className="mr-2 h-4 w-4" /> Delete Post & Ban User
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
