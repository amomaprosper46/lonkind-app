import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { settleCoinPurchaseWithFirstTimeBonus } from '@/lib/first-purchase-bonus';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';

const CURRENCY_RATE_PER_COIN: Record<string, number> = {
  NGN: 10,
  USD: 0.01,
  GHS: 0.15,
  KES: 1.5,
  GBP: 0.008,
  EUR: 0.009,
  ZAR: 0.18,
};

export async function POST(req: NextRequest) {
  try {
    if (!FLW_SECRET_KEY || FLW_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Flutterwave not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { reference, transaction_id } = body;

    if (!reference && !transaction_id) {
      return NextResponse.json(
        { error: 'Missing payment reference or transaction_id' },
        { status: 400 }
      );
    }

    const verifyUrl = transaction_id
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transaction_id)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;

    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: verifyData.message || 'Transaction not successful',
        },
        { status: 400 }
      );
    }

    const txData = verifyData.data;
    const meta = txData.meta || {};
    let userId = meta.userId;
    let numCoins = Number(meta.coinAmount || meta.coins || 0);
    const amountPaid = Number(txData.amount || 0);
    const currency = (txData.currency || 'NGN').toUpperCase();
    const txRef = String(txData.tx_ref || reference || transaction_id);

    if (!userId || !numCoins) {
      const pendingSnap = await adminDb.collection('transactions').doc(txRef).get();
      if (pendingSnap.exists) {
        const p = pendingSnap.data() || {};
        if (!userId && p.userId) userId = p.userId;
        if (!numCoins && p.coinsAdded) numCoins = Number(p.coinsAdded);
      }
    }

    if (!userId || !numCoins || numCoins <= 0) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 });
    }

    const rate = CURRENCY_RATE_PER_COIN[currency] || CURRENCY_RATE_PER_COIN.NGN;
    const expectedMinAmount = Number((numCoins * rate * 0.55).toFixed(2));

    if (amountPaid + 0.01 < expectedMinAmount) {
      console.error(
        `[Flutterwave Verify] Price mismatch for user ${userId}. Paid ${currency} ${amountPaid}, expected minimum ${expectedMinAmount} for ${numCoins} coins.`
      );
      return NextResponse.json(
        { error: 'Payment amount does not match coins requested' },
        { status: 400 }
      );
    }

    const txResult = await settleCoinPurchaseWithFirstTimeBonus(adminDb, {
      gateway: 'flutterwave',
      providerTransactionId: String(txData.id || transaction_id || txRef),
      reference: txRef,
      userId,
      baseCoins: numCoins,
      amountPaid,
      currency: currency || 'NGN',
      purpose: meta.purpose || 'coin_purchase',
      source: 'flutterwave_verify',
    });

    if (txResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        alreadyProcessed: true,
        coinsAdded: txResult.totalCoinsCredited,
        baseCoins: txResult.baseCoins,
        bonusCoins: txResult.bonusCoins,
      });
    }

    return NextResponse.json({
      success: true,
      journalId: txResult.journalId,
      message:
        txResult.bonusCoins > 0
          ? `Successfully credited ${txResult.baseCoins.toLocaleString()} coins + ${txResult.bonusCoins.toLocaleString()} First-Time Bonus coins!`
          : `Successfully credited ${txResult.totalCoinsCredited.toLocaleString()} coins to your account!`,
      coinsAdded: txResult.totalCoinsCredited,
      baseCoins: txResult.baseCoins,
      bonusCoins: txResult.bonusCoins,
    });
  } catch (error: any) {
    console.error('Flutterwave verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
