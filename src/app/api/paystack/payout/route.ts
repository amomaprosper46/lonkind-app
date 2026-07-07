import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb as db } from '@/lib/firebase-admin';

// ─── Payout Policy Constants ─────────────────────────────────────
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

/**
 * Diamond Payout Value in Global Currencies
 * 1 Diamond = ₦15 NGN | $0.015 USD | 0.22 GHS | 2.25 KES | £0.012 GBP | €0.014 EUR | 0.27 ZAR
 */
const DIAMOND_PAYOUT_RATE: Record<string, number> = {
  'NGN': 15,
  'USD': 0.015,
  'GHS': 0.22,
  'KES': 2.25,
  'GBP': 0.012,
  'EUR': 0.014,
  'ZAR': 0.27,
};

const COUNTRY_MAP: Record<string, string> = {
  'NG': 'nigeria',
  'GH': 'ghana',
  'KE': 'kenya',
  'ZA': 'south africa',
  'US': 'united states',
  'GB': 'united kingdom',
};

// ─── POST: Request Payout ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured.' }, { status: 503 });
    }

    const body = await req.json();
    const { userId, diamondAmount, amountNaira, bankCode, accountNumber, accountName, currency = 'NGN' } = body;
    const cleanCurrency = currency.toUpperCase();
    const rate = DIAMOND_PAYOUT_RATE[cleanCurrency] || DIAMOND_PAYOUT_RATE['NGN'];

    if (!userId || (!diamondAmount && !amountNaira) || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required payout fields.' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const currentDiamonds = userData.diamonds || 0;
    const requiredDiamonds = diamondAmount || Math.ceil(amountNaira / rate);
    const amountPaid = requiredDiamonds * rate;

    if (currentDiamonds < requiredDiamonds) {
      return NextResponse.json({
        error: `Insufficient diamonds balance. You have ${currentDiamonds.toLocaleString()} diamonds but requested ${requiredDiamonds.toLocaleString()} diamonds.`,
      }, { status: 400 });
    }

    // ── Rate limit: max 1 successful/processing payout request per 24 hours (ignore failed transfers) ──
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequests = await db.collection('payoutRequests')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(oneDayAgo))
      .get();

    const activeRequests = recentRequests.docs.filter(doc => {
      const st = (doc.data().status || '').toLowerCase();
      return st !== 'failed' && st !== 'error' && st !== 'rejected' && st !== 'cancelled';
    });

    if (activeRequests.length > 0) {
      return NextResponse.json({
        error: 'You can only request one successful payout per 24 hours. Please try again tomorrow.',
      }, { status: 429 });
    }

    const reference = `payout_${userId}_${Date.now()}`;

    // Pre-save payout request immediately so the reference is permanently recorded in Firestore history
    try {
      await db.collection('payoutRequests').doc(reference).set({
        id: reference,
        userId,
        amount: amountPaid,
        currency: cleanCurrency,
        diamondAmount: requiredDiamonds,
        bankCode,
        accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'),
        accountName,
        reference,
        status: 'initiated',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.error('Failed to pre-save payout request reference:', dbErr);
    }

    try {
      // 1. Create Transfer Recipient
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              type: cleanCurrency === 'NGN' ? "nuban" : "basa",
              name: accountName,
              account_number: accountNumber,
              bank_code: bankCode,
              currency: cleanCurrency
          })
      });
      
      const recipientData = await recipientRes.json();
      if (!recipientData.status) {
          const err: any = new Error(recipientData.message || "Failed to create transfer recipient");
          err.rawPaystackResponse = recipientData;
          throw err;
      }

      const recipientCode = recipientData.data.recipient_code;

      // 2. Initiate Transfer
      const transferRes = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              source: "balance",
              amount: Math.round(amountPaid * 100), // sub-units
              reference: reference,
              recipient: recipientCode,
              reason: "Lonkind Creator Payout"
          })
      });

      const transferData = await transferRes.json();
      if (!transferData.status) {
          const err: any = new Error(transferData.message || "Failed to initiate transfer");
          err.rawPaystackResponse = transferData;
          throw err;
      }

      // Record the successful (processing) transaction
      await db.collection('payoutRequests').doc(reference).set({
        id: reference,
        userId,
        amount: amountPaid,
        currency: cleanCurrency,
        diamondAmount: requiredDiamonds,
        bankCode,
        accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'), // mask
        accountName,
        reference,
        paystackTransferCode: transferData.data.transfer_code,
        status: transferData.data.status || 'processing',
        rawPaystackResponse: transferData,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Deduct diamonds from user's balance permanently only upon successful initiation
      await userRef.update({
        diamonds: FieldValue.increment(-requiredDiamonds)
      });

      return NextResponse.json({
        success: true,
        status: transferData.data.status,
        message: `Your payout of ${cleanCurrency} ${amountPaid.toLocaleString()} is being processed via Paystack!`,
      });

    } catch (payoutError: any) {
      console.error('[Paystack Transfer Execution Error]:', payoutError, payoutError.rawPaystackResponse);
      
      // Store failed payout attempt in Firebase database so admin and user can inspect exact error
      try {
        await db.collection('payoutRequests').doc(reference).set({
          id: reference,
          userId,
          amount: amountPaid,
          currency: cleanCurrency,
          diamondAmount: requiredDiamonds,
          bankCode,
          accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'),
          accountName,
          reference,
          status: 'failed',
          errorReason: payoutError.message || 'Unknown transfer failure',
          rawPaystackResponse: payoutError.rawPaystackResponse || null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (dbErr) {
        console.error('Failed to log payout error to Firestore:', dbErr);
      }

      // Notice: diamonds are NOT deducted if payout throws an error, so user balance is safely preserved!
      return NextResponse.json({ 
        error: `Paystack Error: ${payoutError.message || 'Transfer failed.'}`,
        rawResponse: payoutError.rawPaystackResponse || null
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Payout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// ─── GET: Fetch banks list for selected country ──────────────────
export async function GET(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxxxxxx')) {
      return NextResponse.json({ error: 'Paystack not configured.' }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const countryCode = (searchParams.get('country') || 'NG').toUpperCase();
    const paystackCountryName = COUNTRY_MAP[countryCode] || 'nigeria';

    const res = await fetch(`https://api.paystack.co/bank?country=${encodeURIComponent(paystackCountryName)}&perPage=100`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();
    if (!data.status) return NextResponse.json({ error: 'Could not fetch banks.' }, { status: 400 });
    return NextResponse.json({ banks: data.data, country: countryCode });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
