import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import {
  isSafeAdDestinationUrl,
  OFFICIAL_BRAND_PROFILE,
  OFFICIAL_BRAND_UID,
  type AdCampaign,
} from '@/lib/ads-schema';

export const dynamic = 'force-dynamic';

function serializeCampaign(id: string, data: Record<string, any>): AdCampaign {
  const toIso = (val: any): string | null => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate().toISOString();
    if (typeof val === 'string') return val;
    return null;
  };

  return {
    id,
    kind: data.kind || 'brand_ad',
    status: data.status || 'active',
    publisherUid: data.publisherUid || OFFICIAL_BRAND_UID,
    publisherName: data.publisherName || 'Lonkind',
    publisherHandle: data.publisherHandle || 'lonkind',
    publisherAvatar: data.publisherAvatar || '/logo.png',
    isOfficialBrand: Boolean(data.isOfficialBrand),
    title: data.title || '',
    description: data.description || '',
    mediaUrl: data.mediaUrl || '',
    thumbnailUrl: data.thumbnailUrl || data.mediaUrl || '',
    mediaType: data.mediaType === 'video' ? 'video' : 'image',
    ctaLabel: data.ctaLabel || 'Learn More',
    destinationUrl: data.destinationUrl || '/',
    targetType: data.targetType || 'external',
    targetPostId: data.targetPostId || null,
    targetHostUid: data.targetHostUid || null,
    placement: data.placement || 'all',
    packageId: data.packageId || 'brand_custom',
    budgetTier: data.budgetTier || 'Official Brand',
    coinsSpent: Number(data.coinsSpent || 0),
    targetImpressions: Number(data.targetImpressions || 10000),
    durationHours: Number(data.durationHours || 168),
    impressions: Number(data.impressions || 0),
    uniqueClicks: Number(data.uniqueClicks || 0),
    createdAt: toIso(data.createdAt),
    expiresAt: toIso(data.expiresAt),
  };
}

async function ensureOfficialBrandAccount() {
  const ref = adminDb.collection('users').doc(OFFICIAL_BRAND_UID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      ...OFFICIAL_BRAND_PROFILE,
      followersCount: 0,
      followingCount: 0,
      coins: 0,
      diamonds: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  } else if (snap.data()?.isOfficialBrand !== true) {
    await ref.set(
      {
        isOfficialBrand: true,
        isVerified: true,
        handle: 'lonkind',
        username: 'lonkind',
      },
      { merge: true }
    );
  }
}

/**
 * GET /api/ads
 * - `?scope=admin`: Requires super_admin Bearer token; returns all campaigns + analytics.
 * - `?placement=feed|live`: Public active campaigns for feed / live discovery slots.
 */
export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope');
    const placement = req.nextUrl.searchParams.get('placement') || 'all';

    if (scope === 'admin') {
      const authCheck = await verifySuperAdminRequest(req);
      if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
      }
      await ensureOfficialBrandAccount();
      const snap = await adminDb.collection('ad_campaigns').limit(100).get();
      const campaigns = snap.docs
        .map((d) => serializeCampaign(d.id, d.data()))
        .filter((c) => c.status !== 'deleted')
        .sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });

      return NextResponse.json({ campaigns, brandProfile: OFFICIAL_BRAND_PROFILE });
    }

    // Public active campaigns
    const snap = await adminDb
      .collection('ad_campaigns')
      .where('status', '==', 'active')
      .limit(30)
      .get();

    const nowMs = Date.now();
    const campaigns = snap.docs
      .map((d) => serializeCampaign(d.id, d.data()))
      .filter((c) => {
        if (c.expiresAt && new Date(c.expiresAt).getTime() <= nowMs) return false;
        if (c.targetImpressions > 0 && c.impressions >= c.targetImpressions) return false;
        if (placement === 'feed' && c.placement === 'live') return false;
        if (placement === 'live' && c.placement === 'feed') return false;
        return true;
      })
      .sort((a, b) => {
        // Prioritize official brand campaigns and newer promotions
        if (a.isOfficialBrand !== b.isOfficialBrand) return a.isOfficialBrand ? -1 : 1;
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error('[GET /api/ads] Error:', err);
    return NextResponse.json({ campaigns: [], error: err?.message || 'Failed to load ads' }, { status: 500 });
  }
}

/**
 * POST /api/ads
 * Super-Admin (`@mow`) Ad Manager CRUD for official `@lonkind` sponsored campaigns
 * and campaign moderation (create, update, toggle_status, delete).
 */
export async function POST(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    await ensureOfficialBrandAccount();
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const mediaUrl = String(body.mediaUrl || '').trim();
      const thumbnailUrl = String(body.thumbnailUrl || mediaUrl).trim();
      const mediaType = body.mediaType === 'video' ? 'video' : 'image';
      const ctaLabel = String(body.ctaLabel || 'Learn More').trim().slice(0, 30);
      const destinationUrl = String(body.destinationUrl || 'https://lonkind.com').trim();
      const placement =
        body.placement === 'feed' || body.placement === 'live' ? body.placement : 'all';
      const durationHours = Math.max(1, Math.min(24 * 90, Number(body.durationHours || 168)));
      const targetImpressions = Math.max(100, Math.min(10_000_000, Number(body.targetImpressions || 25000)));
      const budgetTier = String(body.budgetTier || 'Official Brand').trim().slice(0, 40);

      if (!title || title.length < 3) {
        return NextResponse.json({ error: 'Ad title must be at least 3 characters.' }, { status: 400 });
      }
      if (!isSafeAdDestinationUrl(destinationUrl)) {
        return NextResponse.json(
          { error: 'Destination URL must start with https:// or a relative / path.' },
          { status: 400 }
        );
      }

      const now = Date.now();
      const expiresAt = Timestamp.fromMillis(now + durationHours * 60 * 60 * 1000);
      const docRef = adminDb.collection('ad_campaigns').doc();

      const payload = {
        kind: 'brand_ad',
        status: 'active',
        publisherUid: OFFICIAL_BRAND_UID,
        publisherName: OFFICIAL_BRAND_PROFILE.name,
        publisherHandle: OFFICIAL_BRAND_PROFILE.handle,
        publisherAvatar: OFFICIAL_BRAND_PROFILE.avatarUrl,
        isOfficialBrand: true,
        title,
        description,
        mediaUrl,
        thumbnailUrl,
        mediaType,
        ctaLabel,
        destinationUrl,
        targetType: destinationUrl.startsWith('/live') ? 'live' : 'external',
        placement,
        packageId: 'brand_campaign',
        budgetTier,
        coinsSpent: 0,
        targetImpressions,
        durationHours,
        impressions: 0,
        uniqueClicks: 0,
        createdByAdminUid: authCheck.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt,
      };

      await docRef.set(payload);
      return NextResponse.json({
        success: true,
        id: docRef.id,
        campaign: serializeCampaign(docRef.id, {
          ...payload,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + durationHours * 3600 * 1000).toISOString(),
        }),
      });
    }

    if (action === 'update') {
      const id = String(body.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Campaign ID required.' }, { status: 400 });

      const updates: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim();
      if (typeof body.description === 'string') updates.description = body.description.trim();
      if (typeof body.mediaUrl === 'string') updates.mediaUrl = body.mediaUrl.trim();
      if (typeof body.thumbnailUrl === 'string') updates.thumbnailUrl = body.thumbnailUrl.trim();
      if (body.mediaType === 'image' || body.mediaType === 'video') updates.mediaType = body.mediaType;
      if (typeof body.ctaLabel === 'string' && body.ctaLabel.trim()) updates.ctaLabel = body.ctaLabel.trim();
      if (typeof body.destinationUrl === 'string' && body.destinationUrl.trim()) {
        if (!isSafeAdDestinationUrl(body.destinationUrl)) {
          return NextResponse.json({ error: 'Invalid destination URL.' }, { status: 400 });
        }
        updates.destinationUrl = body.destinationUrl.trim();
      }
      if (body.placement === 'all' || body.placement === 'feed' || body.placement === 'live') {
        updates.placement = body.placement;
      }
      if (typeof body.budgetTier === 'string' && body.budgetTier.trim()) {
        updates.budgetTier = body.budgetTier.trim();
      }
      if (body.targetImpressions !== undefined) {
        updates.targetImpressions = Math.max(100, Number(body.targetImpressions) || 1000);
      }

      await adminDb.collection('ad_campaigns').doc(id).update(updates);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'toggle_status') {
      const id = String(body.id || '').trim();
      const nextStatus = body.status === 'paused' ? 'paused' : 'active';
      if (!id) return NextResponse.json({ error: 'Campaign ID required.' }, { status: 400 });
      await adminDb.collection('ad_campaigns').doc(id).update({
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, id, status: nextStatus });
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Campaign ID required.' }, { status: 400 });
      await adminDb.collection('ad_campaigns').doc(id).delete();
      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/ads] Error:', err);
    return NextResponse.json({ error: err?.message || 'Ad operation failed.' }, { status: 500 });
  }
}
