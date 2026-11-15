import { FieldValue, Transaction, Firestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * LONKIND DOUBLE-ENTRY LEDGER ENGINE (ACID TRANSACTIONAL)
 * =======================================================
 * Never uses a blind `UPDATE user SET balance = balance - 10`.
 * Every balance mutation:
 *  1. Executes strictly inside a Firestore ACID serializable transaction (`db.runTransaction`).
 *  2. Locks & checks an Idempotency Key (`ledger_idempotency/{key}`) INSIDE the transaction.
 *  3. Locks & reads the current account snapshots (`tx.get(...)`) INSIDE the transaction.
 *  4. Verifies solvency (`balanceBefore >= debitAmount`) before any write.
 *  5. Enforces the Double-Entry Zero-Sum Invariant:
 *     Every DEBIT (-amount) from a source account is paired with an equal CREDIT (+amount)
 *     to a destination account so that Sum(signedDelta) === 0.
 *  6. Writes an immutable `ledger_journals/{journalId}` document and paired
 *     `ledger_entries/{entryId}` documents recording `balanceBefore` and `balanceAfter`.
 */

export type LedgerAsset = 'COINS' | 'DIAMONDS' | 'CASH_USD' | 'CASH_NGN';

export type LedgerEntryDirection = 'DEBIT' | 'CREDIT';

export type LedgerJournalType =
  | 'GIFT_TRANSFER'
  | 'VIP_POST_UNLOCK'
  | 'COIN_PURCHASE'
  | 'PAYOUT_ESCROW_HOLD'
  | 'PAYOUT_SETTLED'
  | 'PAYOUT_REFUND';

export interface DoubleEntryLeg {
  accountId: string;
  accountKind: 'USER' | 'SYSTEM_TREASURY' | 'SYSTEM_ESCROW' | 'EXTERNAL_GATEWAY';
  asset: LedgerAsset;
  direction: LedgerEntryDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface LedgerJournalSpec {
  journalType: LedgerJournalType;
  idempotencyKey: string;
  reference: string;
  actorUid: string;
  description: string;
  legs: DoubleEntryLeg[];
  metadata?: Record<string, unknown>;
}

/**
 * Generates a deterministic SHA-256 idempotency key for ledger operations.
 */
export function buildIdempotencyKey(namespace: string, ...parts: Array<string | number>): string {
  return crypto
    .createHash('sha256')
    .update(`${namespace}:${parts.join(':')}`)
    .digest('hex');
}

/**
 * Validates the Double-Entry Zero-Sum Invariant across all legs per asset type:
 * For each asset, total DEBIT amount must equal total CREDIT amount.
 */
export function assertDoubleEntryZeroSum(legs: DoubleEntryLeg[]): void {
  if (!legs || legs.length < 2) {
    throw new Error('LEDGER_INVALID_LEGS: A double-entry journal requires at least 2 legs.');
  }

  const assetSums = new Map<LedgerAsset, number>();

  for (const leg of legs) {
    if (!Number.isFinite(leg.amount) || leg.amount <= 0) {
      throw new Error(`LEDGER_INVALID_AMOUNT: Amount must be positive (got ${leg.amount}).`);
    }

    const signedDelta = leg.direction === 'DEBIT' ? -leg.amount : leg.amount;
    const expectedAfter = Number((leg.balanceBefore + signedDelta).toFixed(4));
    const actualAfter = Number(leg.balanceAfter.toFixed(4));

    if (Math.abs(expectedAfter - actualAfter) > 0.0001) {
      throw new Error(
        `LEDGER_BALANCE_MISMATCH: Account ${leg.accountId} (${leg.asset}) balanceAfter ${actualAfter} !== balanceBefore ${leg.balanceBefore} + (${signedDelta})`
      );
    }

    // User accounts can never go negative
    if (leg.accountKind === 'USER' && leg.balanceAfter < 0) {
      throw new Error(`INSUFFICIENT_SOLVENCY_${leg.balanceBefore}`);
    }

    const currentNet = assetSums.get(leg.asset) || 0;
    assetSums.set(leg.asset, Number((currentNet + signedDelta).toFixed(4)));
  }

  for (const [asset, net] of assetSums.entries()) {
    if (Math.abs(net) > 0.0001) {
      throw new Error(
        `LEDGER_IMBALANCE_EXCEPTION: Asset ${asset} does not balance to zero (net delta = ${net}).`
      );
    }
  }
}

/**
 * Commits a verified Double-Entry Journal and its paired Debit/Credit Ledger Entries
 * inside an active Firestore ACID Transaction (`tx`).
 *
 * IMPORTANT: Callers must perform all `tx.get(...)` reads BEFORE calling `commitDoubleEntryJournalInTx`
 * because Firestore requires all reads in a transaction to execute before any writes.
 */
export function commitDoubleEntryJournalInTx(
  db: Firestore,
  tx: Transaction,
  spec: LedgerJournalSpec
): { journalId: string; entryIds: string[] } {
  // 1. Verify Double-Entry Zero-Sum Invariant (Sum of Debits == Sum of Credits per asset)
  assertDoubleEntryZeroSum(spec.legs);

  const journalRef = db.collection('ledger_journals').doc();
  const idempotencyRef = db.collection('ledger_idempotency').doc(spec.idempotencyKey);

  // 2. Lock the Idempotency Key inside the same ACID transaction
  tx.set(idempotencyRef, {
    idempotencyKey: spec.idempotencyKey,
    journalId: journalRef.id,
    journalType: spec.journalType,
    reference: spec.reference,
    actorUid: spec.actorUid,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 3. Write the Immutable Journal Header
  tx.set(journalRef, {
    id: journalRef.id,
    journalType: spec.journalType,
    idempotencyKey: spec.idempotencyKey,
    reference: spec.reference,
    actorUid: spec.actorUid,
    description: spec.description,
    legCount: spec.legs.length,
    metadata: spec.metadata || {},
    status: 'POSTED',
    createdAt: FieldValue.serverTimestamp(),
  });

  // 4. Write each paired Debit / Credit Ledger Entry + Mirror to wallet_audit_logs
  const entryIds: string[] = [];

  spec.legs.forEach((leg, index) => {
    const entryRef = db.collection('ledger_entries').doc();
    entryIds.push(entryRef.id);
    const signedDelta = leg.direction === 'DEBIT' ? -leg.amount : leg.amount;

    tx.set(entryRef, {
      id: entryRef.id,
      journalId: journalRef.id,
      journalType: spec.journalType,
      reference: spec.reference,
      legIndex: index,
      accountId: leg.accountId,
      accountKind: leg.accountKind,
      asset: leg.asset,
      direction: leg.direction,
      amount: leg.amount,
      signedDelta,
      balanceBefore: leg.balanceBefore,
      balanceAfter: leg.balanceAfter,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Also write an append-only audit log for every USER leg so existing admin audit views stay populated
    if (leg.accountKind === 'USER') {
      const auditRef = db.collection('wallet_audit_logs').doc();
      tx.set(auditRef, {
        userId: leg.accountId,
        journalId: journalRef.id,
        ledgerEntryId: entryRef.id,
        type: spec.journalType.toLowerCase(),
        direction: leg.direction,
        delta: signedDelta,
        balanceBefore: leg.balanceBefore,
        balanceAfter: leg.balanceAfter,
        currency: leg.asset.toLowerCase(),
        reference: spec.reference,
        timestamp: FieldValue.serverTimestamp(),
      });
    }
  });

  return { journalId: journalRef.id, entryIds };
}
