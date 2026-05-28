
'use server';
/**
 * @fileOverview A Genkit flow for handling creator payout requests.
 *
 * - requestPayout - A function that handles the payout request process, converting diamonds to Naira.
 * - RequestPayoutInput - The input type for the requestPayout function.
 * - RequestPayoutOutput - The return type for the requestPayout function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, increment } from 'firebase/firestore';

// Economic constants
const DIAMOND_PAYOUT_RATE_NAIRA = 15; // 1 Diamond = 15 Naira (25% platform fee on ₦20 coin)
const MINIMUM_PAYOUT_DIAMONDS = 500; // 500 diamonds = ₦7,500
const DAILY_PAYOUT_LIMIT_DIAMONDS = 10000; // 10,000 diamonds = ₦150,000

const RequestPayoutInputSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the payout.'),
  diamondAmount: z.number().int().positive().describe('The number of diamonds to cash out.'),
  paymentMethod: z.string().describe('The payment method (e.g., Bank Transfer).'),
  paymentDetails: z.string().describe('The user\'s payment details (e.g., "0123456789 - Access Bank").'),
});
export type RequestPayoutInput = z.infer<typeof RequestPayoutInputSchema>;

const RequestPayoutOutputSchema = z.object({
  success: z.boolean().describe('Whether the payout request was successful.'),
  message: z.string().describe('A message detailing the result of the request.'),
  transactionId: z.string().optional().describe('The transaction ID if successful.'),
});
export type RequestPayoutOutput = z.infer<typeof RequestPayoutOutputSchema>;

export async function requestPayout(input: RequestPayoutInput): Promise<RequestPayoutOutput> {
  return requestPayoutFlow(input);
}

const requestPayoutFlow = ai.defineFlow(
  {
    name: 'requestPayoutFlow',
    inputSchema: RequestPayoutInputSchema,
    outputSchema: RequestPayoutOutputSchema,
  },
  async ({ userId, diamondAmount, paymentMethod, paymentDetails }) => {
    
    if (diamondAmount < MINIMUM_PAYOUT_DIAMONDS) {
      return { success: false, message: `Minimum payout is ${MINIMUM_PAYOUT_DIAMONDS} diamonds (₦${(MINIMUM_PAYOUT_DIAMONDS * DIAMOND_PAYOUT_RATE_NAIRA).toLocaleString()}).` };
    }

    try {
      // In a real application, this is where you would call the payment provider's API
      // to initiate the bank transfer.
      // The actual database transaction has been moved to the client side to avoid unauthenticated Admin errors.
      
      const payoutNaira = diamondAmount * DIAMOND_PAYOUT_RATE_NAIRA;
      return {
        success: true,
        message: `Your payout request of ₦${payoutNaira.toLocaleString()} has been submitted. It will be processed shortly.`,
      };

    } catch (error: any) {
        console.error("Payout simulation failed:", error);
        return {
            success: false,
            message: error.message || "An internal error occurred. Please try again later."
        };
    }
  }
);
