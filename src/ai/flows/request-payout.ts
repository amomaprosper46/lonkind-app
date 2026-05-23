
'use server';
/**
 * @fileOverview A Genkit flow for handling payout requests.
 *
 * - requestPayout - A function that handles the payout request process.
 * - RequestPayoutInput - The input type for the requestPayout function.
 * - RequestPayoutOutput - The return type for the requestPayout function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';


const RequestPayoutInputSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the payout.'),
  amount: z.number().describe('The amount of money to pay out.'),
  paymentMethod: z.string().describe('The payment method (e.g., PayPal, Bank Transfer).'),
  paymentDetails: z.string().describe('The user\'s payment details (e.g., email or account number).'),
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
  async ({ userId, amount, paymentMethod, paymentDetails }) => {
    if (amount <= 0) {
      return {
        success: false,
        message: "Payout amount must be positive.",
      };
    }

    const userRef = doc(db, 'users', userId);

    try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            return { success: false, message: 'User not found.' };
        }
        
        const currentBalance = userDoc.data().balance || 0;

        if (currentBalance < amount) {
            return { success: false, message: 'Insufficient balance for this payout.' };
        }

        const newBalance = currentBalance - amount;
        
        updateDoc(userRef, { balance: newBalance })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'update',
              requestResourceData: { balance: newBalance },
            } satisfies SecurityRuleContext);

            errorEmitter.emit('permission-error', permissionError);
          });
        
        const fakeTransactionId = `txn_${Date.now()}`;

        return {
          success: true,
          message: `Your payout request of $${amount.toFixed(2)} has been successfully processed. Your new balance is $${newBalance.toFixed(2)}.`,
          transactionId: fakeTransactionId,
        };

    } catch (error: any) {
        if (error.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'get',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        }

        return {
            success: false,
            message: "An internal error occurred while processing your payout. Please try again later."
        }
    }
  }
);
