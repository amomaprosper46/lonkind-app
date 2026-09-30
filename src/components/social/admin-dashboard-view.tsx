"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Trash2, UserX, CheckCircle, Sparkles, Newspaper, Play, DollarSign, Clock, AlertTriangle, CheckCheck, XCircle, Search, ActivitySquare, TrendingUp, Users, FileText as FileTextIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminModerationDashboard from './admin-moderation-dashboard';
import AdminUserManagement from './admin-user-management';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getCountFromServer } from 'firebase/firestore';

interface Report {
    id: string;
    reporter: { uid: string; name: string; handle: string; };
    reportedPost: { id: string; authorUid: string; content: string; };
    timestamp: any;
    status: 'pending' | 'resolved' | 'dismissed';
}

interface PayoutRequest {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    diamondAmount: number;
    accountName: string;
    accountNumber: string;
    bankCode: string;
    payoutMethod: string;
    status: string;
    createdAt: string | null;
}

export default function AdminDashboardView() {
    const [reports, setReports] = useState<Report[]>([]);
    const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
    const [autoExecutedCount, setAutoExecutedCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPayouts, setIsLoadingPayouts] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isRunningNews, setIsRunningNews] = useState(false);
    
    // Audit logs state
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isLoadingAudits, setIsLoadingAudits] = useState(false);

    // Analytics State
    const [platformMetrics, setPlatformMetrics] = useState({ users: 0, posts: 0 });
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

    // Mock time-series data for the beautiful area charts
    const revenueData = [
        { name: 'Mon', revenue: 400, dau: 240 },
        { name: 'Tue', revenue: 300, dau: 139 },
        { name: 'Wed', revenue: 550, dau: 980 },
        { name: 'Thu', revenue: 450, dau: 390 },
        { name: 'Fri', revenue: 700, dau: 480 },
        { name: 'Sat', revenue: 1200, dau: 1890 },
        { name: 'Sun', revenue: 1500, dau: 2390 },
    ];

    const handleRunNewsReporter = async () => {
        setIsRunningNews(true);
        try {
            const res = await fetch('/api/news-reporter', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to trigger news reporter');
            toast({ title: '📰 News Broadcast Published!', description: 'Lonkind News Bot has published a new report to the global feed.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Reporter Failed', description: error.message });
        } finally {
            setIsRunningNews(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchPayouts = useCallback(async () => {
        setIsLoadingPayouts(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/approve-payout', {
                headers: { Authorization: `Bearer ${idToken}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPayouts(data.requests || []);
            setAutoExecutedCount(data.autoExecuted || 0);
            if (data.autoExecuted > 0) {
                toast({ title: `⚡ Auto-Processed ${data.autoExecuted} Payout(s)`, description: 'Old pending payouts were automatically dispatched.' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load payout requests.' });
        } finally {
            setIsLoadingPayouts(false);
        }
    }, []);

    const handlePayoutAction = async (payoutId: string, action: 'approve' | 'reject', rejectReason?: string) => {
        setProcessingId(payoutId);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/approve-payout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ payoutId, action, rejectReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: action === 'approve' ? '✅ Payout Approved' : '❌ Payout Rejected', description: data.message });
            setPayouts(prev => prev.filter(p => p.id !== payoutId));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
        } finally {
            setProcessingId(null);
        }
    };

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'reports'), where('status', '==', 'pending'));
            const snapshot = await getDocs(q);
            setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load reports.' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        setIsLoadingAudits(true);
        try {
            // Using a simple getDocs, ideally in a real app you'd paginate this
            const snapshot = await getDocs(collection(db, 'wallet_audit_logs'));
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => {
                if (!a.timestamp || !b.timestamp) return 0;
                return b.timestamp.seconds - a.timestamp.seconds;
            });
            setAuditLogs(logs);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load audit logs.' });
        } finally {
            setIsLoadingAudits(false);
        }
    };

    const fetchPlatformMetrics = async () => {
        setIsLoadingMetrics(true);
        try {
            const usersSnap = await getCountFromServer(collection(db, 'users'));
            const postsSnap = await getCountFromServer(collection(db, 'posts'));
            setPlatformMetrics({
                users: usersSnap.data().count,
                posts: postsSnap.data().count
            });
        } catch (error) {
            console.error("Failed to fetch metrics", error);
        } finally {
            setIsLoadingMetrics(false);
        }
    };

    const handleAction = async (report: Report, action: 'delete_post' | 'ban_user' | 'dismiss') => {
        setProcessingId(report.id);
        try {
            if (action === 'delete_post' || action === 'ban_user') {
                try { await deleteDoc(doc(db, 'posts', report.reportedPost.id)); } catch {}
            }
            if (action === 'ban_user') {
                await updateDoc(doc(db, 'users', report.reportedPost.authorUid), { isBanned: true });
                toast({ title: 'User Banned' });
            } else if (action === 'delete_post') {
                toast({ title: 'Post Deleted' });
            } else {
                toast({ title: 'Report Dismissed' });
            }
            await updateDoc(doc(db, 'reports', report.id), {
                status: action === 'dismiss' ? 'dismissed' : 'resolved',
                resolvedAt: serverTimestamp(),
            });
            setReports(prev => prev.filter(r => r.id !== report.id));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not process the report.' });
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'bg-green-500/15 text-green-400 border-green-500/30';
            case 'processing': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
            case 'pending_review': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            case 'failed': return 'bg-red-500/15 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <Card className="col-span-12 md:col-span-9 border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-3xl font-bold flex items-center gap-2 text-destructive">
                    <ShieldAlert className="h-8 w-8" /> Admin Control Panel
                </CardTitle>
                <CardDescription>Manage reports, payouts, and platform tools.</CardDescription>
            </CardHeader>

            {/* Platform Commission Banner */}
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

            <Tabs defaultValue="reports" className="w-full">
                <TabsList className="grid w-full grid-cols-6 mb-6">
                    <TabsTrigger value="reports" className="font-semibold">
                        <ShieldAlert className="h-4 w-4 mr-2" /> Reports {reports.length > 0 && `(${reports.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="users" className="font-semibold">
                        <Users className="h-4 w-4 mr-2" /> Users
                    </TabsTrigger>
                    <TabsTrigger value="payouts" className="font-semibold" onClick={() => { if (payouts.length === 0) fetchPayouts(); }}>
                        <DollarSign className="h-4 w-4 mr-2" /> Payouts {payouts.length > 0 && `(${payouts.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="audits" className="font-semibold" onClick={() => { if (auditLogs.length === 0) fetchAuditLogs(); }}>
                        <ActivitySquare className="h-4 w-4 mr-2" /> Audits
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="font-semibold" onClick={() => { if (platformMetrics.users === 0) fetchPlatformMetrics(); }}>
                        <TrendingUp className="h-4 w-4 mr-2" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="font-semibold">
                        <Sparkles className="h-4 w-4 mr-2" /> AI
                    </TabsTrigger>
                </TabsList>

                {/* ── Reports Tab ── */}
                <TabsContent value="reports">
                    <AdminModerationDashboard />
                </TabsContent>
                
                {/* ── Users Tab ── */}
                <TabsContent value="users">
                    <AdminUserManagement />
                </TabsContent>

                {/* ── Payouts Tab ── */}
                <TabsContent value="payouts">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Pending Payout Requests</h3>
                                <p className="text-sm text-muted-foreground">Requests older than 26 hours are auto-processed when you open this tab.</p>
                            </div>
                            <Button onClick={fetchPayouts} disabled={isLoadingPayouts} variant="outline" size="sm">
                                {isLoadingPayouts ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                            </Button>
                        </div>

                        {isLoadingPayouts ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                        ) : payouts.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <CheckCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
                                    <p className="text-lg font-semibold">All caught up!</p>
                                    <p className="text-sm">No pending payout requests at the moment.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            payouts.map(payout => (
                                <Card key={payout.id} className="overflow-hidden border border-border/50">
                                    <CardContent className="p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-base">{payout.accountName}</span>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getStatusColor(payout.status)}`}>
                                                        {payout.status}
                                                    </span>
                                                    <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                                                        {payout.payoutMethod?.toUpperCase() || 'PAYSTACK'}
                                                    </span>
                                                </div>
                                                <div className="text-2xl font-black text-green-400">
                                                    {payout.currency} {payout.amount?.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-muted-foreground space-y-0.5">
                                                    <p>💎 {payout.diamondAmount?.toLocaleString()} diamonds deducted</p>
                                                    <p>🏦 Bank: {payout.bankCode} | Acct: {payout.accountNumber}</p>
                                                    {payout.createdAt && (
                                                        <p className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            Requested: {new Date(payout.createdAt).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    disabled={processingId === payout.id}
                                                    onClick={() => handlePayoutAction(payout.id, 'approve')}
                                                >
                                                    {processingId === payout.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={processingId === payout.id}
                                                    onClick={() => handlePayoutAction(payout.id, 'reject', 'Request rejected by admin.')}
                                                >
                                                    {processingId === payout.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* ── Financial Audits Tab ── */}
                <TabsContent value="audits">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Wallet & Payout Audit Trail</h3>
                                <p className="text-sm text-muted-foreground">Immutable logs of all diamond deductions and refunds.</p>
                            </div>
                            <Button onClick={fetchAuditLogs} disabled={isLoadingAudits} variant="outline" size="sm">
                                {isLoadingAudits ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                            </Button>
                        </div>

                        {isLoadingAudits ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                        ) : auditLogs.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <ActivitySquare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                    <p className="text-lg font-semibold">No audit logs yet.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {auditLogs.map(log => (
                                    <Card key={log.id} className="overflow-hidden border border-border/50">
                                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${log.type === 'payout_deduction' ? 'bg-amber-100 text-amber-600' : log.type === 'payout_refund' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {log.type === 'payout_deduction' ? <DollarSign className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 capitalize">
                                                        {log.type.replace('_', ' ')}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                                        <p>User ID: <span className="font-mono">{log.userId}</span></p>
                                                        {log.payoutId && <p>Payout ID: <span className="font-mono">{log.payoutId}</span></p>}
                                                        <p>Details: {log.details}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end text-right shrink-0">
                                                <div className={`font-bold ${log.diamondAmount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                    {log.diamondAmount > 0 ? '+' : ''}{log.diamondAmount?.toLocaleString()} 💎
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Unknown Date'}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── Analytics Tab ── */}
                <TabsContent value="analytics">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border-indigo-500/20">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Total Registered Users</p>
                                        <h4 className="text-4xl font-black mt-2 text-foreground">
                                            {isLoadingMetrics ? <Loader2 className="h-8 w-8 animate-spin text-indigo-500" /> : platformMetrics.users.toLocaleString()}
                                        </h4>
                                    </div>
                                    <div className="h-16 w-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                                        <Users className="h-8 w-8 text-indigo-600" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Platform Posts</p>
                                        <h4 className="text-4xl font-black mt-2 text-foreground">
                                            {isLoadingMetrics ? <Loader2 className="h-8 w-8 animate-spin text-emerald-500" /> : platformMetrics.posts.toLocaleString()}
                                        </h4>
                                    </div>
                                    <div className="h-16 w-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                                        <FileTextIcon className="h-8 w-8 text-emerald-600" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            {/* Revenue Chart */}
                            <Card className="border border-border/50 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Platform Revenue (Weekly)</CardTitle>
                                    <CardDescription>Estimated gross app-cut revenue in USD.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} />
                                                <RechartsTooltip 
                                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: 'none', color: '#fff' }}
                                                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* DAU Chart */}
                            <Card className="border border-border/50 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Daily Active Users (DAU)</CardTitle>
                                    <CardDescription>Unique users logging in per day.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <RechartsTooltip 
                                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: 'none', color: '#fff' }}
                                                    itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" dataKey="dau" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorDau)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ── AI Tools Tab ── */}
                <TabsContent value="tools">
                    <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-blue-500/30">
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
                                    Powered by <strong>Serper API</strong> &amp; <strong>Google Gemini 3.5 Flash</strong>. Automatically broadcasts live tech &amp; startup updates to the global feed every 6 hours.
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
                                    <span>{isRunningNews ? 'Broadcasting...' : 'Trigger News Now'}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </Card>
    );
}
