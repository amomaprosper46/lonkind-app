'use server';
/**
 * @fileOverview Secure server-side creator payout fulfillment orchestration engine.
 * Protects database ledgers using ACID transactions to prevent double-spending
 * and enforces structural anti-fraud volume checks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin'; // Secure Node.js Admin SDK instance
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * Global Base Exchange Yield Index Matrix
 * Converts raw accrued Diamonds into destination currency equivalents.
 */
const LIQUIDATION_FX_INDEX: Record<string, { perDiamond: number; minDiamonds: number; dailyLimit: number }> = {
  NGN: { perDiamond: 15, minDiamonds: 500, dailyLimit: 10000 },     // 1 Diamond = 15 NGN
  USD: { perDiamond: 0.035, minDiamonds: 200, dailyLimit: 5000 },   // 1 Diamond = 3.5 Cents
  GHS: { perDiamond: 0.35, minDiamonds: 300, dailyLimit: 6000 },    // 1 Diamond = 0.35 GHS
  KES: { perDiamond: 3.75, minDiamonds: 400, dailyLimit: 8000 },    // 1 Diamond = 3.75 KES
};

const DEFAULT_CURRENCY = 'NGN';

const RequestPayoutInputSchema = z.object({
  userId: z.string().describe('The validated UID of the creator.'),
  diamondAmount: z.number().int().positive().describe('Total quantity of diamonds designated for conversion.'),
  destinationCurrency: z.string().toUpperCase().length(3).default('NGN').describe('ISO 4217 targeted settlement currency.'),
  paymentMethod: z.string().describe('The delivery rail mechanism (e.g., "Bank Transfer", "PayPal").'),
  paymentDetails: z.string().describe('Explicit account metadata endpoints required for routing.'),
});
export type RequestPayoutInput = z.infer<typeof RequestPayoutInputSchema>;

const RequestPayoutOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  transactionId: z.string().optional(),
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
  async ({ userId, diamondAmount, destinationCurrency, paymentMethod, paymentDetails }) => {
    
    // 1. Resolve FX conversion configuration boundaries
    const config = LIQUIDATION_FX_INDEX[destinationCurrency] || LIQUIDATION_FX_INDEX[DEFAULT_CURRENCY];
    const targetCurrency = LIQUIDATION_FX_INDEX[destinationCurrency] ? destinationCurrency : DEFAULT_CURRENCY;

    // Validate minimum structural thresholds before stepping into database threads
    if (diamondAmount < config.minDiamonds) {
      return {
        success: false,
        message: `The minimum withdrawal threshold is ${config.minDiamonds} Diamonds for ${targetCurrency} conversions.`,
      };
    }

    try {
      const userRef = adminDb.collection('users').doc(userId);
      const payoutLogCollection = adminDb.collection('payouts');

      // Compute rolling timeline boundaries for 24-hour limit checks
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      const timestampCursor = Timestamp.fromDate(oneDayAgo);

      /**
       * Run a secure ACID Database Transaction on the Server Core.
       * This safely blocks simultaneous click-spamming or double-spend race conditions.
       */
      const transactionResult = await adminDb.runTransaction(async (transaction) => {
        // A. Fetch current creator account balances securely
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error('Creator account record could not be mapped inside registration files.');
        }

        const currentDiamonds = userDoc.data()?.diamonds || 0;
        if (currentDiamonds < diamondAmount) {
          throw new Error('Insufficient diamond reserves available to complete this conversion request.');
        }

        // B. Calculate historical volume over the past rolling 24 hours
        const historicalVolumeQuery = await payoutLogCollection
          .where('userId', '==', userId)
          .where('createdAt', '>=', timestampCursor)
          .get();

        let totalLiquidatedPastDay = 0;
        historicalVolumeQuery.forEach(doc => {
          const st = (doc.data().status || '').toLowerCase();
          if (st !== 'failed' && st !== 'error' && st !== 'rejected' && st !== 'cancelled') {
            totalLiquidatedPastDay += doc.data().diamondAmount || 0;
          }
        });

        if (totalLiquidatedPastDay + diamondAmount > config.dailyLimit) {
          throw new Error(`This transaction exceeds your rolling 24-hour liquidity limits of ${config.dailyLimit} Diamonds.`);
        }

        // C. Compute total destination payout currency payout values
        const totalPayoutYield = Number((diamondAmount * config.perDiamond).toFixed(2));

        // D. Commit balance deductions
        transaction.update(userRef, {
          diamonds: FieldValue.increment(-diamondAmount),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // E. Document the payout request tracking receipt inside the transaction loop
        const payoutReceiptRef = payoutLogCollection.doc();
        transaction.set(payoutReceiptRef, {
          userId,
          diamondAmount,
          currency: targetCurrency,
          payoutValue: totalPayoutYield,
          status: 'PENDING', // Will be picked up by checking loops or Paystack transfer webhooks
          paymentMethod,
          paymentDetails,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          transactionId: payoutReceiptRef.id,
          yieldAmount: totalPayoutYield,
        };
      });

      return {
        success: true,
        message: `Your conversion request has been submitted securely. ${transactionResult.yieldAmount.toLocaleString()} ${targetCurrency} will be routed shortly.`,
        transactionId: transactionResult.transactionId,
      };

    } catch (error: any) {
      console.error('Critical ledger liquidation disruption exception:', error);
      return {
        success: false,
        message: error.message || 'An unexpected runtime exception interrupted accounting loops.',
      };
    }
  }
);