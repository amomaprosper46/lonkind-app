'use server';
/**
 * @fileOverview A Genkit flow for sending a tip from one user to another.
 *
 * - sendTip - A function that transfers value from a sender's coin balance to a receiver's diamond balance.
 * - SendTipInput - The input type for the function.
 * - SendTipOutput - The return type for the function.
 */

import { z } from 'zod';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { db as clientDb } from '@/lib/firebase';
import { runTransaction as clientRunTransaction, doc, increment, collection, serverTimestamp } from 'firebase/firestore';

function getAdminDb() {
  if (!getApps().length) {
    try {
      const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
        : undefined;
      if (sa) {
        initializeApp({ credential: cert(sa) });
      } else {
        return null; // Don't crash, fallback to client DB
      }
    } catch (e) {
      console.error("Firebase Admin initialization error:", e);
      return null;
    }
  }
  return getFirestore();
}

// The conversion rate from coins (spent) to diamonds (earned).
const COIN_TO_DIAMOND_CONVERSION_RATE = 1;

const SendTipInputSchema = z.object({
  fromUserId: z.string().describe('The UID of the user sending the tip.'),
  toUserId: z.string().describe('The UID of the user receiving the tip.'),
  coinAmount: z.number().int().positive().describe('The number of coins to tip.'),
  giftName: z.string().describe('The name of the gift being sent.'),
  giftEmoji: z.string().describe('The emoji representing the gift.'),
  spaceId: z.string().optional().describe('Optional space ID if tipping in a live space.'),
});
export type SendTipInput = z.infer<typeof SendTipInputSchema>;

const SendTipOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendTipOutput = z.infer<typeof SendTipOutputSchema>;

export async function sendTip({ fromUserId, toUserId, coinAmount, giftName, giftEmoji, spaceId }: SendTipInput): Promise<SendTipOutput> {
    try {
      const adminDb = getAdminDb();
      
      // If we don't have Admin SDK configured properly, fallback to the Client SDK!
      // (This guarantees it works even if FIREBASE_ADMIN_SERVICE_ACCOUNT is missing in Vercel)
      if (!adminDb) {
          console.log("Using Firebase Client SDK fallback for gifting transaction...");
          if (!clientDb) {
              return { success: false, message: 'CRITICAL ERROR: Both Firebase Admin and Client SDKs failed to initialize on the server. Please check your Vercel Environment Variables.' };
          }
          await clientRunTransaction(clientDb, async (transaction) => {
            const senderRef = doc(clientDb, 'users', fromUserId);
            const receiverRef = doc(clientDb, 'users', toUserId);
    
            const senderDoc = await transaction.get(senderRef);
            if (!senderDoc.exists() || (senderDoc.data()?.coins || 0) < coinAmount) {
              throw new Error('Insufficient coins or sender not found.');
            }
            
            const receiverDoc = await transaction.get(receiverRef);
            if (!receiverDoc.exists()) {
                throw new Error('Receiver not found.');
            }
    
            const diamondValue = Math.floor(coinAmount * COIN_TO_DIAMOND_CONVERSION_RATE);
            const giftRef = doc(collection(clientDb, 'gifts'));
            transaction.set(giftRef, {
                fromUserId: fromUserId,
                fromUserName: senderDoc.data()?.name || 'Unknown User',
                toUserId: toUserId,
                toUserName: receiverDoc.data()?.name || 'Unknown User',
                coins: coinAmount,
                diamonds: diamondValue,
                giftName: giftName,
                giftEmoji: giftEmoji,
                time: serverTimestamp(),
            });
    
            transaction.update(senderRef, { coins: increment(-coinAmount) });
            transaction.update(receiverRef, { diamonds: increment(diamondValue) });
    
            if (spaceId) {
                const spaceRef = doc(clientDb, 'spaces', spaceId);
                const spaceDoc = await transaction.get(spaceRef);
                if (spaceDoc.exists()) {
                    const newGift = {
                        senderName: senderDoc.data()?.name || 'Someone',
                        giftName,
                        giftEmoji,
                        timestamp: new Date().getTime(),
                        id: Math.random().toString(36).substring(7),
                    };
                    const currentGifts = spaceDoc.data()?.recentGifts || [];
                    const updatedGifts = [...currentGifts, newGift].slice(-10);
                    transaction.update(spaceRef, { recentGifts: updatedGifts });
                }
            }
          });
          
          return { success: true, message: `Successfully sent a tip of ${coinAmount} coins!` };
      }

      // If we do have Admin SDK, use it!
      await adminDb.runTransaction(async (transaction) => {
        const senderRef = adminDb.collection('users').doc(fromUserId);
        const receiverRef = adminDb.collection('users').doc(toUserId);

        // 1. Verify sender has enough coins.
        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists || (senderDoc.data()?.coins || 0) < coinAmount) {
          throw new Error('Insufficient coins or sender not found.');
        }
        
        const receiverDoc = await transaction.get(receiverRef);
        if (!receiverDoc.exists) {
            throw new Error('Receiver not found.');
        }

        const diamondValue = Math.floor(coinAmount * COIN_TO_DIAMOND_CONVERSION_RATE);

        // 2. Create a record in the 'gifts' collection for auditing.
        const giftRef = adminDb.collection('gifts').doc();
        transaction.set(giftRef, {
            fromUserId: fromUserId,
            fromUserName: senderDoc.data()?.name || 'Unknown User',
            toUserId: toUserId,
            toUserName: receiverDoc.data()?.name || 'Unknown User',
            coins: coinAmount,
            diamonds: diamondValue,
            giftName: giftName,
            giftEmoji: giftEmoji,
            time: FieldValue.serverTimestamp(),
        });

        // 3. Atomically deduct coins from sender.
        transaction.update(senderRef, { coins: FieldValue.increment(-coinAmount) });

        // 4. Atomically add diamonds to receiver.
        transaction.update(receiverRef, { diamonds: FieldValue.increment(diamondValue) });

        // 5. If tipping in a space, add to recentGifts for animation overlay
        if (spaceId) {
            const spaceRef = adminDb.collection('spaces').doc(spaceId);
            const spaceDoc = await transaction.get(spaceRef);
            if (spaceDoc.exists) {
                const newGift = {
                    senderName: senderDoc.data()?.name || 'Someone',
                    giftName,
                    giftEmoji,
                    timestamp: new Date().getTime(),
                    id: Math.random().toString(36).substring(7),
                };
                
                // Keep only the last 10 gifts to avoid unbounded array growth
                const currentGifts = spaceDoc.data()?.recentGifts || [];
                const updatedGifts = [...currentGifts, newGift].slice(-10);
                
                transaction.update(spaceRef, { recentGifts: updatedGifts });
            }
        }
      });

      return {
        success: true,
        message: `Successfully sent a tip of ${coinAmount} coins!`,
      };
    } catch (error: any) {
      console.error('Tipping transaction failed:', error);
      return {
        success: false,
        message: error.message || 'An error occurred during the transaction.',
      };
    }
}
