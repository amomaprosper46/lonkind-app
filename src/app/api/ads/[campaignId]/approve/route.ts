import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ads/[campaignId]/approve
 * Super-Admin (`role === "super_admin"` / `@mow`) endpoint to approve a pending
 * user-submitted promotion, start its active timer, and notify the creator.
 */
export async function POST(
  req: NextRequest,
  context: { params: { campaignId: string } }
) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const campaignId = String(context?.params?.campaignId || '').trim();
    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId.' }, { status: 400 });
    }

    const campRef = adminDb.collection('ad_campaigns').doc(campaignId);
    let publisherUid = '';
    let campaignTitle = '';

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(campRef);
      if (!snap.exists) {
        throw new Error('NOT_FOUND');
      }

      const data = snap.data()!;
      if (data.status === 'active') {
        publisherUid = data.publisherUid || '';
        campaignTitle = data.title || 'Your promotion';
        return;
      }

      if (data.status !== 'pending_review' && data.status !== 'pending_approval') {
        throw new Error(`INVALID_STATUS:${data.status}`);
      }

      const durationHours = Number(data.durationHours || 24);
      const expiresAt = Timestamp.fromMillis(Date.now() + durationHours * 60 * 60 * 1000);
      publisherUid = data.publisherUid || '';
      campaignTitle = data.title || 'Your promotion';

      tx.update(campRef, {
        status: 'active',
        approvedByAdminUid: authCheck.uid,
        approvedAt: FieldValue.serverTimestamp(),
        expiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (data.targetType === 'post' && data.targetPostId) {
        tx.set(
          adminDb.collection('posts').doc(data.targetPostId),
          {
            promotionStatus: 'active',
            activeCampaignId: campaignId,
          },
          { merge: true }
        );
      }

      if (publisherUid) {
        const notifRef = adminDb
          .collection('users')
          .doc(publisherUid)
          .collection('notifications')
          .doc();
        tx.set(notifRef, {
          type: 'ad_approved',
          title: 'Your promotion is now live!',
          message: `Your promotion "${campaignTitle}" has been approved and is now live on Lonkind.`,
          campaignId,
          read: false,
          timestamp: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      campaignId,
      status: 'active',
      message: 'Promotion approved and now live.',
    });
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }
    if (typeof err?.message === 'string' && err.message.startsWith('INVALID_STATUS:')) {
      return NextResponse.json(
        { error: `Campaign cannot be approved from status: ${err.message.split(':')[1]}` },
        { status: 409 }
      );
    }
    console.error('[POST /api/ads/[campaignId]/approve] Error:', err);
    return NextResponse.json({ error: 'Unable to approve promotion.' }, { status: 500 });
  }
}
