import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
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
import { commitDoubleEntryJournalInTx, type DoubleEntryLeg } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ads/promote
 * Self-serve Creator/User promotion launcher.
 * - Strictly validates package pricing server-side.
 * - Atomically deducts coins from `users/{uid}.coins` before activating the campaign.
 * - Records `type: "ad_spend"` in `transactions` and a platform revenue journal entry,
 *   100% isolated from creator Diamonds / withdrawable payout balances.
 */
export async function POST(req: NextRequest) {
  const appCheck = await verifyAppCheckRequest(req, 'ads/promote');
  if (!appCheck.ok) return appCheck.response;
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Please sign in to promote content.' }, { status: 401 });
    }

    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
    } catch {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const uid = decodedToken.uid as string;

    // Enforce 18+ Age Gate before creating promoted ads
    const rl = checkRateLimit({
      namespace: 'ads_promote',
      key: uid,
      ...RATE_LIMIT_PRESETS.FINANCIAL_ACTION,
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const [ageGate, phoneGate] = await Promise.all([
      assertAdultUserForAction(uid, 'creating promoted ads'),
      assertPhoneVerifiedForAction(uid, 'launching promotions'),
    ]);
    if (!ageGate.allowed) {
      return NextResponse.json({ error: ageGate.error }, { status: 403 });
    }
    if (!phoneGate.allowed) {
      return NextResponse.json({ error: phoneGate.error, code: phoneGate.code }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const packageId = String(body.packageId || '') as PromoPackageId;
    const pkg = PROMO_PACKAGES[packageId];
    if (!pkg) {
      return NextResponse.json({ error: 'Please select a valid promotion package.' }, { status: 400 });
    }

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

    // Block prohibited/unsafe ad categories via keyword safety check
    const contentSafety = validateAdContentSafety(title, description, destinationUrl);
    if (!contentSafety.safe) {
      return NextResponse.json({ error: contentSafety.reason }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(uid);
    const campaignRef = adminDb.collection('ad_campaigns').doc();
    const txRef = adminDb.collection('transactions').doc();
    const nowMs = Date.now();
    const expiresAt = Timestamp.fromMillis(nowMs + pkg.durationHours * 60 * 60 * 1000);

    let newCoinBalance = 0;

    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('USER_NOT_FOUND');
      }

      const userData = userSnap.data()!;
      const currentCoins = Math.floor(Number(userData.coins || 0));

      if (currentCoins < pkg.coins) {
        const err: any = new Error('INSUFFICIENT_COINS');
        err.code = 'INSUFFICIENT_COINS';
        err.currentCoins = currentCoins;
        err.requiredCoins = pkg.coins;
        throw err;
      }

      newCoinBalance = currentCoins - pkg.coins;

      // 1. Atomic coin deduction (NEVER touches diamonds or payout balances)
      tx.update(userRef, {
        coins: newCoinBalance,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2. Submit promoted campaign to Admin review queue (`pending_review`)
      tx.set(campaignRef, {
        kind: 'user_promote',
        status: 'pending_review',
        targetAudience: '18+',
        publisherUid: uid,
        publisherName: userData.name || 'Lonkind Creator',
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
        coinsSpent: pkg.coins,
        targetImpressions: pkg.targetImpressions,
        durationHours: pkg.durationHours,
        impressions: 0,
        uniqueClicks: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt,
      });

      // Tag the creator's post with `promotionStatus: "pending_review"` so the status badge renders immediately
      if (targetType === 'post' && targetPostId) {
        tx.set(
          adminDb.collection('posts').doc(targetPostId),
          {
            promotionStatus: 'pending_review',
            activeCampaignId: campaignRef.id,
          },
          { merge: true }
        );
      }

      // 3. Isolated `type: "ad_spend"` transaction log (excluded from creator earnings/payouts)
      tx.set(txRef, {
        userId: uid,
        type: 'ad_spend',
        status: 'completed',
        coins: -pkg.coins,
        amountCoins: pkg.coins,
        campaignId: campaignRef.id,
        packageId: pkg.id,
        packageName: pkg.name,
        targetType,
        targetPostId,
        withdrawable: false,
        countsTowardCreatorPayout: false,
        description: `Promoted ${targetType === 'live' ? 'Live Stream' : 'Post'} (${pkg.name} — ${pkg.coins} Coins)`,
        time: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      // 4. Isolated Double-Entry Ledger entry (Platform Ad Revenue only — zero Diamonds)
      const legs: DoubleEntryLeg[] = [
        {
          accountId: uid,
          accountKind: 'USER',
          asset: 'COINS',
          direction: 'DEBIT',
          amount: pkg.coins,
          balanceBefore: currentCoins,
          balanceAfter: newCoinBalance,
        },
        {
          accountId: 'LONKIND_AD_REVENUE_COINS',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: pkg.coins,
          balanceBefore: 0,
          balanceAfter: pkg.coins,
        },
      ];

      commitDoubleEntryJournalInTx(adminDb, tx, {
        journalType: 'AD_SPEND',
        idempotencyKey: `ad_spend_${campaignRef.id}`,
        reference: campaignRef.id,
        actorUid: uid,
        description: `Ad spend (${pkg.name}): ${pkg.coins} coins for ${targetType}`,
        legs,
        metadata: {
          type: 'ad_spend',
          packageId: pkg.id,
          campaignId: campaignRef.id,
          targetType,
        },
      });
    });

    return NextResponse.json({
      success: true,
      campaignId: campaignRef.id,
      coinsDeducted: pkg.coins,
      remainingCoins: newCoinBalance,
      package: pkg,
    });
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_COINS') {
      return NextResponse.json(
        {
          error: `You need ${err.requiredCoins.toLocaleString()} Coins for this package, but you have ${err.currentCoins.toLocaleString()} Coins.`,
          code: 'INSUFFICIENT_COINS',
          requiredCoins: err.requiredCoins,
          currentCoins: err.currentCoins,
        },
        { status: 402 }
      );
    }
    if (err?.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    console.error('[POST /api/ads/promote] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unable to launch promotion right now.' },
      { status: 500 }
    );
  }
}
