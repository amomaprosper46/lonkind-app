
'use server';
/**
 * @fileOverview A Genkit flow for gifting coins from one user to another.
 *
 * - giftCoins - A function that transfers value from a sender's coin balance to a receiver's diamond balance.
 * - GiftCoinsInput - The input type for the function.
 * - GiftCoinsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { runTransaction, doc, increment, collection, serverTimestamp } from 'firebase/firestore';

const GiftCoinsInputSchema = z.object({
  fromUserId: z.string().describe('The UID of the user sending the gift.'),
  toUserId: z.string().describe('The UID of the user receiving the gift.'),
  coinAmount: z.number().int().positive().describe('The number of coins to gift.'),
  diamondValue: z.number().int().positive().describe('The number of diamonds the recipient will get.'),
});
export type GiftCoinsInput = z.infer<typeof GiftCoinsInputSchema>;

const GiftCoinsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type GiftCoinsOutput = z.infer<typeof GiftCoinsOutputSchema>;

export async function giftCoins(input: GiftCoinsInput): Promise<GiftCoinsOutput> {
  return giftCoinsFlow(input);
}

const giftCoinsFlow = ai.defineFlow(
  {
    name: 'giftCoinsFlow',
    inputSchema: GiftCoinsInputSchema,
    outputSchema: GiftCoinsOutputSchema,
  },
  async ({ fromUserId, toUserId, coinAmount, diamondValue }) => {
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', fromUserId);
        const receiverRef = doc(db, 'users', toUserId);

        // 1. Verify sender has enough coins.
        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists() || (senderDoc.data().coins || 0) < coinAmount) {
          throw new Error('Insufficient coins or sender not found.');
        }

        // 2. Create a record in the 'gifts' collection.
        const giftRef = doc(collection(db, 'gifts'));
        transaction.set(giftRef, {
            fromUser: fromUserId,
            toUser: toUserId,
            coins: coinAmount,
            time: serverTimestamp(),
        });

        // 3. Deduct coins from sender.
        transaction.update(senderRef, { coins: increment(-coinAmount) });

        // 4. Add diamonds to receiver.
        transaction.update(receiverRef, { diamonds: increment(diamondValue) });
      });

      return {
        success: true,
        message: `Successfully gifted ${coinAmount} coins!`,
      };
    } catch (error: any) {
      console.error('Gifting transaction failed:', error);
      return {
        success: false,
        message: error.message || 'An error occurred during the transaction.',
      };
    }
  }
);
