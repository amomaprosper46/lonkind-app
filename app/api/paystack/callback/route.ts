import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────────
//  PAYSTACK CALLBACK (Browser Redirect)
//  URL to set on Paystack dashboard as callback_url:
//  https://impactful-ideas.web.app/api/paystack/callback
//
//  HOW IT WORKS:
//  After payment, Paystack redirects the user's BROWSER here.
//  We verify the payment AND redirect the user to the app.
//
//  NOTE: The webhook ALREADY handled the coin crediting.
//  This callback is just for the user experience (showing success page).
//  We verify here too as a backup in case webhook was delayed.
// ─────────────────────────────────────────────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

function getAdminDb() {
  if (!getApps().length) {
    try {
      const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
        : undefined;
      if (sa) {
        initializeApp({ credential: cert(sa) });
      } else {
        initializeApp();
      }
    } catch (e) {
      console.error("Firebase Admin initialization error:", e);
      if (!getApps().length) initializeApp();
    }
  }
  return getFirestore();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/?payment=failed&reason=no_reference`);
  }

  try {
    // Always verify with Paystack — never trust just a reference in URL
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.warn(`[Callback] Payment not successful for ref ${reference}:`, verifyData.data?.status);
      return NextResponse.redirect(`${APP_URL}/?payment=failed&reason=payment_not_successful`);
    }

    const { userId, coinAmount } = verifyData.data.metadata || {};
    const amountNaira = verifyData.data.amount / 100;

    // Backup crediting in case webhook was delayed
    // The idempotency check ensures coins are only credited ONCE even if
    // both webhook and callback try to credit at the same time
    if (userId && coinAmount) {
      const db = getAdminDb();
      const txRef = db.collection('transactions').doc(reference);
      const existing = await txRef.get();

      if (!existing.exists) {
        // Webhook hasn't fired yet — credit now as backup
        console.log(`[Callback] Webhook not yet received for ${reference} — crediting as backup`);
        await db.runTransaction(async (transaction) => {
          const stillMissing = await transaction.get(txRef);
          if (stillMissing.exists) return; // Webhook arrived in the meantime

          transaction.set(txRef, {
            userId,
            paystackReference: reference,
            amountNaira,
            coinsAdded: Number(coinAmount),
            status: 'success',
            type: 'coin_purchase',
            source: 'callback_backup', // Webhook was delayed
            time: FieldValue.serverTimestamp(),
          });

          const userRef = db.collection('users').doc(userId);
          transaction.update(userRef, {
            coins: FieldValue.increment(Number(coinAmount)),
          });
        });
      } else {
        console.log(`[Callback] Transaction ${reference} already credited by webhook ✅`);
      }
    }

    // Redirect user to the app with success message
    return NextResponse.redirect(
      `${APP_URL}/?payment=success&coins=${coinAmount}&amount=${amountNaira}`
    );

  } catch (error: any) {
    console.error('[Callback] Error:', error);
    return NextResponse.redirect(`${APP_URL}/?payment=error&reason=server_error`);
  }
}
