import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  getPromoPackagePrice,
  isSafeAdDestinationUrl,
  PROMO_PACKAGES,
  type PromoPackageId,
} from '@/lib/ads-schema';
import { validateAdContentSafety } from '@/lib/age-and-ad-safety';
import { assertAdultUserForAction } from '@/lib/age-gate-server';
import { assertPhoneVerifiedForAction } from '@/lib/phone-verification-gate';
import { verifyAppCheckRequest } from '@/lib/app-check-server';
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  sanitizePlainText,
} from '@/lib/security-shield';

export const dynamic = 'force-dynamic';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lonkind.com';

function resolveCanonicalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return req.nextUrl.origin;
  }
  return APP_URL.replace(/\/$/, '');
}

/**
 * POST /api/ads/flutterwave/initialize
 * Initializes a direct Flutterwave checkout (Card, Bank Transfer, USSD, Mobile Money)
 * for a Lonkind Ad / Promotion with a unique `LONKIND_AD_` transaction reference,
 * completely isolated from coin purchases (`flw_tx_...` / `LONKIND_COIN_`).
 */
export async function POST(req: NextRequest) {
  const appCheck = await verifyAppCheckRequest(req, 'ads/flutterwave/initialize');
  if (!appCheck.ok) return appCheck.response;
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json(
        { error: 'Flutterwave Ad checkout is not configured (FLW_SECRET_KEY missing).' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Please sign in to launch an ad.' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
    } catch {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const uid = decoded.uid as string;
    const rl = checkRateLimit({
      namespace: 'ads_flw_init',
      key: uid,
      ...RATE_LIMIT_PRESETS.FINANCIAL_ACTION,
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const [ageGate, phoneGate] = await Promise.all([
      assertAdultUserForAction(uid, 'purchasing promoted ads'),
      assertPhoneVerifiedForAction(uid, 'purchasing promoted ads'),
    ]);
    if (!ageGate.allowed) {
      return NextResponse.json({ error: ageGate.error }, { status: 403 });
    }
    if (!phoneGate.allowed) {
      return NextResponse.json({ error: phoneGate.error, code: phoneGate.code }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

    const packageId = String(body.packageId || '') as PromoPackageId;
    const pkg = PROMO_PACKAGES[packageId];
    if (!pkg) {
      return NextResponse.json({ error: 'Please select a valid promotion package.' }, { status: 400 });
    }

    const currency = String(body.currency || 'NGN').toUpperCase();
    const expectedAmount = getPromoPackagePrice(pkg, currency);

    const targetType = body.targetType === 'live' ? 'live' : 'post';
    const title = sanitizePlainText(body.title, 120);
    const description = sanitizePlainText(body.description, 280);
    const mediaUrl = String(body.mediaUrl || '').trim();
    const thumbnailUrl = String(body.thumbnailUrl || mediaUrl).trim();
    const mediaType = body.mediaType === 'video' ? 'video' : 'image';
    const ctaLabel =
      sanitizePlainText(body.ctaLabel, 30) ||
      (targetType === 'live' ? 'Join Live' : 'View Post');
    const targetPostId = targetType === 'post' ? String(body.targetPostId || '').trim() || null : null;
    const targetHostUid = targetType === 'live' ? uid : null;
    const destinationUrl =
      targetType === 'live'
        ? `/live/live_${uid}`
        : targetPostId
        ? `/?post=${encodeURIComponent(targetPostId)}`
        : '/';

    if (!title || title.length < 2) {
      return NextResponse.json({ error: 'Please provide a short promotion headline.' }, { status: 400 });
    }
    if (!isSafeAdDestinationUrl(destinationUrl)) {
      return NextResponse.json({ error: 'Invalid destination URL.' }, { status: 400 });
    }

    const contentSafety = validateAdContentSafety(title, description, destinationUrl);
    if (!contentSafety.safe) {
      return NextResponse.json({ error: contentSafety.reason }, { status: 400 });
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data()! : {};
    const customerEmail = String(userData.email || decoded.email || 'advertiser@lonkind.com').trim();
    const customerName = String(userData.name || 'Lonkind Creator').trim();

    const campaignRef = adminDb.collection('ad_campaigns').doc();
    const txRef = `LONKIND_AD_${campaignRef.id}_${Date.now()}`;
    const origin = resolveCanonicalOrigin(req);

    // Save draft campaign as `awaiting_payment` before opening Flutterwave checkout
    await campaignRef.set({
      kind: 'user_promote',
      status: 'awaiting_payment',
      paymentMethod: 'flutterwave',
      paymentStatus: 'pending',
      flutterwaveTxRef: txRef,
      flutterwaveTransactionId: null,
      amountPaid: expectedAmount,
      currencyPaid: currency,
      targetAudience: '18+',
      publisherUid: uid,
      publisherName: customerName,
      publisherHandle: userData.handle || userData.username || 'creator',
      publisherAvatar: userData.avatarUrl || '',
      publisherVerifiedAge: typeof userData.age === 'number' ? userData.age : null,
      publisherIsAdult: userData.isAdult !== false,
      publisherAccountStanding: userData.isBanned
        ? 'Suspended'
        : userData.fraudFlagged
        ? 'Flagged'
        : 'Good Standing',
      isOfficialBrand: false,
      title,
      description,
      mediaUrl,
      thumbnailUrl,
      mediaType,
      ctaLabel,
      destinationUrl,
      targetType,
      targetPostId,
      targetHostUid,
      placement: targetType === 'live' ? 'all' : 'feed',
      packageId: pkg.id,
      budgetTier: pkg.name,
      coinsSpent: 0,
      targetImpressions: pkg.targetImpressions,
      durationHours: pkg.durationHours,
      impressions: 0,
      uniqueClicks: 0,
      blockedInvalidViews: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + pkg.durationHours * 60 * 60 * 1000),
    });

    const flwPayload = {
      tx_ref: txRef,
      amount: expectedAmount,
      currency,
      payment_options: 'card,banktransfer,ussd,mobilemoney',
      redirect_url: `${origin}/api/ads/flutterwave/callback`,
      customer: {
        email: customerEmail,
        name: customerName,
      },
      meta: {
        purpose: 'lonkind_ad_promotion',
        campaignId: campaignRef.id,
        publisherUid: uid,
        packageId: pkg.id,
      },
      customizations: {
        title: 'Lonkind Ads & Promote',
        description: `${pkg.name} — ${pkg.targetImpressions.toLocaleString()} target views (${pkg.durationLabel})`,
        logo: `${origin}/logo.png`,
      },
    };

    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flwPayload),
    });

    const flwJson = await flwRes.json().catch(() => null);
    if (!flwRes.ok || flwJson?.status !== 'success' || !flwJson?.data?.link) {
      await campaignRef.delete().catch(() => {});
      return NextResponse.json(
        { error: flwJson?.message || 'Could not initialize Flutterwave Ad checkout.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentLink: flwJson.data.link,
      txRef,
      campaignId: campaignRef.id,
      amount: expectedAmount,
      currency,
    });
  } catch (err: any) {
    console.error('[POST /api/ads/flutterwave/initialize] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unable to start Flutterwave checkout.' },
      { status: 500 }
    );
  }
}
