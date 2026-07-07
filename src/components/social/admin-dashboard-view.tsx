"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Trash2, UserX, CheckCircle, Sparkles, Newspaper, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import AdminModerationDashboard from './admin-moderation-dashboard';

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
    const [isRunningNews, setIsRunningNews] = useState(false);

    const handleRunNewsReporter = async () => {
        setIsRunningNews(true);
        try {
            const res = await fetch('/api/news-reporter', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to trigger news reporter');
            toast({
                title: '📰 News Broadcast Published!',
                description: 'Lonkind News Bot has successfully analyzed live Serper news and published a new Gemini report to the feed!',
            });
        } catch (error: any) {
            console.error('News reporter trigger failed:', error);
            toast({
                variant: 'destructive',
                title: 'Reporter Failed',
                description: error.message || 'Could not execute autonomous reporter.',
            });
        } finally {
            setIsRunningNews(false);
        }
    };

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
            <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white shadow-xl border border-indigo-500/30">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30 mb-2">
                            Platform Financials
                        </div>
                        <h3 className="text-2xl font-extrabold">Lonkind App Cut & Commission</h3>
                        <p className="text-sm text-slate-300 mt-1 max-w-xl">
                            The platform automatically takes a <strong>25% App Cut</strong> on all diamond-to-cash conversions (Creator Share: 75%).
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10">
                        <div>
                            <div className="text-sm font-semibold text-indigo-200">Current App Cut Rate</div>
                            <div className="text-3xl font-black text-green-400">25.0%</div>
                        </div>
                        <div className="h-8 w-[1px] bg-white/20" />
                        <div>
                            <div className="text-sm font-semibold text-indigo-200">Creator Earnings Share</div>
                            <div className="text-3xl font-black text-indigo-300">75.0%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-blue-500/30">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30 mb-2">
                            <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                            Autonomous AI Command Center
                        </div>
                        <h3 className="text-2xl font-extrabold flex items-center gap-2">
                            <Newspaper className="h-6 w-6 text-blue-400" />
                            Lonkind News Reporter Bot
                        </h3>
                        <p className="text-sm text-slate-300 mt-1 max-w-xl">
                            Powered by <strong>Serper API (Free Search Credits)</strong> &amp; <strong>Google Gemini 2.5 Flash</strong>. Automatically aggregates live tech &amp; startup updates and broadcasts to the global feed every 6 hours.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        <div className="bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-center">
                            <div className="text-[11px] font-semibold text-blue-300">Schedule Cadence</div>
                            <div className="text-sm font-bold text-white">0 */6 * * * (6 hrs)</div>
                        </div>
                        <Button 
                            onClick={handleRunNewsReporter} 
                            disabled={isRunningNews}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 py-6 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            {isRunningNews ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-white" />}
                            <span>{isRunningNews ? "Broadcasting..." : "Trigger News Now"}</span>
                        </Button>
                    </div>
                </div>
            </div>

            <CardContent className="px-0 pt-6">
                <AdminModerationDashboard />
            </CardContent>
        </Card>
    );
}
