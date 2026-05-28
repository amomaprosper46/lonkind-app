'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, ShieldX, AlertTriangle, CheckCircle2, RefreshCw, ClipboardList, Building2, User } from 'lucide-react';
import type { CurrentUser } from './social-dashboard';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '../ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '../ui/alert-dialog';

interface AdminPanelProps {
  currentUser: CurrentUser;
}

interface PayoutRequest {
  id: string;
  userId: string;
  amountNaira: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  status: string;
  flagReasons: string[];
  createdAt: string | null;
  recipientCode?: string;
}

export default function AdminPanelView({ currentUser }: AdminPanelProps) {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/approve-payout?adminUid=${currentUser.uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load requests');
      setRequests(data.requests || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.uid]);

  useEffect(() => {
    if (currentUser.isProfessional) {
      fetchRequests();
    }
  }, [fetchRequests, currentUser.isProfessional]);

  if (!currentUser.isProfessional) {
    return (
      <main className="col-span-12 md:col-span-8 lg:col-span-9">
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldX className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="font-bold text-lg">Admin Access Required</p>
            <p className="text-muted-foreground">This panel is only accessible to Lonkind administrators.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const handleAction = async (payoutId: string, action: 'approve' | 'reject') => {
    setProcessingId(payoutId);
    try {
      const res = await fetch('/api/admin/approve-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId,
          action,
          adminUid: currentUser.uid,
          rejectReason: action === 'reject' ? rejectReason : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast({ title: action === 'approve' ? '✅ Payout Approved' : '🚫 Payout Rejected', description: data.message });
      setRejectReason('');
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== payoutId));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <main className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Admin Panel — Payout Review</CardTitle>
              <CardDescription>Review and approve flagged withdrawal requests</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-yellow-500">{requests.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-500">
              ₦{requests.reduce((sum, r) => sum + r.amountNaira, 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Total Amount Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-red-500">
              {requests.filter(r => r.flagReasons.length > 1).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">High-Risk Requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pending Payout Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p className="font-semibold">All clear!</p>
              <p className="text-sm">No payout requests pending review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const isHighRisk = request.flagReasons.length > 1;
                const isProcessing = processingId === request.id;

                return (
                  <div
                    key={request.id}
                    className={`rounded-xl border p-4 space-y-4 ${
                      isHighRisk ? 'border-red-500/40 bg-red-500/5' : 'border-yellow-500/40 bg-yellow-500/5'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={isHighRisk ? 'destructive' : 'outline'} className="text-xs">
                            {isHighRisk ? '🚨 High Risk' : '⚠️ Flagged'}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{request.id.slice(0, 20)}...</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">₦{request.amountNaira.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {request.createdAt ? formatDistanceToNow(new Date(request.createdAt), { addSuffix: true }) : 'recently'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Bank Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Account Name</p>
                          <p className="font-semibold">{request.accountName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Account Number</p>
                          <p className="font-semibold font-mono">{request.accountNumber}</p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">User ID</p>
                        <p className="font-mono text-xs">{request.userId}</p>
                      </div>
                    </div>

                    {/* Flag Reasons */}
                    {request.flagReasons.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Flag Reasons:
                        </p>
                        {request.flagReasons.map((reason, i) => (
                          <p key={i} className="text-xs text-muted-foreground pl-4 border-l-2 border-yellow-500/40">
                            {reason}
                          </p>
                        ))}
                      </div>
                    )}

                    <Separator />

                    {/* Actions */}
                    <div className="flex gap-2">
                      {/* Approve */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            disabled={isProcessing}
                          >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                            Approve & Transfer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve Payout?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately transfer <strong>₦{request.amountNaira.toLocaleString()}</strong> to{' '}
                              <strong>{request.accountName}</strong> via Paystack. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAction(request.id, 'approve')}
                            >
                              Yes, Transfer Now
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Reject */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            disabled={isProcessing}
                          >
                            <ShieldX className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject Payout?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The user's ₦{request.amountNaira.toLocaleString()} will be returned to their earnings balance. You can provide a reason below.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Textarea
                            placeholder="Reason for rejection (optional — user will see this)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="mt-2"
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => handleAction(request.id, 'reject')}
                            >
                              Reject & Refund
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
