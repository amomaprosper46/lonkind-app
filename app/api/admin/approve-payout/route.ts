import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

import * as admin from 'firebase-admin';

function getAdminDb() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
        const sa = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(sa) });
      } else {
        admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
  return admin.firestore();
}

// Verify the requesting user is an admin
async function isAdmin(db: FirebaseFirestore.Firestore, adminUid: string): Promise<boolean> {
  const adminDoc = await db.collection('admins').doc(adminUid).get();
  return adminDoc.exists;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payoutId, action, adminUid, rejectReason } = body;

    if (!payoutId || !action || !adminUid) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "approve" or "reject".' }, { status: 400 });
    }

    const db = getAdminDb();

    // Verify admin
    const adminCheck = await isAdmin(db, adminUid);
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized — admin access required.' }, { status: 403 });
    }

    // Fetch the payout request
    const payoutRef = db.collection('payoutRequests').doc(payoutId);
    const payoutDoc = await payoutRef.get();

    if (!payoutDoc.exists) {
      return NextResponse.json({ error: 'Payout request not found.' }, { status: 404 });
    }

    const payout = payoutDoc.data()!;

    if (payout.status !== 'pending_review') {
      return NextResponse.json({ error: `This payout is already ${payout.status}.` }, { status: 400 });
    }

    const userRef = db.collection('users').doc(payout.userId);

    // ── REJECT ──────────────────────────────────────────────────
    if (action === 'reject') {
      await db.runTransaction(async (transaction) => {
        // Refund held earnings back to user
        transaction.update(userRef, {
          earningsNaira: FieldValue.increment(payout.amountNaira),
          heldEarningsNaira: FieldValue.increment(-payout.amountNaira),
        });

        // Update payout request status
        transaction.update(payoutRef, {
          status: 'rejected',
          rejectReason: rejectReason || 'Your payout request did not meet our requirements.',
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: adminUid,
        });

        // Notify user
        const notifRef = db.collection('users').doc(payout.userId).collection('notifications').doc();
        transaction.set(notifRef, {
          type: 'payout_rejected',
          amountNaira: payout.amountNaira,
          reason: rejectReason || 'Your payout request did not meet our requirements.',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
      });

      return NextResponse.json({ success: true, message: `Payout rejected. ₦${payout.amountNaira.toLocaleString()} refunded to user's earnings.` });
    }

    // ── APPROVE ──────────────────────────────────────────────────
    // Need the real bank details — fetch from the payout doc
    // Note: account number is masked in the payout doc for security
    // For admin approval we need the original unmasked number
    // We'll call Paystack with the info we have (recipient needs to be re-created with the full account number)
    // The admin approval flow re-prompts for full account details OR we store encrypted
    // For now we create a new recipient using the bank code and stored account name
    // In production you'd store the recipient_code from the original request

    const recipientCode = payout.recipientCode;

    if (!recipientCode) {
      return NextResponse.json({
        error: 'No recipient code found. The user must re-submit the payout request with their bank details.',
      }, { status: 400 });
    }

    // Initiate the Paystack transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: payout.amountNaira * 100, // kobo
        recipient: recipientCode,
        reason: `Lonkind approved earnings payout — reviewed by admin`,
        currency: 'NGN',
        reference: `admin_approved_${payoutId}_${Date.now()}`,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      return NextResponse.json({
        error: transferData.message || 'Paystack transfer failed. Check your Paystack balance.',
      }, { status: 400 });
    }

    // Update payout and deduct held earnings
    await db.runTransaction(async (transaction) => {
      transaction.update(userRef, {
        heldEarningsNaira: FieldValue.increment(-payout.amountNaira),
      });

      transaction.update(payoutRef, {
        status: 'completed',
        paystackTransferReference: transferData.data.reference,
        paystackStatus: transferData.data.status,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: adminUid,
      });

      // Notify user
      const notifRef = db.collection('users').doc(payout.userId).collection('notifications').doc();
      transaction.set(notifRef, {
        type: 'payout_approved',
        amountNaira: payout.amountNaira,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({
      success: true,
      message: `✅ Payout of ₦${payout.amountNaira.toLocaleString()} approved and transfer initiated.`,
    });

  } catch (error: any) {
    console.error('Admin approve payout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// GET: Fetch all pending review payout requests
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminUid = searchParams.get('adminUid');

    if (!adminUid) {
      return NextResponse.json({ error: 'adminUid required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const adminCheck = await isAdmin(db, adminUid);
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
