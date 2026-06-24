import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://impactful-ideas.web.app';

function getAdminDb() {
  if (!admin.apps.length) {
    try {
      const { getFirebaseAdminServiceAccount } = require('../../../../lib/parse-service-account');
      const sa = getFirebaseAdminServiceAccount();
      if (sa) {
        admin.initializeApp({ credential: admin.credential.cert(sa) });
      } else {
        admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    } catch (e) {
      console.error("Firebase Admin initialization error:", e);
    }
  }
  return admin.firestore();
}

/**
 * GET: Handles Client Web Browser Re-entry Point Following Financial Authorization
 * strictly handles verification and validation routines before building redirect signals.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/wallet?payment=failed&reason=no_reference`);
  }

  try {
    // 1. Asymmetric Cryptographic Sanity Verification Check
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { 
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.warn(`[Paystack Callback] Transaction validation failed for verification token: ${reference}`);
      return NextResponse.redirect(`${APP_URL}/wallet?payment=failed&reason=payment_not_successful`);
    }

    // Extract transaction properties from data payload signatures securely
    const { coinAmount } = verifyData.data.metadata || {};
    const amountNaira = verifyData.data.amount / 100;

    /**
     * 2. Idempotence Verification Loop
     * Instead of writing updates directly inside an unstable browser thread context, 
     * we query our system state. If the webhook has completed processing, we let the user know.
     * If the ledger record doesn't exist yet, we send them to a waiting screen that polls for updates.
     */
    const db = getAdminDb();
    const txDoc = await db.collection('transactions').doc(reference).get();

    if (txDoc.exists) {
      return NextResponse.redirect(
        `${APP_URL}/wallet?payment=success&coins=${coinAmount || txDoc.data()?.coinsAdded}&amount=${amountNaira}`
      );
    }

    // Direct to a polling layout page if the webhook hasn't updated the transaction table yet
    return NextResponse.redirect(
      `${APP_URL}/wallet?payment=processing&reference=${reference}&coins=${coinAmount || 0}`
    );

  } catch (error: any) {
    console.error('[Paystack Callback Engine Exception]:', error);
    return NextResponse.redirect(`${APP_URL}/wallet?payment=error&reason=processing_exception`);
  }
}