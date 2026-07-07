'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import {
  Loader2,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  EyeOff,
  UserX,
  FileText,
  Sparkles,
  HelpCircle,
  Gavel,
  RefreshCw,
  Trash2,
  Ban,
  Check,
} from 'lucide-react';

interface ModerationReport {
  id: string;
  reporterUid: string;
  reporterName: string;
  reporterHandle: string;
  targetType: 'post' | 'comment' | 'message' | 'user' | 'livestream';
  targetId: string;
  targetOwnerUid: string;
  targetAuthorHandle?: string;
  reportReason: string;
  reportDescription?: string;
  targetContentSnippet?: string;
  reporterTrustWeight: number;
  totalTargetWeight: number;
  status: 'pending' | 'hidden' | 'escalated' | 'ignored' | 'resolved';
  actionTaken?: string;
  aiEvaluation?: {
    confidenceScore: number;
    recommendedAction: string;
    explanation: string;
    isObviouslyFakeOrDuplicate: boolean;
  };
  timestamp?: any;
}

interface ModerationAppeal {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  targetId: string;
  targetType: string;
  appealReason: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp?: any;
}

export default function AdminModerationDashboard() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('escalated');

  useEffect(() => {
    fetchModerationData();
  }, []);

  const fetchModerationData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch reports (we fetch recent reports to categorize them into tabs)
      const reportsRef = collection(db, 'reports');
      const reportsSnap = await getDocs(query(reportsRef, limit(100)));
      const fetchedReports = reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ModerationReport));

      // 2. Fetch pending appeals
      const appealsRef = collection(db, 'appeals');
      const appealsSnap = await getDocs(query(appealsRef, where('status', '==', 'pending')));
      const fetchedAppeals = appealsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ModerationAppeal));

      setReports(fetchedReports);
      setAppeals(fetchedAppeals);
    } catch (error) {
      console.error('Failed to load moderation data:', error);
      toast({ variant: 'destructive', title: 'Load Error', description: 'Could not fetch moderation logs from Firestore.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered lists for tabs: strict rule - do not show basic noise!
  const escalatedReports = reports.filter(
    (r) =>
      r.status === 'escalated' ||
      (r.aiEvaluation && r.aiEvaluation.confidenceScore >= 80) ||
      ['Hate Speech', 'Violence', 'Nudity', 'Scam/Fraud'].includes(r.reportReason)
  );

  const uncertainReports = reports.filter(
    (r) =>
      r.status === 'pending' &&
      r.aiEvaluation &&
      r.aiEvaluation.confidenceScore >= 40 &&
      r.aiEvaluation.confidenceScore <= 60
  );

  const hiddenReports = reports.filter((r) => r.status === 'hidden');
  const resolvedReports = reports.filter((r) => r.status === 'resolved' || r.status === 'ignored');

  // ACTION HANDLERS
  const handleResolveReport = async (reportId: string, action: 'dismiss' | 'delete_content' | 'ban_account' | 'restrict_account', report: ModerationReport) => {
    setProcessingId(reportId);
    try {
      const reportRef = doc(db, 'reports', reportId);

      if (action === 'delete_content') {
        if (report.targetType === 'post') {
          await deleteDoc(doc(db, 'posts', report.targetId)).catch(() => {});
        }
        await updateDoc(reportRef, { status: 'resolved', actionTaken: 'admin_deleted_content' });
        toast({ title: 'Content Deleted', description: 'The abusive content has been permanently removed.' });
      } else if (action === 'ban_account') {
        await updateDoc(doc(db, 'users', report.targetOwnerUid), {
          isBanned: true,
          bannedReason: `Admin permanent ban following escalated report: ${report.reportReason}`,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(reportRef, { status: 'resolved', actionTaken: 'admin_banned_user' });
        toast({ title: 'Account Banned', description: `@${report.targetAuthorHandle} has been permanently banned.` });
      } else if (action === 'restrict_account') {
        const restrictionExpires = new Date();
        restrictionExpires.setHours(restrictionExpires.getHours() + 168); // 7 days admin restriction
        await updateDoc(doc(db, 'users', report.targetOwnerUid), {
          isRestricted: true,
          restrictionReason: `Admin restriction (7 days): ${report.reportReason}`,
          restrictionExpiresAt: restrictionExpires,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(reportRef, { status: 'resolved', actionTaken: 'admin_restricted_7d' });
        toast({ title: 'Account Restricted', description: `@${report.targetAuthorHandle} restricted for 7 days.` });
      } else {
        // Dismiss
        await updateDoc(reportRef, { status: 'resolved', actionTaken: 'admin_dismissed' });
        toast({ title: 'Report Dismissed', description: 'The report has been closed.' });
      }

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'resolved', actionTaken: `admin_${action}` } : r))
      );
    } catch (error: any) {
      console.error('Resolution error:', error);
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'Could not execute action.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAppealDecision = async (appealId: string, decision: 'approved' | 'rejected', appeal: ModerationAppeal) => {
    setProcessingId(appealId);
    try {
      const appealRef = doc(db, 'appeals', appealId);
      await updateDoc(appealRef, { status: decision, updatedAt: serverTimestamp() });

      if (decision === 'approved') {
        if (appeal.targetType === 'user') {
          await updateDoc(doc(db, 'users', appeal.userId), { isRestricted: false, restrictionReason: null }).catch(() => {});
        } else if (appeal.targetType === 'post') {
          await updateDoc(doc(db, 'posts', appeal.targetId), { isHidden: false, moderationStatus: null }).catch(() => {});
        }
        toast({ title: 'Appeal Approved', description: `Restored privileges for @${appeal.userHandle}.` });
      } else {
        toast({ title: 'Appeal Rejected', description: `The restriction on @${appeal.userHandle} remains active.` });
      }

      setAppeals((prev) => prev.filter((a) => a.id !== appealId));
    } catch (error: any) {
      console.error('Appeal error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update appeal status.' });
    } finally {
      setProcessingId(null);
    }
  };

  const getConfidenceBadge = (score: number = 0) => {
    if (score >= 80) return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">🔥 {score}% High Risk</Badge>;
    if (score >= 40) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">🤖 {score}% AI Uncertain</Badge>;
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">🛡️ {score}% Low Risk</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-red-950/20 to-background border border-rose-500/20 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest">
            <Gavel className="h-4 w-4" />
            Enterprise Scalable Safety Command
          </div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            Lonkind Moderator AI Center
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Autonomous threshold enforcement handles routine moderation. This dashboard only surfaces <strong>High-Risk Abuse, AI Uncertainty (40–60%), Auto-Hidden Content,</strong> and <strong>User Appeals</strong>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchModerationData}
          disabled={isLoading}
          className="rounded-xl border-rose-500/30 hover:bg-rose-500/10 text-rose-400"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Live Feed
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">High-Risk Escalations</span>
            <div className="text-2xl font-black text-rose-500 mt-1">{escalatedReports.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Pending Appeals</span>
            <div className="text-2xl font-black text-amber-500 mt-1">{appeals.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Auto-Hidden Content</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">{hiddenReports.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">AI Uncertainties</span>
            <div className="text-2xl font-black text-blue-400 mt-1">{uncertainReports.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/50 rounded-2xl p-1 gap-1 h-auto">
          <TabsTrigger value="escalated" className="rounded-xl font-bold text-xs py-2.5 data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            ⚠️ High-Risk ({escalatedReports.length})
          </TabsTrigger>
          <TabsTrigger value="uncertain" className="rounded-xl font-bold text-xs py-2.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            🤖 AI Uncertain ({uncertainReports.length})
          </TabsTrigger>
          <TabsTrigger value="hidden" className="rounded-xl font-bold text-xs py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            🙈 Auto-Hidden ({hiddenReports.length})
          </TabsTrigger>
          <TabsTrigger value="appeals" className="rounded-xl font-bold text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            📜 Appeals ({appeals.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="rounded-xl font-bold text-xs py-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            ✅ Resolved ({resolvedReports.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ESCALATED */}
        <TabsContent value="escalated" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-rose-500" /></div>
          ) : escalatedReports.length === 0 ? (
            <Card className="rounded-2xl border-dashed py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="font-bold">Zero High-Risk Reports!</p>
              <p className="text-xs">Lonkind Moderator AI is keeping the platform clean.</p>
            </Card>
          ) : (
            escalatedReports.map((r) => <ReportCard key={r.id} report={r} onAction={handleResolveReport} processingId={processingId} getConfidenceBadge={getConfidenceBadge} />)
          )}
        </TabsContent>

        {/* TAB 2: UNCERTAIN */}
        <TabsContent value="uncertain" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
          ) : uncertainReports.length === 0 ? (
            <Card className="rounded-2xl border-dashed py-12 text-center text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-2 text-amber-500 opacity-60" />
              <p className="font-bold">No AI Uncertainties</p>
              <p className="text-xs">All automated decisions had clear confidence thresholds.</p>
            </Card>
          ) : (
            uncertainReports.map((r) => <ReportCard key={r.id} report={r} onAction={handleResolveReport} processingId={processingId} getConfidenceBadge={getConfidenceBadge} />)
          )}
        </TabsContent>

        {/* TAB 3: HIDDEN */}
        <TabsContent value="hidden" className="mt-4 space-y-4">
          {hiddenReports.length === 0 ? (
            <Card className="rounded-2xl border-dashed py-12 text-center text-muted-foreground"><p>No automatically hidden content right now.</p></Card>
          ) : (
            hiddenReports.map((r) => <ReportCard key={r.id} report={r} onAction={handleResolveReport} processingId={processingId} getConfidenceBadge={getConfidenceBadge} />)
          )}
        </TabsContent>

        {/* TAB 4: APPEALS */}
        <TabsContent value="appeals" className="mt-4 space-y-4">
          {appeals.length === 0 ? (
            <Card className="rounded-2xl border-dashed py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-purple-500 opacity-60" />
              <p className="font-bold">No Pending Appeals</p>
              <p className="text-xs">No users have appealed automated moderation actions.</p>
            </Card>
          ) : (
            appeals.map((a) => (
              <Card key={a.id} className="rounded-2xl border-purple-500/20 bg-purple-500/5 shadow-md p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-600 text-white font-bold">Appeal against {a.targetType}</Badge>
                    <span className="text-sm font-extrabold text-foreground">@{a.userHandle} ({a.userName})</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Target ID: {a.targetId}</span>
                </div>
                <div className="p-3 rounded-xl bg-background/80 border text-xs text-foreground">
                  <strong>User's Counter-Explanation:</strong> &ldquo;{a.appealReason}&rdquo;
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAppealDecision(a.id, 'rejected', a)}
                    disabled={processingId === a.id}
                    className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> Reject &amp; Keep Restricted
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAppealDecision(a.id, 'approved', a)}
                    disabled={processingId === a.id}
                    className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Approve Appeal &amp; Restore
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* TAB 5: RESOLVED */}
        <TabsContent value="resolved" className="mt-4 space-y-4">
          {resolvedReports.length === 0 ? (
            <Card className="rounded-2xl border-dashed py-12 text-center text-muted-foreground"><p>No resolved reports history in current view.</p></Card>
          ) : (
            resolvedReports.map((r) => <ReportCard key={r.id} report={r} onAction={handleResolveReport} processingId={processingId} getConfidenceBadge={getConfidenceBadge} readOnly />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// SUB-COMPONENT: REPORT CARD
function ReportCard({
  report,
  onAction,
  processingId,
  getConfidenceBadge,
  readOnly = false,
}: {
  report: ModerationReport;
  onAction: (id: string, action: any, report: ModerationReport) => void;
  processingId: string | null;
  getConfidenceBadge: (score: number) => React.ReactNode;
  readOnly?: boolean;
}) {
  const isBusy = processingId === report.id;

  return (
    <Card className="rounded-2xl border-border/60 bg-card/80 shadow-md overflow-hidden transition-all hover:border-rose-500/30">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-border/50">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="uppercase font-extrabold tracking-wider bg-muted text-foreground">
              {report.targetType}
            </Badge>
            <Badge className="bg-rose-600 text-white font-bold">{report.reportReason}</Badge>
            {report.aiEvaluation && getConfidenceBadge(report.aiEvaluation.confidenceScore)}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Reported by <strong>@{report.reporterHandle}</strong></span>
            <Badge variant="secondary" className="text-[10px] font-mono">Weight: {report.reporterTrustWeight || 1}x</Badge>
          </div>
        </div>

        {/* Content Preview & AI Evaluation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Content / Profile Preview</div>
            <div className="text-xs font-semibold text-foreground">Author: @{report.targetAuthorHandle || 'unknown'}</div>
            <div className="text-xs text-muted-foreground italic line-clamp-3">
              &ldquo;{report.targetContentSnippet || 'No content snippet logged.'}&rdquo;
            </div>
            {report.reportDescription && (
              <div className="pt-2 border-t border-border/40 text-xs text-rose-500">
                <strong>Reporter Note:</strong> {report.reportDescription}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                <Sparkles className="h-3.5 w-3.5" />
                Lonkind Moderator AI Rationale
              </div>
              <div className="text-xs text-foreground mt-1 font-medium">
                {report.aiEvaluation?.explanation || 'AI analysis pending or heuristic rules applied.'}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-rose-500/10 text-[11px] text-muted-foreground">
              <span>Recommended: <strong className="text-foreground uppercase">{report.aiEvaluation?.recommendedAction || 'escalate'}</strong></span>
              <span>Total Weight: <strong>{report.totalTargetWeight || 1}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(report.id, 'dismiss', report)}
              disabled={isBusy}
              className="rounded-xl border-border hover:bg-muted text-xs font-semibold"
            >
              Dismiss Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(report.id, 'restrict_account', report)}
              disabled={isBusy}
              className="rounded-xl border-amber-500/40 text-amber-500 hover:bg-amber-500/10 text-xs font-bold"
            >
              <UserX className="h-3.5 w-3.5 mr-1.5" /> Restrict 7 Days
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAction(report.id, 'delete_content', report)}
              disabled={isBusy}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Content
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAction(report.id, 'ban_account', report)}
              disabled={isBusy}
              className="rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-black shadow-lg shadow-red-900/20"
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" /> Ban Permanently
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
