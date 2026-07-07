import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { lonkindModeratorAiFlow } from '@/ai/flows/lonkind-moderator-ai';
import { z } from 'genkit';

const SubmitReportSchema = z.object({
  reporterUid: z.string().min(1),
  reporterName: z.string().default('Anonymous Community Member'),
  reporterHandle: z.string().default('anonymous'),
  targetType: z.enum(['post', 'comment', 'message', 'user', 'livestream']),
  targetId: z.string().min(1),
  targetOwnerUid: z.string().min(1),
  reportReason: z.string().min(1),
  reportDescription: z.string().optional(),
  targetContentSnippet: z.string().optional(),
  targetAuthorHandle: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseRes = SubmitReportSchema.safeParse(body);

    if (!parseRes.success) {
      return NextResponse.json(
        { error: 'Invalid reporting payload parameters provided.', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const data = parseRes.data;

    // 1. Never allow the same user to submit multiple reports for the exact same item
    const duplicateCheck = await adminDb
      .collection('reports')
      .where('reporterUid', '==', data.reporterUid)
      .where('targetId', '==', data.targetId)
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      return NextResponse.json(
        { error: 'You have already submitted a report for this specific item or account.' },
        { status: 409 }
      );
    }

    // 2. Trust Score Calculation & Weight Determination
    const trustDocRef = adminDb.collection('trustscores').doc(data.reporterUid);
    const trustDoc = await trustDocRef.get();
    let trustScore = 100;

    if (!trustDoc.exists) {
      await trustDocRef.set({
        score: 100,
        reportsSubmitted: 1,
        correctReports: 0,
        falseReports: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      trustScore = trustDoc.data()?.score || 100;
      await trustDocRef.update({
        reportsSubmitted: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Determine weight multiplier based on trust score
    let reporterWeight = 1.0;
    if (trustScore >= 120) reporterWeight = 2.0;
    else if (trustScore >= 80) reporterWeight = 1.5;
    else if (trustScore < 40) reporterWeight = 0.5;

    // 3. Query existing unique reports for this target item and account
    const existingTargetReports = await adminDb
      .collection('reports')
      .where('targetId', '==', data.targetId)
      .get();

    let totalTargetWeight = reporterWeight;
    existingTargetReports.docs.forEach((docSnap) => {
      totalTargetWeight += docSnap.data().reporterTrustWeight || 1.0;
    });

    const existingAccountReports = await adminDb
      .collection('reports')
      .where('targetOwnerUid', '==', data.targetOwnerUid)
      .get();

    let totalAccountWeight = reporterWeight;
    existingAccountReports.docs.forEach((docSnap) => {
      totalAccountWeight += docSnap.data().reporterTrustWeight || 1.0;
    });

    // 4. Run Lonkind Moderator AI Engine
    const aiEvaluation = await lonkindModeratorAiFlow({
      targetType: data.targetType,
      targetId: data.targetId,
      reportReason: data.reportReason,
      reportDescription: data.reportDescription,
      targetContentSnippet: data.targetContentSnippet,
      targetAuthorHandle: data.targetAuthorHandle,
      uniqueReportCount: existingTargetReports.size + 1,
      weightedReportScore: totalTargetWeight,
    });

    // 5. Apply Automated Moderation Threshold Enforcement Rules
    let finalStatus: 'pending' | 'hidden' | 'escalated' | 'ignored' = 'pending';
    let actionTaken: string | null = null;

    if (aiEvaluation.isObviouslyFakeOrDuplicate || aiEvaluation.recommendedAction === 'ignore') {
      finalStatus = 'ignored';
      actionTaken = 'ignored_by_ai';
    } else if (totalAccountWeight >= 10 || aiEvaluation.recommendedAction === 'restrict_account') {
      // Rule: If 10 different trusted users report the same account -> restrict posting temporarily & notify
      finalStatus = 'hidden';
      actionTaken = 'restrict_account_48h';

      // Set restriction on user profile (48 hours from now)
      const restrictionExpires = new Date();
      restrictionExpires.setHours(restrictionExpires.getHours() + 48);

      await adminDb.collection('users').doc(data.targetOwnerUid).update({
        isRestricted: true,
        restrictionReason: `Account temporarily restricted due to community reports: ${data.reportReason}`,
        restrictionExpiresAt: restrictionExpires,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Also hide the reported content if applicable
      if (data.targetType === 'post') {
        await adminDb.collection('posts').doc(data.targetId).update({
          isHidden: true,
          moderationStatus: 'hidden',
          moderationReason: data.reportReason,
          updatedAt: FieldValue.serverTimestamp(),
        }).catch((err) => console.warn('Could not hide post:', err));
      }

      // Log moderation action
      await adminDb.collection('moderationActions').add({
        targetId: data.targetId,
        targetType: data.targetType,
        ownerUid: data.targetOwnerUid,
        action: 'restrict_account',
        automated: true,
        reason: data.reportReason,
        aiConfidence: aiEvaluation.confidenceScore,
        explanation: aiEvaluation.explanation,
        timestamp: FieldValue.serverTimestamp(),
      });

      // Notify user via system notification collection
      await adminDb.collection('notifications').add({
        userId: data.targetOwnerUid,
        title: '⚠️ Account Temporarily Restricted',
        message: 'Your account posting privileges have been restricted for 48 hours following multiple community safety reports. You may appeal this decision in your profile.',
        type: 'moderation',
        read: false,
        timestamp: FieldValue.serverTimestamp(),
      });
    } else if (totalTargetWeight >= 5 || aiEvaluation.recommendedAction === 'hide_content') {
      // Rule: If 5 different trusted users report the same content -> automatically hide content & notify
      finalStatus = 'hidden';
      actionTaken = 'hide_content';

      if (data.targetType === 'post') {
        await adminDb.collection('posts').doc(data.targetId).update({
          isHidden: true,
          moderationStatus: 'hidden',
          moderationReason: data.reportReason,
          updatedAt: FieldValue.serverTimestamp(),
        }).catch((err) => console.warn('Could not hide post:', err));
      }

      await adminDb.collection('moderationActions').add({
        targetId: data.targetId,
        targetType: data.targetType,
        ownerUid: data.targetOwnerUid,
        action: 'hide_content',
        automated: true,
        reason: data.reportReason,
        aiConfidence: aiEvaluation.confidenceScore,
        explanation: aiEvaluation.explanation,
        timestamp: FieldValue.serverTimestamp(),
      });

      await adminDb.collection('notifications').add({
        userId: data.targetOwnerUid,
        title: '🙈 Content Hidden by Auto-Moderation',
        message: `Your recent ${data.targetType} was hidden from the global timeline after receiving multiple community trust reports. You can submit an appeal if you believe this was an error.`,
        type: 'moderation',
        read: false,
        timestamp: FieldValue.serverTimestamp(),
      });
    } else if (
      aiEvaluation.confidenceScore >= 80 ||
      aiEvaluation.recommendedAction === 'escalate' ||
      (aiEvaluation.confidenceScore >= 40 && aiEvaluation.confidenceScore <= 60) ||
      ['Hate Speech', 'Violence', 'Nudity', 'Scam/Fraud'].includes(data.reportReason)
    ) {
      // High risk, severe abuse, or AI uncertainty -> Escalate to Admin Moderation Dashboard
      finalStatus = 'escalated';
      actionTaken = 'escalated_to_admin';
    } else {
      // Rule: If only 1 person reports something -> save the report. Do nothing else.
      finalStatus = 'pending';
      actionTaken = 'saved_pending';
    }

    // 6. Save report record to Firestore
    const newReportRef = adminDb.collection('reports').doc();
    await newReportRef.set({
      reporterUid: data.reporterUid,
      reporterName: data.reporterName,
      reporterHandle: data.reporterHandle,
      targetType: data.targetType,
      targetId: data.targetId,
      targetOwnerUid: data.targetOwnerUid,
      reportReason: data.reportReason,
      reportDescription: data.reportDescription || '',
      targetContentSnippet: data.targetContentSnippet || '',
      targetAuthorHandle: data.targetAuthorHandle || '',
      reporterTrustWeight: reporterWeight,
      totalTargetWeight,
      totalAccountWeight,
      status: finalStatus,
      actionTaken,
      aiEvaluation,
      timestamp: FieldValue.serverTimestamp(),
    });

    // 7. Write to immutable Moderation Logs
    await adminDb.collection('moderationLogs').add({
      reportId: newReportRef.id,
      targetId: data.targetId,
      targetType: data.targetType,
      reporterUid: data.reporterUid,
      targetOwnerUid: data.targetOwnerUid,
      reason: data.reportReason,
      aiConfidence: aiEvaluation.confidenceScore,
      recommendedAction: aiEvaluation.recommendedAction,
      finalStatus,
      actionTaken,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      reportId: newReportRef.id,
      status: finalStatus,
      actionTaken,
      aiEvaluation,
      message: 'Report processed successfully by Lonkind Moderator AI.',
    });
  } catch (error: any) {
    console.error('Submit report server error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit report due to server exception.' },
      { status: 500 }
    );
  }
}
