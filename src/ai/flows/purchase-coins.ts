
'use server';
/**
 * @fileOverview A Genkit flow for purchasing coins.
 *
 * - purchaseCoins - A function that simulates purchasing coins and adds them to a user's balance, while creating a transaction record.
 * - PurchaseCoinsInput - The input type for the function.
 * - PurchaseCoinsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { runTransaction, doc, increment, collection, serverTimestamp } from 'firebase/firestore';

const NAIRA_PER_COIN = 20; // Assuming 1 coin costs 20 Naira for this simulation.

const PurchaseCoinsInputSchema = z.object({
  userId: z.string().describe('The UID of the user purchasing coins.'),
  coinAmount: z.number().int().positive().describe('The number of coins to purchase.'),
});
export type PurchaseCoinsInput = z.infer<typeof PurchaseCoinsInputSchema>;

const PurchaseCoinsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type PurchaseCoinsOutput = z.infer<typeof PurchaseCoinsOutputSchema>;

export async function purchaseCoins(input: PurchaseCoinsInput): Promise<PurchaseCoinsOutput> {
  return purchaseCoinsFlow(input);
}

const purchaseCoinsFlow = ai.defineFlow(
  {
    name: 'purchaseCoinsFlow',
    inputSchema: PurchaseCoinsInputSchema,
    outputSchema: PurchaseCoinsOutputSchema,
  },
  async ({ userId, coinAmount }) => {
    try {
      await runTransaction(db, async (transaction) => {
        // In a real app, you would process payment with a gateway like Paystack here first.
        // For this simulation, we assume payment was successful.

        const amountNaira = coinAmount * NAIRA_PER_COIN;

        // 1. Create a transaction record.
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
            userId: userId,
            amountNaira: amountNaira,
            coinsAdded: coinAmount,
            status: "success",
            time: serverTimestamp(),
        });

        // 2. Update the user's coin balance.
        const userRef = doc(db, 'users', userId);
        transaction.update(userRef, {
            coins: increment(coinAmount),
        });
      });

      return {
        success: true,
        message: `Successfully purchased ${coinAmount} coins.`,
      };
    } catch (error: any) {
      console.error('Coin purchase transaction failed:', error);
      return {
        success: false,
        message: 'An error occurred while purchasing coins.',
      };
    }
  }
);
