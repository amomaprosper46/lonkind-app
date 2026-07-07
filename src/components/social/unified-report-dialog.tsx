'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, CheckCircle, AlertTriangle, Flag, Sparkles } from 'lucide-react';

export type TargetType = 'post' | 'comment' | 'message' | 'user' | 'livestream';

export interface UnifiedReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reporterUid: string;
  reporterName: string;
  reporterHandle: string;
  targetType: TargetType;
  targetId: string;
  targetOwnerUid: string;
  targetAuthorHandle?: string;
  targetContentSnippet?: string;
}

const REPORT_REASONS = [
  { id: 'Spam', label: 'Spam or Misleading', icon: '📩', desc: 'Unwanted promotional content or repetitive posts' },
  { id: 'Harassment', label: 'Harassment or Bullying', icon: '🚫', desc: 'Targeting individuals with malicious intent' },
  { id: 'Hate Speech', label: 'Hate Speech', icon: '🤬', desc: 'Attacking protected identity groups or encouraging discrimination' },
  { id: 'Violence', label: 'Violence or Severe Harm', icon: '⚠️', desc: 'Graphic violence, threats, or self-harm encouragement' },
  { id: 'Nudity', label: 'Nudity or Sexual Content', icon: '🔞', desc: 'Explicit adult media or non-consensual sharing' },
  { id: 'Fake Account', label: 'Fake or Impersonation', icon: '🎭', desc: 'Impersonating another person, brand, or bot account' },
  { id: 'Scam/Fraud', label: 'Scam or Financial Fraud', icon: '💸', desc: 'Phishing, fake investments, or unauthorized begging schemes' },
  { id: 'Copyright', label: 'Copyright Infringement', icon: '©️', desc: 'Using copyrighted intellectual property without authorization' },
  { id: 'Other', label: 'Other Policy Violation', icon: '❓', desc: 'Something else breaking Lonkind community safety standards' },
];

export default function UnifiedReportDialog({
  isOpen,
  onClose,
  reporterUid,
  reporterName,
  reporterHandle,
  targetType,
  targetId,
  targetOwnerUid,
  targetAuthorHandle = 'unknown',
  targetContentSnippet = '',
}: UnifiedReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast({ variant: 'destructive', title: 'Select a Reason', description: 'Please choose the main reason for this report.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/moderation/submit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUid,
          reporterName,
          reporterHandle,
          targetType,
          targetId,
          targetOwnerUid,
          reportReason: selectedReason,
          reportDescription: description,
          targetContentSnippet: targetContentSnippet.slice(0, 300),
          targetAuthorHandle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          toast({
            variant: 'destructive',
            title: 'Already Reported',
            description: 'You have already submitted a safety report for this specific item.',
          });
          onClose();
          return;
        }
        throw new Error(data.error || 'Could not process report.');
      }

      setIsSuccess(true);
      toast({
        title: '🛡️ Safety Report Received',
        description: 'Lonkind Moderator AI has logged your report. Thank you for keeping our community safe!',
      });

      setTimeout(() => {
        setIsSuccess(false);
        setSelectedReason(null);
        setDescription('');
        onClose();
      }, 1800);
    } catch (error: any) {
      console.error('Report submission failed:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: error.message || 'We could not submit your report at this moment. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (!isSubmitting) {
      setSelectedReason(null);
      setDescription('');
      setIsSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-background border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" />
            Lonkind Community Safety &amp; Trust
          </div>
          <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
            <span>Report {targetType === 'user' ? `@${targetAuthorHandle}` : `this ${targetType}`}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Our automated safety engine, <strong>Lonkind Moderator AI</strong>, evaluates all reports immediately. Trusted community members help protect our platform.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 border border-green-500/20 shadow-lg shadow-green-500/10">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Report Logged Successfully!</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Lonkind Moderator AI is reviewing this report right now. If confirmed, automated safety thresholds will protect the community.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {targetContentSnippet && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground italic line-clamp-2">
                &ldquo;{targetContentSnippet}&rdquo;
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Select Policy Violation Reason
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason.id;
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setSelectedReason(reason.id)}
                      className={`text-left p-3 rounded-xl border transition-all duration-200 flex items-start gap-3 ${
                        isSelected
                          ? 'border-rose-500 bg-rose-500/10 text-foreground shadow-sm ring-2 ring-rose-500/20'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      <span className="text-xl leading-none mt-0.5">{reason.icon}</span>
                      <div className="space-y-0.5 flex-1">
                        <div className={`text-xs font-bold ${isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                          {reason.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                          {reason.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="report-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Additional Description (Optional)
                </Label>
                <span className="text-[10px] text-muted-foreground">{description.length}/300</span>
              </div>
              <Textarea
                id="report-desc"
                placeholder="Provide any specific context, timestamps, or details to help Lonkind Moderator AI verify this report faster..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={3}
                className="resize-none rounded-xl bg-muted/20 focus:bg-background transition-colors text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 text-xs text-indigo-300">
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>
                <strong>Trust Weight Active:</strong> Verified reports improve your personal Lonkind Trust Score, giving your future safety alerts up to 2x impact.
              </span>
            </div>
          </div>
        )}

        {!isSuccess && (
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-2">
            <Button variant="ghost" onClick={handleModalClose} disabled={isSubmitting} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedReason}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold px-6 shadow-lg shadow-rose-500/20 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              <span>Submit Safety Report</span>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
