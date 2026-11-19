import { FieldValue, Firestore } from 'firebase-admin/firestore';
import {
  buildIdempotencyKey,
  commitDoubleEntryJournalInTx,
  DoubleEntryLeg,
} from '@/lib/ledger';

export const FIRST_PURCHASE_BONUS_RATE = 0.20;
const ELIGIBILITY_QUERY_TIMEOUT_MS = 2500;

/**
 * Pure integer math calculation for the 20% First-Time Coin Purchase Bonus.
 * Uses `Math.floor` strictly so floating-point decimals can never enter wallet balances.
 */
export function calculateFirstPurchaseBonusCoins(baseCoins: number, isEligible: boolean): number {
  if (!isEligible) return 0;
  if (!Number.isFinite(baseCoins) || baseCoins <= 0) return 0;
  const safeBase = Math.floor(baseCoins);
  return Math.floor(safeBase * FIRST_PURCHASE_BONUS_RATE);
}

/**
 * Pure eligibility predicate:
 * A user is eligible ONLY if `hasMadeFirstPurchase` is NOT true AND they have 0 prior
 * verified `status === 'success'` coin purchases. Failed, pending, or refunded attempts
 * never burn first-time eligibility.
 */
export function isEligibleForFirstPurchaseBonus(
  userData: Record<string, any> | null | undefined,
  priorSuccessfulPurchaseCount: number
): boolean {
  if (userData?.hasMadeFirstPurchase === true) return false;
  if (!Number.isFinite(priorSuccessfulPurchaseCount) || priorSuccessfulPurchaseCount > 0) return false;
  return true;
}

export interface SettleCoinPurchaseParams {
  gateway: 'flutterwave' | 'paystack';
  /** Unique provider transaction ID / payment intent ID used as primary idempotency key */
  providerTransactionId: string;
  /** Internal checkout reference (`tx_ref` or Paystack `reference`) */
  reference: string;
  userId: string;
  /** Base purchased coins (never includes client-calculated bonus) */
  baseCoins: number;
  amountPaid: number;
  currency: string;
  purpose?: string;
  source?: string;
  /** Optional webhook log doc ref to record atomically inside the same transaction */
  webhookLogDocId?: string;
  webhookEvent?: string;
}

export interface SettleCoinPurchaseResult {
  alreadyProcessed: boolean;
  journalId?: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoinsCredited: number;
  coinsBefore?: number;
  coinsAfter?: number;
  appliedFirstPurchaseBonus: boolean;
  eligibilityFallbackUsed: boolean;
}

/**
 * Checks whether a user has any prior settled (`status === 'success'`) coin purchase.
 * Wrapped in a strict timeout & try/catch so a slow or failing query NEVER breaks checkout;
 * on error/timeout, returns `{ ok: false, count: 0 }` which forces safe fallback `bonus = 0`.
 */
async function safeCountPriorSuccessfulPurchases(
  db: Firestore,
  userId: string,
  currentReference: string
): Promise<{ ok: boolean; count: number }> {
  try {
    const queryPromise = db
      .collection('transactions')
      .where('userId', '==', userId)
      .where('status', '==', 'success')
      .limit(5)
      .get();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ELIGIBILITY_TIMEOUT')), ELIGIBILITY_QUERY_TIMEOUT_MS)
    );

    const snap = await Promise.race([queryPromise, timeoutPromise]);
    const priorSuccesses = snap.docs.filter((d) => {
      if (d.id === currentReference) return false;
      const data = d.data() || {};
      const type = String(data.type || 'coin_purchase');
      return type === 'coin_purchase' && data.status === 'success';
    });

    return { ok: true, count: priorSuccesses.length };
  } catch (err) {
    console.warn('[FirstPurchaseBonus] Eligibility check fallback (defaulting bonus=0):', err);
    return { ok: false, count: 0 };
  }
}

/**
 * Atomically settles a confirmed coin purchase + server-validated 20% First-Time Purchase Bonus.
 *
 * Guarantees:
 *  - Server-side validation only (ignores any client-side bonus calculation)
 *  - Single atomic Firestore ACID transaction (all-or-nothing rollback on failure)
 *  - Provider transaction ID idempotency lock (duplicate webhooks never double-credit)
 *  - Strict integer math (`Math.floor(baseCoins * 0.20)`)
 *  - Separate double-entry ledger legs tagged `type: 'promo_bonus'` for payout/ledger isolation
 *  - Safe fallback (`bonus = 0`) if eligibility verification errors or times out
 */
export async function settleCoinPurchaseWithFirstTimeBonus(
  db: Firestore,
  params: SettleCoinPurchaseParams
): Promise<SettleCoinPurchaseResult> {
  const safeBaseCoins = Math.floor(Number(params.baseCoins || 0));
  if (!params.userId || !Number.isFinite(safeBaseCoins) || safeBaseCoins <= 0) {
    throw new Error('INVALID_BASE_COINS');
  }

  const cleanGateway = params.gateway;
  const gatewayAccount =
    cleanGateway === 'paystack' ? 'EXTERNAL_GATEWAY_PAYSTACK' : 'EXTERNAL_GATEWAY_FLUTTERWAVE';
  const uniqueProviderKey = String(params.providerTransactionId || params.reference).trim();
  const reference = String(params.reference || uniqueProviderKey).trim();

  // Primary idempotency key bound to the provider's unique transaction_id + reference
  const providerIdempotencyKey = buildIdempotencyKey(
    `coin_purchase_${cleanGateway}`,
    uniqueProviderKey
  );
  const referenceIdempotencyKey = buildIdempotencyKey(
    `coin_purchase_${cleanGateway}`,
    reference
  );

  // Pre-query prior successful purchases outside transaction with safe timeout fallback
  const eligibilityProbe = await safeCountPriorSuccessfulPurchases(db, params.userId, reference);
  const eligibilityFallbackUsed = !eligibilityProbe.ok;

  const providerIdemRef = db.collection('ledger_idempotency').doc(providerIdempotencyKey);
  const refIdemRef = db.collection('ledger_idempotency').doc(referenceIdempotencyKey);
  const txDocRef = db.collection('transactions').doc(reference);
  const userRef = db.collection('users').doc(params.userId);
  const webhookLogRef = params.webhookLogDocId
    ? db.collection('webhookLogs').doc(params.webhookLogDocId)
    : null;

  return await db.runTransaction(async (tx) => {
    const reads: Promise<FirebaseFirestore.DocumentSnapshot>[] = [
      tx.get(providerIdemRef),
      tx.get(refIdemRef),
      tx.get(txDocRef),
      tx.get(userRef),
    ];
    if (webhookLogRef) {
      reads.push(tx.get(webhookLogRef));
    }

    const snaps = await Promise.all(reads);
    const [providerIdemSnap, refIdemSnap, existingTxSnap, userSnap, webhookSnap] = snaps;

    // Idempotency guard: duplicate callback or duplicate webhook never double-credits
    if (
      providerIdemSnap.exists ||
      refIdemSnap.exists ||
      (webhookSnap && webhookSnap.exists) ||
      (existingTxSnap.exists && existingTxSnap.data()?.status === 'success')
    ) {
      const existingData = existingTxSnap.data() || {};
      const existingBase = Math.floor(Number(existingData.baseCoins || existingData.coinsAdded || safeBaseCoins));
      const existingBonus = Math.floor(Number(existingData.bonusCoins || 0));
      return {
        alreadyProcessed: true,
        baseCoins: existingBase,
        bonusCoins: existingBonus,
        totalCoinsCredited: existingBase + existingBonus,
        appliedFirstPurchaseBonus: existingBonus > 0,
        eligibilityFallbackUsed,
      };
    }

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const coinsBefore = Math.floor(Number(userData.coins || 0));

    // Strictly server-side eligibility decision; falls back safely to 0 if probe failed
    const eligible =
      !eligibilityFallbackUsed &&
      isEligibleForFirstPurchaseBonus(userData, eligibilityProbe.count);

    const bonusCoins = calculateFirstPurchaseBonusCoins(safeBaseCoins, eligible);
    const totalCoinsCredited = safeBaseCoins + bonusCoins;
    const coinsAfterBase = coinsBefore + safeBaseCoins;
    const coinsAfter = coinsBefore + totalCoinsCredited;

    // Build Double-Entry Zero-Sum Ledger Legs (base purchase + isolated promo_bonus)
    const legs: DoubleEntryLeg[] = [
      {
        accountId: gatewayAccount,
        accountKind: 'EXTERNAL_GATEWAY',
        asset: 'COINS',
        direction: 'DEBIT',
        amount: safeBaseCoins,
        balanceBefore: safeBaseCoins,
        balanceAfter: 0,
        entryType: 'coin_purchase',
      },
      {
        accountId: params.userId,
        accountKind: 'USER',
        asset: 'COINS',
        direction: 'CREDIT',
        amount: safeBaseCoins,
        balanceBefore: coinsBefore,
        balanceAfter: coinsAfterBase,
        entryType: 'coin_purchase',
      },
    ];

    if (bonusCoins > 0) {
      legs.push(
        {
          accountId: 'LONKIND_PROMO_BONUS_TREASURY',
          accountKind: 'SYSTEM_TREASURY',
          asset: 'COINS',
          direction: 'DEBIT',
          amount: bonusCoins,
          balanceBefore: bonusCoins,
          balanceAfter: 0,
          entryType: 'promo_bonus',
        },
        {
          accountId: params.userId,
          accountKind: 'USER',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: bonusCoins,
          balanceBefore: coinsAfterBase,
          balanceAfter: coinsAfter,
          entryType: 'promo_bonus',
        }
      );
    }

    const { journalId } = commitDoubleEntryJournalInTx(db, tx, {
      journalType: 'COIN_PURCHASE',
      idempotencyKey: providerIdempotencyKey,
      reference,
      actorUid: params.userId,
      description:
        bonusCoins > 0
          ? `${cleanGateway} coin purchase (${safeBaseCoins} base + ${bonusCoins} first-time promo_bonus) ref=${reference}`
          : `${cleanGateway} coin purchase (${safeBaseCoins} L) ref=${reference}`,
      legs,
      metadata: {
        gateway: cleanGateway,
        providerTransactionId: uniqueProviderKey,
        reference,
        amountPaid: params.amountPaid,
        currency: params.currency,
        baseCoins: safeBaseCoins,
        bonusCoins,
        totalCoinsCredited,
        bonusType: bonusCoins > 0 ? 'promo_bonus' : null,
        source: params.source || `${cleanGateway}_settlement`,
      },
    });

    // Also lock reference-based idempotency key when distinct from providerTransactionId
    if (referenceIdempotencyKey !== providerIdempotencyKey) {
      tx.set(refIdemRef, {
        idempotencyKey: referenceIdempotencyKey,
        linkedProviderKey: providerIdempotencyKey,
        journalId,
        journalType: 'COIN_PURCHASE',
        reference,
        actorUid: params.userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (webhookLogRef) {
      tx.set(webhookLogRef, {
        event: params.webhookEvent || 'charge.completed',
        reference,
        providerTransactionId: uniqueProviderKey,
        status: 'successful',
        processedAt: FieldValue.serverTimestamp(),
      });
    }

    // Record canonical transaction receipt with isolated base vs promo_bonus fields
    tx.set(
      txDocRef,
      {
        id: reference,
        journalId,
        userId: params.userId,
        gateway: cleanGateway,
        ...(cleanGateway === 'flutterwave'
          ? { flutterwaveReference: reference, flwTransactionId: uniqueProviderKey }
          : { paystackReference: reference, paystackTransactionId: uniqueProviderKey }),
        amount: params.amountPaid,
        ...(params.currency === 'NGN' ? { amountNaira: params.amountPaid } : {}),
        currency: params.currency || 'NGN',
        baseCoins: safeBaseCoins,
        bonusCoins,
        bonusType: bonusCoins > 0 ? 'promo_bonus' : null,
        coinsAdded: totalCoinsCredited,
        coinsBefore,
        coinsAfter,
        status: 'success',
        type: params.purpose || 'coin_purchase',
        source: params.source || `${cleanGateway}_settlement`,
        time: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Atomically update user balance & mark `hasMadeFirstPurchase: true`
    const userUpdates: Record<string, any> = {
      coins: coinsAfter,
      walletBalance: coinsAfter,
      hasMadeFirstPurchase: true,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!userData.firstPurchaseAt) {
      userUpdates.firstPurchaseAt = FieldValue.serverTimestamp();
    }
    if (bonusCoins > 0) {
      userUpdates.promoBonusCoinsReceived =
        Math.floor(Number(userData.promoBonusCoinsReceived || 0)) + bonusCoins;
    }

    tx.set(userRef, userUpdates, { merge: true });

    // In-app purchase confirmation notification
    const notifRef = userRef.collection('notifications').doc();
    tx.set(notifRef, {
      type: 'coins_purchased',
      coins: totalCoinsCredited,
      baseCoins: safeBaseCoins,
      bonusCoins,
      amount: params.amountPaid,
      currency: params.currency || 'NGN',
      timestamp: FieldValue.serverTimestamp(),
      read: false,
    });

    return {
      alreadyProcessed: false,
      journalId,
      baseCoins: safeBaseCoins,
      bonusCoins,
      totalCoinsCredited,
      coinsBefore,
      coinsAfter,
      appliedFirstPurchaseBonus: bonusCoins > 0,
      eligibilityFallbackUsed,
    };
  });
}
