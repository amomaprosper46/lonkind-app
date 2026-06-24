'use server';
/**
 * @fileOverview Secure transactional tipping microservice engine.
 * Eradicates client-side fallback holes and secures real-time wallet mutations 
 * using absolute server-side database administration locks.
 */

import { z } from 'genkit';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Centered Firebase Admin Initialization Routing Layer
 * Safely handles environment differences between Vercel and Firebase Hosting containers.
 */
function getSecureAdminDb() {
  if (!getApps().length) {
    try {
      const { getFirebaseAdminServiceAccount } = require('../../lib/parse-service-account');
      const sa = getFirebaseAdminServiceAccount();

      if (sa) {
        initializeApp({ credential: cert(sa) });
      } else {
        // Natively binds internal service accounts inside cloud environments
        initializeApp();
      }
    } catch (e) {
      console.error("Critical Admin initialization vector failure:", e);
      throw new Error("Financial core system initialization failed.");
    }
  }
  return getFirestore();
}

const COIN_TO_DIAMOND_CONVERSION_RATE = 1;

const SendTipInputSchema = z.object({
  fromUserId: z.string().describe('The validated UID of the tipping sender.'),
  toUserId: z.string().describe('The validated UID of the creator receiving the asset payload.'),
  coinAmount: z.number().int().positive().describe('Total integer unit coins dedicated for distribution.'),
  giftName: z.string().describe('The label designation matching the animated asset.'),
  giftEmoji: z.string().describe('The visual emoji tracking marker.'),
  spaceId: z.string().optional().describe('Target active live audio chamber identifier.'),
});
export type SendTipInput = z.infer<typeof SendTipInputSchema>;

const SendTipOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendTipOutput = z.infer<typeof SendTipOutputSchema>;

/**
 * Core Financial Asset Tipping Router
 * Exclusively processed through atomic server transactions. No client-side bypass channels allowed.
 */
export async function sendTip(input: SendTipInput): Promise<SendTipOutput> {
  const { fromUserId, toUserId, coinAmount, giftName, giftEmoji, spaceId } = input;

  // Anti-Fraud Guard: Eradicate cyclic transaction loops
  if (fromUserId === toUserId) {
    return { success: false, message: "Transaction aborted. You cannot tip your own profile." };
  }

  try {
    const adminDb = getSecureAdminDb();

    // Execute atomic wallet adjustments safely away from public exposure vectors
    await adminDb.runTransaction(async (transaction) => {
      const senderRef = adminDb.collection('users').doc(fromUserId);
      const receiverRef = adminDb.collection('users').doc(toUserId);

      // A. Verify sender solvency states
      const senderDoc = await transaction.get(senderRef);
      if (!senderDoc.exists || (senderDoc.data()?.coins || 0) < coinAmount) {
        throw new Error('Insufficient coins available to authorized transaction request.');
      }
      
      const receiverDoc = await transaction.get(receiverRef);
      if (!receiverDoc.exists) {
        throw new Error('The designated recipient account details could not be matched.');
      }

      const diamondValue = Math.floor(coinAmount * COIN_TO_DIAMOND_CONVERSION_RATE);

      // B. Structure immutable audit trails inside your data collections
      const giftRef = adminDb.collection('gifts').doc();
      transaction.set(giftRef, {
        fromUserId,
        fromUserName: senderDoc.data()?.name || 'Anonymous Creator',
        toUserId,
        toUserName: receiverDoc.data()?.name || 'Anonymous Creator',
        coins: coinAmount,
        diamonds: diamondValue,
        giftName,
        giftEmoji,
        time: FieldValue.serverTimestamp(),
      });

      // C. Process balance modifications simultaneously
      transaction.update(senderRef, { 
        coins: FieldValue.increment(-coinAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      transaction.update(receiverRef, { 
        diamonds: FieldValue.increment(diamondValue),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // D. Broadcast structural payload alerts if operating within a live Audio Space
      if (spaceId) {
        const spaceRef = adminDb.collection('spaces').doc(spaceId);
        const spaceDoc = await transaction.get(spaceRef);
        
        if (spaceDoc.exists) {
          const newGiftPayload = {
            senderName: senderDoc.data()?.name || 'Someone',
            giftName,
            giftEmoji,
            timestamp: Date.now(),
            id: Math.random().toString(36).substring(2, 9),
          };
          
          const currentGifts = spaceDoc.data()?.recentGifts || [];
          const updatedGifts = [...currentGifts, newGiftPayload].slice(-10);
          
          transaction.update(spaceRef, { recentGifts: updatedGifts });
        }
      }
    });

    return {
      success: true,
      message: `Successfully sent ${coinAmount} coins to the creator!`,
    };

  } catch (error: any) {
    console.error('System validation interrupted tipping pipeline:', error);
    return {
      success: false,
      message: error.message || 'An engineering system lock disrupted checkout procedures.',
    };
  }
}