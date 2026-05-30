import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// ─── Economy Constants ───────────────────────────────────────────
const NAIRA_PER_COIN = 20;     // ₦20 per coin (10 coins = ₦200 at test price)
const PLATFORM_FEE = 0;        // 0% — creator gets 100% of gift value

function getAdminDb() {
  if (!getApps().length) {
    try {
      const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
        : undefined;
      if (serviceAccount) {
        initializeApp({ credential: cert(serviceAccount) });
      } else {
        initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    } catch (e) {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

const InputSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  coinAmount: z.number().int().positive(),
  // diamondValue kept for backward compat but ignored now
  diamondValue: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { fromUserId, toUserId, coinAmount } = parsed.data;

    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'You cannot gift yourself.' }, { status: 400 });
    }

    // Calculate naira value — creator gets 100%
    const rawNairaValue = coinAmount * NAIRA_PER_COIN;
    const platformCut = Math.floor(rawNairaValue * PLATFORM_FEE);
    const creatorEarnings = rawNairaValue - platformCut; // ₦ added to creator's earnings

    const db = getAdminDb();
    const senderRef = db.collection('users').doc(fromUserId);
    const receiverRef = db.collection('users').doc(toUserId);

    await db.runTransaction(async (transaction) => {
      const [senderDoc, receiverDoc] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(receiverRef),
      ]);

      if (!senderDoc.exists) throw new Error('Sender account not found.');
      if (!receiverDoc.exists) throw new Error('Recipient account not found.');

      const senderCoins = senderDoc.data()?.coins || 0;
      if (senderCoins < coinAmount) {
        throw new Error(`Insufficient coins. You have ${senderCoins} coins but need ${coinAmount}.`);
      }

      // Record the gift with full audit trail
      const giftRef = db.collection('gifts').doc();
      transaction.set(giftRef, {
        fromUser: fromUserId,
        toUser: toUserId,
        coinAmount,
        nairaValue: rawNairaValue,
        platformCut,
        creatorEarnings,
        time: FieldValue.serverTimestamp(),
      });

      // Deduct coins from sender
      transaction.update(senderRef, {
        coins: FieldValue.increment(-coinAmount),
      });

      // Add real naira earnings to receiver (NOT diamonds — real money)
      transaction.update(receiverRef, {
        earningsNaira: FieldValue.increment(creatorEarnings),
      });

      // Notification for recipient with the naira amount
      const notifRef = db.collection('users').doc(toUserId).collection('notifications').doc();
      transaction.set(notifRef, {
        type: 'new_gift',
        fromUser: { uid: fromUserId },
        coinAmount,
        nairaEarned: creatorEarnings,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Gift sent! The creator earned ₦${creatorEarnings.toLocaleString()} in real earnings.`,
      creatorEarnings,
    });

  } catch (error: any) {
    console.error('Gift coins error:', error);
    return NextResponse.json({ error: error.message || 'Gifting failed.' }, { status: 500 });
  }
}
