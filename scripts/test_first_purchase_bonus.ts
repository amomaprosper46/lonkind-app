import assert from 'node:assert/strict';
import {
  calculateFirstPurchaseBonusCoins,
  isEligibleForFirstPurchaseBonus,
  settleCoinPurchaseWithFirstTimeBonus,
} from '../src/lib/first-purchase-bonus';

/**
 * Lightweight in-memory ACID Firestore mock for deterministic integration testing
 * of `settleCoinPurchaseWithFirstTimeBonus` + `commitDoubleEntryJournalInTx`.
 */
class InMemoryFirestore {
  store = new Map<string, Record<string, any>>();
  failNextTransactionsQuery = false;
  autoIdSeq = 0;

  private makeDocRef(path: string): any {
    const self = this;
    return {
      id: path.split('/').pop()!,
      path,
      collection(subName: string) {
        return self.makeCollectionRef(`${path}/${subName}`);
      },
      async get() {
        const val = self.store.get(path);
        return {
          id: path.split('/').pop()!,
          exists: val !== undefined,
          data: () => (val ? { ...val } : undefined),
        };
      },
    };
  }

  private makeCollectionRef(colPath: string, filters: Array<{ field: string; val: any }> = []): any {
    const self = this;
    return {
      doc(docId?: string) {
        const id = docId || `auto_${++self.autoIdSeq}`;
        return self.makeDocRef(`${colPath}/${id}`);
      },
      where(field: string, _op: string, val: any) {
        return self.makeCollectionRef(colPath, [...filters, { field, val }]);
      },
      limit(_n: number) {
        return self.makeCollectionRef(colPath, filters);
      },
      async get() {
        if (colPath === 'transactions' && self.failNextTransactionsQuery) {
          self.failNextTransactionsQuery = false;
          throw new Error('SIMULATED_FIRESTORE_TIMEOUT');
        }
        const docs: any[] = [];
        const prefix = `${colPath}/`;
        for (const [k, v] of self.store.entries()) {
          if (!k.startsWith(prefix)) continue;
          const rest = k.slice(prefix.length);
          if (rest.includes('/')) continue; // direct children only
          const matches = filters.every((f) => v[f.field] === f.val);
          if (matches) {
            docs.push({
              id: rest,
              exists: true,
              data: () => ({ ...v }),
            });
          }
        }
        return { docs, empty: docs.length === 0 };
      },
    };
  }

  collection(colPath: string) {
    return this.makeCollectionRef(colPath);
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    // Stage writes atomically — if `fn` throws, nothing commits (true rollback)
    const staged = new Map<string, { data: Record<string, any>; merge: boolean }>();
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: (docRef: any, data: Record<string, any>, opts?: { merge?: boolean }) => {
        staged.set(docRef.path, { data: { ...data }, merge: Boolean(opts?.merge) });
      },
      update: (docRef: any, data: Record<string, any>) => {
        staged.set(docRef.path, { data: { ...data }, merge: true });
      },
    };

    const result = await fn(tx);

    // Commit staged writes only after transaction function succeeds
    for (const [path, entry] of staged.entries()) {
      const prev = this.store.get(path) || {};
      this.store.set(path, entry.merge ? { ...prev, ...entry.data } : entry.data);
    }
    return result;
  }

  getEntriesByCollection(colPath: string): Array<{ id: string; data: Record<string, any> }> {
    const prefix = `${colPath}/`;
    const out: Array<{ id: string; data: Record<string, any> }> = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) {
        out.push({ id: k.slice(prefix.length), data: v });
      }
    }
    return out;
  }
}

async function runTests() {
  let passed = 0;

  // TEST 1: Pure integer math & rounding (no decimals)
  assert.equal(calculateFirstPurchaseBonusCoins(500, true), 100);
  assert.equal(calculateFirstPurchaseBonusCoins(103, true), 20, 'Math.floor(103 * 0.20) must be 20');
  assert.equal(calculateFirstPurchaseBonusCoins(1, true), 0);
  assert.equal(calculateFirstPurchaseBonusCoins(500, false), 0);
  assert.equal(isEligibleForFirstPurchaseBonus({ hasMadeFirstPurchase: false }, 0), true);
  assert.equal(isEligibleForFirstPurchaseBonus({ hasMadeFirstPurchase: true }, 0), false);
  assert.equal(isEligibleForFirstPurchaseBonus({}, 1), false);
  console.log('PASS [1/6]: Pure integer math & eligibility guards');
  passed++;

  // TEST 2 (a): First-time purchase gets +20% + separate `promo_bonus` ledger entry
  {
    const db = new InMemoryFirestore();
    db.store.set('users/user_a', { coins: 50, name: 'Alice' });

    const res = await settleCoinPurchaseWithFirstTimeBonus(db as any, {
      gateway: 'flutterwave',
      providerTransactionId: 'flw_90001',
      reference: 'flw_tx_user_a_1',
      userId: 'user_a',
      baseCoins: 500,
      amountPaid: 5000,
      currency: 'NGN',
    });

    assert.equal(res.alreadyProcessed, false);
    assert.equal(res.baseCoins, 500);
    assert.equal(res.bonusCoins, 100);
    assert.equal(res.totalCoinsCredited, 600);
    assert.equal(res.appliedFirstPurchaseBonus, true);

    const userAfter = db.store.get('users/user_a')!;
    assert.equal(userAfter.coins, 650, '50 existing + 500 base + 100 bonus = 650');
    assert.equal(userAfter.walletBalance, 650);
    assert.equal(userAfter.hasMadeFirstPurchase, true);
    assert.equal(userAfter.promoBonusCoinsReceived, 100);

    const ledgerEntries = db.getEntriesByCollection('ledger_entries');
    const promoLegs = ledgerEntries.filter((e) => e.data.type === 'promo_bonus');
    assert.equal(promoLegs.length, 2, 'Promo bonus must be recorded as a separate paired double-entry ledger leg');
    console.log('PASS [2/6]: (a) First-time purchase credits +20% & records isolated promo_bonus ledger legs');
    passed++;

    // TEST 3 (c): Duplicate webhook with same providerTransactionId does NOT double-credit
    const dupRes = await settleCoinPurchaseWithFirstTimeBonus(db as any, {
      gateway: 'flutterwave',
      providerTransactionId: 'flw_90001',
      reference: 'flw_tx_user_a_1',
      userId: 'user_a',
      baseCoins: 500,
      amountPaid: 5000,
      currency: 'NGN',
    });

    assert.equal(dupRes.alreadyProcessed, true);
    assert.equal(db.store.get('users/user_a')!.coins, 650, 'Balance must NOT change on duplicate webhook');
    assert.equal(
      db.getEntriesByCollection('ledger_entries').length,
      ledgerEntries.length,
      'Duplicate webhook must write zero new ledger entries'
    );
    console.log('PASS [3/6]: (c) Duplicate webhook is idempotently blocked (no double-credit)');
    passed++;

    // TEST 4 (b): Second purchase by the same user gets +0% bonus
    const secondRes = await settleCoinPurchaseWithFirstTimeBonus(db as any, {
      gateway: 'flutterwave',
      providerTransactionId: 'flw_90002',
      reference: 'flw_tx_user_a_2',
      userId: 'user_a',
      baseCoins: 500,
      amountPaid: 5000,
      currency: 'NGN',
    });

    assert.equal(secondRes.alreadyProcessed, false);
    assert.equal(secondRes.baseCoins, 500);
    assert.equal(secondRes.bonusCoins, 0, 'Second purchase must receive 0 bonus');
    assert.equal(secondRes.totalCoinsCredited, 500);
    assert.equal(secondRes.appliedFirstPurchaseBonus, false);
    assert.equal(db.store.get('users/user_a')!.coins, 1150, '650 + 500 = 1150');
    console.log('PASS [4/6]: (b) Second purchase receives +0% bonus');
    passed++;
  }

  // TEST 5 (d): Failed, pending, or refunded first attempts do NOT burn eligibility
  {
    const db = new InMemoryFirestore();
    db.store.set('users/user_b', { coins: 0, name: 'Bob' });
    db.store.set('transactions/tx_fail_1', { userId: 'user_b', status: 'failed', type: 'coin_purchase', coinsAdded: 500 });
    db.store.set('transactions/tx_pend_2', { userId: 'user_b', status: 'pending', type: 'coin_purchase', coinsAdded: 500 });
    db.store.set('transactions/tx_ref_3', { userId: 'user_b', status: 'refunded', type: 'coin_purchase', coinsAdded: 500 });

    const res = await settleCoinPurchaseWithFirstTimeBonus(db as any, {
      gateway: 'paystack',
      providerTransactionId: 'ps_77701',
      reference: 'ps_ref_bob_1',
      userId: 'user_b',
      baseCoins: 1000,
      amountPaid: 10000,
      currency: 'NGN',
    });

    assert.equal(res.bonusCoins, 200, 'Failed/pending/refunded attempts must NOT burn first-time eligibility');
    assert.equal(res.totalCoinsCredited, 1200);
    assert.equal(db.store.get('users/user_b')!.coins, 1200);
    assert.equal(db.store.get('users/user_b')!.hasMadeFirstPurchase, true);
    console.log('PASS [5/6]: (d) Failed/pending/refunded first purchases preserve eligibility until settled');
    passed++;
  }

  // TEST 6 (Safe Fallback): Eligibility check failure defaults to bonus=0 and NEVER fails payment
  {
    const db = new InMemoryFirestore();
    db.store.set('users/user_c', { coins: 10, name: 'Cara' });
    db.failNextTransactionsQuery = true;

    const res = await settleCoinPurchaseWithFirstTimeBonus(db as any, {
      gateway: 'paystack',
      providerTransactionId: 'ps_88801',
      reference: 'ps_ref_cara_1',
      userId: 'user_c',
      baseCoins: 500,
      amountPaid: 5000,
      currency: 'NGN',
    });

    assert.equal(res.alreadyProcessed, false);
    assert.equal(res.eligibilityFallbackUsed, true);
    assert.equal(res.bonusCoins, 0, 'Must default to bonus=0 when eligibility check errors');
    assert.equal(res.totalCoinsCredited, 500, 'Base purchase must still complete cleanly');
    assert.equal(db.store.get('users/user_c')!.coins, 510);
    console.log('PASS [6/6]: Safe fallback defaults to bonus=0 on eligibility error without failing payment');
    passed++;
  }

  console.log(`\nALL ${passed}/6 FIRST-PURCHASE BONUS TESTS PASSED!`);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
