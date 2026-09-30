import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb as db, adminAuth } from '@/lib/firebase-admin';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY!;

/**
 * Authenticates the requesting user via token and verifies admin registry.
 */
async function authenticateAdmin(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const adminDoc = await db.collection('admins').doc(uid).get();
    return adminDoc.exists ? uid : null;
  } catch (err) {
    console.error('Admin token verification error:', err);
    return null;
  }
}

/**
 * Execute a Paystack transfer for a payout request.
 * Uses the stored rawAccountNumber internally.
 */
async function executePaystackTransfer(payoutData: any, reference: string): Promise<{ success: boolean; transferCode?: string; error?: string }> {
  try {
    // 1. Create recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: payoutData.currency === 'NGN' ? 'nuban' : 'basa',
        name: payoutData.accountName,
        account_number: payoutData.rawAccountNumber || payoutData.accountNumber,
        bank_code: payoutData.bankCode,
        currency: payoutData.currency || 'NGN',
      }),
    });
    const recipientData = await recipientRes.json();
    if (!recipientData.status) throw new Error(recipientData.message || 'Failed to create transfer recipient');
    const recipientCode = recipientData.data.recipient_code;

    // 2. Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payoutData.amount * 100),
        reference: `${reference}_exec`,
        recipient: recipientCode,
        reason: 'Lonkind Creator Payout',
      }),
    });
    const transferData = await transferRes.json();
    if (!transferData.status) throw new Error(transferData.message || 'Transfer initiation failed');
    return { success: true, transferCode: transferData.data.transfer_code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Execute a Flutterwave transfer for a payout request.
 */
async function executeFlutterwaveTransfer(payoutData: any, reference: string): Promise<{ success: boolean; transferId?: number; error?: string }> {
  try {
    const transferRes = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_bank: payoutData.bankCode,
        account_number: payoutData.rawAccountNumber || payoutData.accountNumber,
        amount: payoutData.amount,
        narration: 'Lonkind Creator Payout',
        currency: payoutData.currency || 'NGN',
        reference: `${reference}_exec`,
        beneficiary_name: payoutData.accountName,
      }),
    });
    const transferData = await transferRes.json();
    if (transferData.status !== 'success' || !transferData.data) {
      throw new Error(transferData.message || 'Flutterwave transfer failed');
    }
    return { success: true, transferId: transferData.data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * POST: Securely Processes Admin Payout Decisions (Approve / Reject)
 * Also processes any pending_review payouts older than 26 hours automatically.
 */
export async function POST(req: NextRequest) {
  try {
    const verifiedAdminUid = await authenticateAdmin(req);
    if (!verifiedAdminUid) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { payoutId, action, rejectReason } = body;

    if (!payoutId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request parameters.' }, { status: 400 });
    }

    const payoutRef = db.collection('payoutRequests').doc(payoutId);
    const payoutDoc = await payoutRef.get();
    if (!payoutDoc.exists) {
      return NextResponse.json({ error: 'Payout request not found.' }, { status: 404 });
    }

    const payoutData = payoutDoc.data()!;
    if (payoutData.status !== 'pending_review') {
      return NextResponse.json({ error: `Cannot process. Current status: ${payoutData.status}` }, { status: 400 });
    }

    const userRef = db.collection('users').doc(payoutData.userId);

    if (action === 'reject') {
      // Refund the diamonds back
      await db.runTransaction(async (tx) => {
        const freshUserSnap = await tx.get(userRef);
        const currentDiamonds = freshUserSnap.data()?.diamonds || 0;

        tx.update(userRef, { diamonds: FieldValue.increment(payoutData.diamondAmount) });
        tx.update(payoutRef, {
          status: 'rejected',
          rejectReason: rejectReason || 'Your payout request did not meet our requirements.',
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: verifiedAdminUid,
        });
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
          type: 'payout_rejected',
          amount: payoutData.amount,
          currency: payoutData.currency || 'NGN',
          reason: rejectReason || 'Your payout request did not meet our requirements.',
          timestamp: FieldValue.serverTimestamp(),
          read: false,
        });
        // Audit log — diamond refund
        const auditRef = db.collection('wallet_audit_logs').doc();
        tx.set(auditRef, {
          userId: payoutData.userId,
          type: 'payout_refund',
          delta: payoutData.diamondAmount,
          balanceBefore: currentDiamonds,
          balanceAfter: currentDiamonds + payoutData.diamondAmount,
          currency: 'diamonds',
          reference: payoutId,
          gatewayRef: null,
          payoutMethod: payoutData.payoutMethod || 'paystack',
          timestamp: FieldValue.serverTimestamp(),
          ip: `admin:${verifiedAdminUid}`,
        });
      });
      return NextResponse.json({ success: true, message: `Payout rejected. ${payoutData.diamondAmount} diamonds returned to creator.` });
    }

    // APPROVE: Execute the actual transfer
    await payoutRef.update({ status: 'processing' });

    const method = payoutData.payoutMethod || 'paystack';
    let result: { success: boolean; error?: string };

    if (method === 'flutterwave') {
      result = await executeFlutterwaveTransfer(payoutData, payoutId);
    } else {
      result = await executePaystackTransfer(payoutData, payoutId);
    }

    if (!result.success) {
      await payoutRef.update({ status: 'pending_review', lastError: result.error });
      return NextResponse.json({ error: `Transfer failed: ${result.error}` }, { status: 400 });
    }

    await db.runTransaction(async (tx) => {
      tx.update(payoutRef, {
        status: 'completed',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: verifiedAdminUid,
        ...(result as any).transferCode && { paystackTransferCode: (result as any).transferCode },
        ...(result as any).transferId && { flutterwaveTransferId: (result as any).transferId },
      });
      const notifRef = userRef.collection('notifications').doc();
      tx.set(notifRef, {
        type: 'payout_approved',
        amount: payoutData.amount,
        currency: payoutData.currency || 'NGN',
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
      // Audit log — payout approved and dispatched
      const auditRef = db.collection('wallet_audit_logs').doc();
      tx.set(auditRef, {
        userId: payoutData.userId,
        type: 'payout_approved',
        delta: 0, // diamonds were already deducted at request time
        currency: 'diamonds',
        reference: payoutId,
        gatewayRef: (result as any).transferCode || String((result as any).transferId || ''),
        payoutMethod: method,
        timestamp: FieldValue.serverTimestamp(),
        ip: `admin:${verifiedAdminUid}`,
      });
    });

    return NextResponse.json({
      success: true,
      message: `✅ Payout of ${payoutData.currency} ${payoutData.amount.toLocaleString()} approved and dispatched.`,
    });

  } catch (error: any) {
    console.error('Admin payout processing error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

/**
 * GET: Fetch Pending Payout Requests + Auto-Execute those older than 26 hours.
 * 
 * This runs every time the admin opens the payout dashboard. Any request that has
 * been pending for more than 26 hours is automatically dispatched to Paystack/Flutterwave.
 * This entire process is invisible to the end user.
 */
export async function GET(req: NextRequest) {
  try {
    const verifiedAdminUid = await authenticateAdmin(req);
    if (!verifiedAdminUid) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const snap = await db.collection('payoutRequests')
      .where('status', '==', 'pending_review')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    const now = Date.now();
    const TWENTY_SIX_HOURS_MS = 26 * 60 * 60 * 1000;
    const autoExecuted: string[] = [];

    // Auto-execute any requests older than 26 hours in the background
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate?.()?.getTime?.() || 0;
      if (createdAt > 0 && (now - createdAt) >= TWENTY_SIX_HOURS_MS) {
        try {
          await docSnap.ref.update({ status: 'processing' });
          const method = data.payoutMethod || 'paystack';
          let result: { success: boolean; error?: string };

          if (method === 'flutterwave') {
            result = await executeFlutterwaveTransfer(data, docSnap.id);
          } else {
            result = await executePaystackTransfer(data, docSnap.id);
          }

          if (result.success) {
            await docSnap.ref.update({
              status: 'completed',
              autoExecutedAt: FieldValue.serverTimestamp(),
              ...(result as any).transferCode && { paystackTransferCode: (result as any).transferCode },
              ...(result as any).transferId && { flutterwaveTransferId: (result as any).transferId },
            });
            // Send notification to creator
            const notifRef = db.collection('users').doc(data.userId).collection('notifications').doc();
            await notifRef.set({
              type: 'payout_approved',
              amount: data.amount,
              currency: data.currency || 'NGN',
              timestamp: FieldValue.serverTimestamp(),
              read: false,
            });
            autoExecuted.push(docSnap.id);
          } else {
            await docSnap.ref.update({ status: 'pending_review', lastError: result.error });
          }
        } catch (autoErr: any) {
          console.error(`Auto-execute failed for payout ${docSnap.id}:`, autoErr);
          await docSnap.ref.update({ status: 'pending_review', lastError: autoErr.message }).catch(() => {});
        }
      }
    }

    // Return remaining pending requests (excluding those just auto-executed)
    const requests = snap.docs
      .filter(d => !autoExecuted.includes(d.id))
      .map(d => ({
        id: d.id,
        ...d.data(),
        // Strip rawAccountNumber from the response for security
        rawAccountNumber: undefined,
        createdAt: d.data().createdAt?.toDate?.().toISOString() || null,
      }));

    return NextResponse.json({ requests, autoExecuted: autoExecuted.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}