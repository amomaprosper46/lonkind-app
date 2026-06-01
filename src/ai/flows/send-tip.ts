'use server';
/**
 * @fileOverview A Genkit flow for sending a tip from one user to another.
 *
 * - sendTip - A function that transfers value from a sender's coin balance to a receiver's diamond balance.
 * - SendTipInput - The input type for the function.
 * - SendTipOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { runTransaction, doc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

export async function sendTip(input: SendTipInput): Promise<SendTipOutput> {
  return sendTipFlow(input);
}

const sendTipFlow = ai.defineFlow(
  {
    name: 'sendTipFlow',
    inputSchema: SendTipInputSchema,
    outputSchema: SendTipOutputSchema,
  },
  async ({ fromUserId, toUserId, coinAmount, giftName, giftEmoji, spaceId }) => {
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', fromUserId);
        const receiverRef = doc(db, 'users', toUserId);

        // 1. Verify sender has enough coins.
        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists() || (senderDoc.data().coins || 0) < coinAmount) {
          throw new Error('Insufficient coins or sender not found.');
        }
        
        const receiverDoc = await transaction.get(receiverRef);
        if (!receiverDoc.exists()) {
            throw new Error('Receiver not found.');
        }

        const diamondValue = Math.floor(coinAmount * COIN_TO_DIAMOND_CONVERSION_RATE);

        // 2. Create a record in the 'gifts' collection for auditing.
        // This collection will now be used for "earnings" history.
        const giftRef = doc(collection(db, 'gifts'));
        transaction.set(giftRef, {
            fromUserId: fromUserId,
            fromUserName: senderDoc.data().name,
            toUserId: toUserId,
            toUserName: receiverDoc.data().name,
            coins: coinAmount,
            diamonds: diamondValue,
            giftName: giftName,
            giftEmoji: giftEmoji,
            time: serverTimestamp(),
        });

        // 3. Atomically deduct coins from sender.
        transaction.update(senderRef, { coins: increment(-coinAmount) });

        // 4. Atomically add diamonds to receiver.
        transaction.update(receiverRef, { diamonds: increment(diamondValue) });

        // 5. If tipping in a space, add to recentGifts for animation overlay
        if (spaceId) {
            const spaceRef = doc(db, 'spaces', spaceId);
            const spaceDoc = await transaction.get(spaceRef);
            if (spaceDoc.exists()) {
                const newGift = {
                    senderName: senderDoc.data().name || 'Someone',
                    giftName,
                    giftEmoji,
                    timestamp: new Date().getTime(),
                    id: Math.random().toString(36).substring(7),
                };
                
                // Keep only the last 10 gifts to avoid unbounded array growth
                const currentGifts = spaceDoc.data().recentGifts || [];
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
);
