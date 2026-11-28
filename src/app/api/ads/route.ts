import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import {
  isSafeAdDestinationUrl,
  OFFICIAL_BRAND_PROFILE,
  OFFICIAL_BRAND_UID,
  type AdCampaign,
  type AdRevenueLedgerEntry,
} from '@/lib/ads-schema';
import { validateAdContentSafety } from '@/lib/age-and-ad-safety';

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
    targetAudience: data.targetAudience === '21+' ? '21+' : '18+',
    publisherUid: data.publisherUid || OFFICIAL_BRAND_UID,
    publisherName: data.publisherName || 'Lonkind',
    publisherHandle: data.publisherHandle || 'lonkind',
    publisherAvatar: data.publisherAvatar || '/logo.png',
    publisherVerifiedAge: typeof data.publisherVerifiedAge === 'number' ? data.publisherVerifiedAge : null,
    publisherIsAdult: data.publisherIsAdult !== false,
    publisherAccountStanding: data.publisherAccountStanding || 'Good Standing',
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
    blockedInvalidViews: Number(data.blockedInvalidViews || 0),
    paymentMethod: data.paymentMethod || (data.isOfficialBrand ? 'brand_free' : 'coins'),
    paymentStatus: data.paymentStatus || 'paid',
    refundStatus: data.refundStatus || 'none',
    flutterwaveTxRef: data.flutterwaveTxRef || null,
    flutterwaveTransactionId: data.flutterwaveTransactionId || null,
    flutterwaveRefundId: data.flutterwaveRefundId || null,
    refundErrorMessage: data.refundErrorMessage || null,
    refundedAt: toIso(data.refundedAt),
    amountPaid: Number(data.amountPaid || 0),
    currencyPaid: data.currencyPaid || null,
    reportCount: Number(data.reportCount || 0),
    rejectionReason: data.rejectionReason || null,
    refundId: data.refundId || null,
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

    if (scope === 'mine') {
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
      }
      let uid = '';
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
      }

      const snap = await adminDb
        .collection('ad_campaigns')
        .where('publisherUid', '==', uid)
        .limit(50)
        .get();

      const campaigns = snap.docs
        .map((d) => serializeCampaign(d.id, d.data()))
        .filter((c) => c.status !== 'deleted' && c.status !== 'awaiting_payment')
        .sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });

      return NextResponse.json({ campaigns });
    }

    if (scope === 'admin') {
      const authCheck = await verifySuperAdminRequest(req);
      if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
      }
      await ensureOfficialBrandAccount();
      const [snap, reportsSnap, revSnap] = await Promise.all([
        adminDb.collection('ad_campaigns').limit(100).get(),
        adminDb.collection('ad_reports').where('status', '==', 'pending').limit(50).get(),
        adminDb.collection('ad_revenue_ledger').limit(500).get(),
      ]);
      const campaigns = snap.docs
        .map((d) => serializeCampaign(d.id, d.data()))
        .filter((c) => c.status !== 'deleted' && c.status !== 'awaiting_payment')
        .sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });

      const directAdRevenueByCurrency: Record<string, number> = {};
      const revenueLedger: AdRevenueLedgerEntry[] = revSnap.docs
        .map((d) => {
          const rd = d.data();
          const curr = String(rd.currency || 'NGN').toUpperCase();
          const amt = Number(rd.amount || 0);
          if (amt !== 0) {
            directAdRevenueByCurrency[curr] = Number(
              ((directAdRevenueByCurrency[curr] || 0) + amt).toFixed(2)
            );
          }
          return {
            id: d.id,
            transactionId: String(rd.transactionId || d.id),
            txRef: String(rd.txRef || ''),
            type: (rd.type === 'ad_refund' ? 'ad_refund' : 'direct_ad_revenue') as
              | 'direct_ad_revenue'
              | 'ad_refund',
            provider: String(rd.provider || 'flutterwave'),
            campaignId: String(rd.campaignId || ''),
            payerUid: String(rd.payerUid || ''),
            payerHandle: String(rd.payerHandle || ''),
            amount: amt,
            currency: curr,
            status: String(rd.status || 'settled'),
            refundStatus: rd.refundStatus || 'none',
            flutterwaveRefundId: rd.flutterwaveRefundId || null,
            reason: rd.reason || null,
            createdAt: rd.createdAt?.toDate?.()?.toISOString?.() || null,
          };
        })
        .sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });

      const reports = reportsSnap.docs.map((d) => {
        const rd = d.data();
        return {
          id: d.id,
          campaignId: rd.campaignId || '',
          campaignTitle: rd.campaignTitle || 'Unknown Campaign',
          publisherHandle: rd.publisherHandle || 'unknown',
          reason: rd.reason || 'Reported by user',
          createdAt: rd.createdAt?.toDate?.()?.toISOString?.() || null,
        };
      });

      return NextResponse.json({
        campaigns,
        reports,
        directAdRevenueByCurrency,
        revenueLedger,
        brandProfile: OFFICIAL_BRAND_PROFILE,
      });
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
      const targetAudience = body.targetAudience === '21+' ? '21+' : '18+';

      if (!title || title.length < 3) {
        return NextResponse.json({ error: 'Ad title must be at least 3 characters.' }, { status: 400 });
      }
      if (!isSafeAdDestinationUrl(destinationUrl)) {
        return NextResponse.json(
          { error: 'Destination URL must start with https:// or a relative / path.' },
          { status: 400 }
        );
      }
      const safety = validateAdContentSafety(title, description, destinationUrl);
      if (!safety.safe) {
        return NextResponse.json({ error: safety.reason }, { status: 400 });
      }

      const now = Date.now();
      const expiresAt = Timestamp.fromMillis(now + durationHours * 60 * 60 * 1000);
      const docRef = adminDb.collection('ad_campaigns').doc();

      const payload = {
        kind: 'brand_ad',
        status: 'active',
        targetAudience,
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

      if (body.targetAudience === '18+' || body.targetAudience === '21+') {
        updates.targetAudience = body.targetAudience;
      }
      const safetyCheck = validateAdContentSafety(
        updates.title || '',
        updates.description || '',
        updates.destinationUrl || ''
      );
      if (!safetyCheck.safe) {
        return NextResponse.json({ error: safetyCheck.reason }, { status: 400 });
      }

      await adminDb.collection('ad_campaigns').doc(id).update(updates);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'approve_promotion') {
      const id = String(body.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Campaign ID required.' }, { status: 400 });
      const ref = adminDb.collection('ad_campaigns').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
      const durationHours = Number(snap.data()?.durationHours || 24);
      await ref.update({
        status: 'active',
        approvedByAdminUid: authCheck.uid,
        approvedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + durationHours * 60 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, id, status: 'active' });
    }

    if (action === 'reject_promotion') {
      const id = String(body.id || '').trim();
      if (!id) return NextResponse.json({ error: 'Campaign ID required.' }, { status: 400 });
      const campRef = adminDb.collection('ad_campaigns').doc(id);
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(campRef);
        if (!snap.exists) return;
        const data = snap.data()!;
        if (data.status !== 'pending_approval') return;
        const coinsToRefund = Math.floor(Number(data.coinsSpent || 0));
        if (coinsToRefund > 0 && data.publisherUid) {
          tx.update(adminDb.collection('users').doc(data.publisherUid), {
            coins: FieldValue.increment(coinsToRefund),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        tx.update(campRef, {
          status: 'rejected',
          rejectedByAdminUid: authCheck.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true, id, status: 'rejected' });
    }

    if (action === 'dismiss_report') {
      const reportId = String(body.reportId || '').trim();
      if (!reportId) return NextResponse.json({ error: 'Report ID required.' }, { status: 400 });
      await adminDb.collection('ad_reports').doc(reportId).update({
        status: 'reviewed',
        reviewedBy: authCheck.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, reportId });
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
