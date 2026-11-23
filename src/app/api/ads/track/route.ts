import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ads/track
 * Tracks campaign impressions and deduplicated unique clicks.
 * Automatically marks campaigns `completed` once `targetImpressions` is reached.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const campaignId = String(body?.campaignId || '').trim();
    const event = body?.event === 'click' ? 'click' : 'impression';
    const rawViewerId = String(body?.viewerId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'anon';

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
    }

    const campaignRef = adminDb.collection('ad_campaigns').doc(campaignId);

    if (event === 'impression') {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(campaignRef);
        if (!snap.exists) return;
        const data = snap.data()!;
        if (data.status !== 'active') return;
        const nextImpressions = Number(data.impressions || 0) + 1;
        const target = Number(data.targetImpressions || 0);
        tx.update(campaignRef, {
          impressions: FieldValue.increment(1),
          ...(target > 0 && nextImpressions >= target ? { status: 'completed' } : {}),
        });
      });
      return NextResponse.json({ success: true, event: 'impression' });
    }

    // Deduplicated unique click tracking
    const clickRef = campaignRef.collection('unique_clicks').doc(rawViewerId);
    await adminDb.runTransaction(async (tx) => {
      const [campSnap, clickSnap] = await Promise.all([
        tx.get(campaignRef),
        tx.get(clickRef),
      ]);
      if (!campSnap.exists) return;
      if (!clickSnap.exists) {
        tx.set(clickRef, {
          viewerId: rawViewerId,
          clickedAt: FieldValue.serverTimestamp(),
        });
        tx.update(campaignRef, {
          uniqueClicks: FieldValue.increment(1),
        });
      }
    });

    return NextResponse.json({ success: true, event: 'click' });
  } catch (err: any) {
    console.warn('[POST /api/ads/track] Warning:', err?.message);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
