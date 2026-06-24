import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

function getAdminDb() {
  if (!admin.apps.length) {
    try {
      const { getFirebaseAdminServiceAccount } = require('../../../../lib/parse-service-account');
      const sa = getFirebaseAdminServiceAccount();
      if (sa) {
        admin.initializeApp({
          credential: admin.credential.cert(sa),
        });
      } else {
        admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
  return admin.firestore();
}

/**
 * Authenticates the requesting user via asymmetric token decryption 
 * and verifies their permission state inside the system admin registry.
 */
async function authenticateAdmin(req: NextRequest, db: FirebaseFirestore.Firestore): Promise<string | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const idToken = authHeader.split('Bearer ')[1];
    // Decrypt the ID token cryptographically via the core Firebase authentication engine
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const adminDoc = await db.collection('admins').doc(uid).get();
    return adminDoc.exists ? uid : null;
  } catch (err) {
    console.error('Admin bearer authorization token verification exception:', err);
    return null;
  }
}

/**
 * POST: Securely Processes Admin Payout Decisions (Approve / Reject)
 */
export async function POST(req: NextRequest) {
  try {
    const db = getAdminDb();

    // 1. Authenticate identity states via structural token lookup
    const verifiedAdminUid = await authenticateAdmin(req, db);
    if (!verifiedAdminUid) {
      return NextResponse.json({ error: 'Unauthorized access sequence. Cryptographic token mismatch.' }, { status: 403 });
    }

    const body = await req.json();
    const { payoutId, action, rejectReason } = body;

    if (!payoutId || !action) {
      return NextResponse.json({ error: 'Missing required tracking fields.' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action parameter value assignment.' }, { status: 400 });
    }

    const payoutRef = db.collection('payoutRequests').doc(payoutId);
    let userRef: FirebaseFirestore.DocumentReference;
    let payoutData: FirebaseFirestore.DocumentData;

    /**
     * 2. Phase 1 ACID Lock: Read and Update Ledger State Atomically
     * We transition document states into a locking 'processing' mode *inside a transaction* * to eliminate split-second click-spamming or duplicate request replay threats.
     */
    const executionStateCheck = await db.runTransaction(async (transaction) => {
      const payoutDoc = await transaction.get(payoutRef);
      if (!payoutDoc.exists) throw new Error('TARGET_NOT_FOUND');

      const data = payoutDoc.data()!;
      if (data.status !== 'pending_review') throw new Error(`ALREADY_PROCESSED_${data.status.toUpperCase()}`);

      payoutData = data;
      userRef = db.collection('users').doc(data.userId);

      if (action === 'reject') {
        // Run direct rollback right inside Phase 1 if processing a rejection request
        transaction.update(userRef, {
          earningsNaira: FieldValue.increment(data.amountNaira),
          heldEarningsNaira: FieldValue.increment(-data.amountNaira),
        });

        transaction.update(payoutRef, {
          status: 'rejected',
          rejectReason: rejectReason || 'Your payout request did not meet our requirements.',
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: verifiedAdminUid,
        });

        const notifRef = userRef.collection('notifications').doc();
        transaction.set(notifRef, {
          type: 'payout_rejected',
          amountNaira: data.amountNaira,
          reason: rejectReason || 'Your payout request did not meet our requirements.',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });

        return { completedLocally: true };
      }

      // If approving, provisionally transition status to 'processing' to lock out simultaneous requests
      transaction.update(payoutRef, { status: 'processing' });
      return { completedLocally: false };
    });

    if (executionStateCheck.completedLocally) {
      return NextResponse.json({ success: true, message: `Payout rejected. ₦${payoutData!.amountNaira.toLocaleString()} successfully returned to creator balances.` });
    }

    // 3. Out-Of-Transaction Phase: Dispatch Paystack Financial Clearing Order
    const recipientCode = payoutData!.recipientCode;
    if (!recipientCode) {
      await payoutRef.update({ status: 'pending_review' }); // Roll back lock state if information is missing
      return NextResponse.json({ error: 'Missing core Paystack recipient routing references.' }, { status: 400 });
    }

    const paystackReference = `lonkind_payout_${payoutId}_${Date.now()}`;

    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payoutData!.amountNaira * 100), // convert to structural integer kobo units
        recipient: recipientCode,
        reason: `Lonkind Creator Earnings Withdrawal Fulfillment`,
        currency: 'NGN',
        reference: paystackReference,
      }),
    });

    const transferData = await transferRes.json();

    /**
     * 4. Phase 2 ACID Lock: Handle Third-Party Settlement Result Safely
     * We wrap completion mappings inside a secondary deterministic transaction thread.
     */
    if (!transferData.status) {
      // Recovery Block: If Paystack flatly rejects the connection, reset lock back to 'pending_review'
      await payoutRef.update({ 
        status: 'pending_review',
        lastProcessingError: transferData.message || 'Paystack automated settlement engine error output.'
      });
      return NextResponse.json({ error: transferData.message || 'Paystack clearing house transaction denied.' }, { status: 400 });
    }

    await db.runTransaction(async (transaction) => {
      transaction.update(userRef, {
        heldEarningsNaira: FieldValue.increment(-payoutData!.amountNaira),
      });

      transaction.update(payoutRef, {
        status: 'completed',
        paystackTransferReference: transferData.data.reference || paystackReference,
        paystackStatus: transferData.data.status || 'success',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: verifiedAdminUid,
      });

      const notifRef = userRef.collection('notifications').doc();
      transaction.set(notifRef, {
        type: 'payout_approved',
        amountNaira: payoutData!.amountNaira,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({
      success: true,
      message: `✅ Payout of ₦${payoutData!.amountNaira.toLocaleString()} successfully approved; execution sequence initiated.`,
    });

  } catch (error: any) {
    console.error('Critical administrative payout override crash exception:', error);
    if (error.message === 'TARGET_NOT_FOUND') {
      return NextResponse.json({ error: 'Designated payout transaction document reference missing.' }, { status: 404 });
    }
    if (error.message.startsWith('ALREADY_PROCESSED')) {
      return NextResponse.json({ error: 'Collision abort. This asset block has already been modified by another ledger line.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'System processing failure exception encountered.' }, { status: 500 });
  }
}

/**
 * GET: Securely Fetches Pending Payout Batches
 */
export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();

    // Authenticate identity states securely via structural token inspection
    const verifiedAdminUid = await authenticateAdmin(req, db);
    if (!verifiedAdminUid) {
      return NextResponse.json({ error: 'Unauthorized request validation signature missing.' }, { status: 403 });
    }

    const snap = await db.collection('payoutRequests')
      .where('status', '==', 'pending_review')
      .orderBy('createdAt', 'asc')
      .limit(50)
      .get();

    const requests = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString() || null,
    }));

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal pipeline fetch error.' }, { status: 500 });
  }
}