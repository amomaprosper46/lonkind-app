import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ads/feedback
 * Logs user ad controls ("Hide this ad" negative feedback or "Report ad" to Admin review queue).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const campaignId = String(body?.campaignId || '').trim();
    const action = body?.action === 'report' ? 'report' : 'hide';
    const userId = String(body?.userId || 'guest').slice(0, 128);
    const reason = String(body?.reason || (action === 'hide' ? 'User hid ad' : 'Inappropriate or misleading ad')).slice(0, 300);

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
    }

    const campaignRef = adminDb.collection('ad_campaigns').doc(campaignId);
    const campSnap = await campaignRef.get();
    const campData = campSnap.exists ? campSnap.data() : null;

    if (action === 'hide') {
      await Promise.all([
        adminDb.collection('ad_feedback').add({
          campaignId,
          userId,
          action: 'hide',
          reason,
          createdAt: FieldValue.serverTimestamp(),
        }),
        campSnap.exists
          ? campaignRef.update({ hiddenCount: FieldValue.increment(1) }).catch(() => {})
          : Promise.resolve(),
      ]);
      return NextResponse.json({ success: true, action: 'hide' });
    }

    // Report ad directly into mow's Admin Dashboard review queue (`ad_reports`)
    const reportRef = adminDb.collection('ad_reports').doc();
    await Promise.all([
      reportRef.set({
        id: reportRef.id,
        campaignId,
        campaignTitle: campData?.title || 'Unknown Campaign',
        publisherHandle: campData?.publisherHandle || 'unknown',
        reportedByUid: userId,
        reason,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      }),
      campSnap.exists
        ? campaignRef.update({ reportCount: FieldValue.increment(1) }).catch(() => {})
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true, action: 'report', reportId: reportRef.id });
  } catch (err: any) {
    console.error('[POST /api/ads/feedback] Error:', err);
    return NextResponse.json({ error: 'Could not submit feedback.' }, { status: 500 });
  }
}
