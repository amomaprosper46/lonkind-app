import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { AD_DEDUP_WINDOW_MS, isAutomatedBotUserAgent } from '@/lib/ad-viewability-guard';

export const dynamic = 'force-dynamic';

// In-memory sliding rate limiter per viewer/IP (max 30 ad events per 60 seconds)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 30;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const list = rateBuckets.get(key) || [];
  const fresh = list.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX_EVENTS) {
    rateBuckets.set(key, fresh);
    return true;
  }
  fresh.push(now);
  rateBuckets.set(key, fresh);
  if (rateBuckets.size > 5000) {
    rateBuckets.clear();
  }
  return false;
}

/**
 * POST /api/ads/track
 * Hardened Anti-Ad Fraud & Viewability Guard backend:
 * 1. Automated / headless bot user-agent exclusion
 * 2. Per-IP / per-viewer rate limiting (30 events/min)
 * 3. Self-view (creator's own ad) & Super-Admin (`mow`) exclusion
 * 4. Rolling 1-hour deduplication per (viewerId + campaignId + event)
 * 5. Tracks both validated impressions/clicks AND `blockedInvalidViews` for Admin Fraud Insights
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const campaignId = String(body?.campaignId || '').trim();
    const event = body?.event === 'click' ? 'click' : 'impression';
    const rawViewerId =
      String(body?.viewerId || 'anon')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64) || 'anon';

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
    }

    const campaignRef = adminDb.collection('ad_campaigns').doc(campaignId);
    const userAgent = req.headers.get('user-agent') || '';
    const clientIp = (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown'
    ).trim();

    // 1. Automated / headless bot exclusion
    if (isAutomatedBotUserAgent(userAgent)) {
      await campaignRef.update({ blockedInvalidViews: FieldValue.increment(1) }).catch(() => {});
      return NextResponse.json({ success: false, blocked: 'bot_user_agent' }, { status: 200 });
    }

    // 2. Per-IP / per-viewer rate limiting
    const rateKey = `${clientIp}:${rawViewerId}`;
    if (isRateLimited(rateKey)) {
      await campaignRef.update({ blockedInvalidViews: FieldValue.increment(1) }).catch(() => {});
      return NextResponse.json({ success: false, blocked: 'rate_limited' }, { status: 429 });
    }

    // 3. Super-Admin (`mow`) exclusion check
    if (rawViewerId !== 'anon' && rawViewerId !== 'guest') {
      const viewerSnap = await adminDb.collection('users').doc(rawViewerId).get().catch(() => null);
      const viewerData = viewerSnap?.exists ? viewerSnap.data() : null;
      if (viewerData?.role === 'super_admin' || viewerData?.isAdmin === true) {
        await campaignRef.update({ blockedInvalidViews: FieldValue.increment(1) }).catch(() => {});
        return NextResponse.json({ success: false, blocked: 'admin_excluded' }, { status: 200 });
      }
    }

    // 4. Rolling 1-hour deduplication & self-view exclusion inside atomic transaction
    const dedupId = `${rawViewerId}_${event}`;
    const windowRef = campaignRef.collection('view_windows').doc(dedupId);
    const nowMs = Date.now();
    let blockedReason: string | null = null;

    await adminDb.runTransaction(async (tx) => {
      const [campSnap, winSnap] = await Promise.all([tx.get(campaignRef), tx.get(windowRef)]);
      if (!campSnap.exists) return;

      const campData = campSnap.data()!;
      if (campData.status !== 'active') return;

      // Never count creator's own views or clicks
      if (rawViewerId !== 'anon' && rawViewerId !== 'guest' && campData.publisherUid === rawViewerId) {
        blockedReason = 'self_view_excluded';
        tx.update(campaignRef, { blockedInvalidViews: FieldValue.increment(1) });
        return;
      }

      // Rolling 1-hour deduplication per (userId + campaignId + event)
      if (winSnap.exists) {
        const lastMs = Number(winSnap.data()?.lastCountedAtMs || 0);
        if (nowMs - lastMs < AD_DEDUP_WINDOW_MS) {
          blockedReason = 'duplicate_within_1h';
          tx.update(campaignRef, { blockedInvalidViews: FieldValue.increment(1) });
          return;
        }
      }

      tx.set(windowRef, {
        viewerId: rawViewerId,
        event,
        lastCountedAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (event === 'impression') {
        const nextImpressions = Number(campData.impressions || 0) + 1;
        const target = Number(campData.targetImpressions || 0);
        tx.update(campaignRef, {
          impressions: FieldValue.increment(1),
          ...(target > 0 && nextImpressions >= target ? { status: 'completed' } : {}),
        });
      } else {
        tx.update(campaignRef, {
          uniqueClicks: FieldValue.increment(1),
        });
      }
    });

    if (blockedReason) {
      return NextResponse.json({ success: false, blocked: blockedReason }, { status: 200 });
    }

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    console.warn('[POST /api/ads/track] Warning:', err?.message);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
