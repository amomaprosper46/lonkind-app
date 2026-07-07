import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'genkit';

const AppealSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().default('Unknown User'),
  userHandle: z.string().default('unknown'),
  targetId: z.string().min(1),
  targetType: z.enum(['post', 'comment', 'message', 'user', 'livestream']),
  appealReason: z.string().min(1),
  actionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseRes = AppealSchema.safeParse(body);

    if (!parseRes.success) {
      return NextResponse.json(
        { error: 'Invalid appeal parameters provided.', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const data = parseRes.data;

    // Check if there is already a pending appeal for this item/user
    const existingAppeal = await adminDb
      .collection('appeals')
      .where('userId', '==', data.userId)
      .where('targetId', '==', data.targetId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingAppeal.empty) {
      return NextResponse.json(
        { error: 'You already have a pending appeal under review for this item.' },
        { status: 409 }
      );
    }

    const appealRef = adminDb.collection('appeals').doc();
    await appealRef.set({
      userId: data.userId,
      userName: data.userName,
      userHandle: data.userHandle,
      targetId: data.targetId,
      targetType: data.targetType,
      appealReason: data.appealReason,
      actionId: data.actionId || null,
      status: 'pending', // pending | approved | rejected
      timestamp: FieldValue.serverTimestamp(),
    });

    // Write to moderation Logs
    await adminDb.collection('moderationLogs').add({
      appealId: appealRef.id,
      targetId: data.targetId,
      targetType: data.targetType,
      targetOwnerUid: data.userId,
      action: 'appeal_submitted',
      reason: data.appealReason,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      appealId: appealRef.id,
      message: 'Your appeal has been submitted successfully to the Lonkind Moderation Team.',
    });
  } catch (error: any) {
    console.error('Submit appeal error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit appeal.' },
      { status: 500 }
    );
  }
}
