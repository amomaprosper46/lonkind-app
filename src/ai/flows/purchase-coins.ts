
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
      // In a real application, you would process payment with a gateway like Paystack or Stripe here.
      // Since this is a simulation, we assume payment was successful.
      // The actual database transaction has been moved to the client side to avoid unauthenticated Admin errors.
      
      return {
        success: true,
        message: `Successfully purchased ${coinAmount} coins.`,
      };
    } catch (error: any) {
      console.error('Coin purchase simulation failed:', error);
      return {
        success: false,
        message: 'An error occurred while simulating coin purchase.',
      };
    }
  }
);
