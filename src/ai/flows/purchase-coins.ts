'use server';
/**
 * @fileOverview Global multi-currency coin purchase orchestration engine via Paystack.
 * Automatically configures regional currency codes, applies tiered pricing models,
 * and securely initializes international gateway authorization pipelines.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/**
 * Global Tiered Pricing Matrix
 * Defines base token valuation indexes across regional currency definitions.
 * Paystack supports ISO 4217 uppercase currency standard strings.
 */
const COIN_PRICING_TIERS: Record<string, { perCoin: number; minAmount: number }> = {
  NGN: { perCoin: 20, minAmount: 100 },   // 20 Naira per coin, min transaction 100 NGN
  USD: { perCoin: 0.05, minAmount: 1.00 }, // 5 Cents per coin, min transaction $1.00
  GHS: { perCoin: 0.50, minAmount: 2.00 }, // 0.50 Cedis per coin, min transaction 2 GHS
  KES: { perCoin: 5.00, minAmount: 50.00 },// 5 Shillings per coin, min transaction 50 KES
};

// Global fallback if an unsupported regional code slips past validation filters
const DEFAULT_CURRENCY = 'USD';

const PurchaseCoinsInputSchema = z.object({
  userId: z.string().describe('The UID of the user purchasing tokens.'),
  userEmail: z.string().email().describe('The validated customer communication email address.'),
  coinAmount: z.number().int().positive().describe('The specific quantity of coins selected for checkout.'),
  currencyCode: z.string().toUpperCase().length(3).default('NGN').describe('ISO 4217 three-letter currency string.'),
});
export type PurchaseCoinsInput = z.infer<typeof PurchaseCoinsInputSchema>;

const PurchaseCoinsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  authorizationUrl: z.string().optional(),
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
  async ({ userId, userEmail, coinAmount, currencyCode }) => {
    try {
      // 1. Resolve pricing tiers based on regional location matrix
      const pricingConfig = COIN_PRICING_TIERS[currencyCode] || COIN_PRICING_TIERS[DEFAULT_CURRENCY];
      const selectedCurrency = COIN_PRICING_TIERS[currencyCode] ? currencyCode : DEFAULT_CURRENCY;

      // 2. Compute true monetary value calculations
      const rawTotalAmount = coinAmount * pricingConfig.perCoin;
      
      // Enforce gateway processing safety thresholds
      if (rawTotalAmount < pricingConfig.minAmount) {
        throw new Error(
          `The selected bundle amount is lower than the minimum authorized gateway limit of ${pricingConfig.minAmount} ${selectedCurrency}.`
        );
      }

      /**
       * Paystack baseline constraint: 
       * All transactional computations must be calculated as fractional minor units 
       * (e.g., Kobo for NGN, Cents for USD, Pesewas for GHS). Multiply raw totals by 100.
       */
      const amountInSubunits = Math.round(rawTotalAmount * 100);

      // 3. Dispatch initialization command to Paystack secure servers
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          amount: amountInSubunits,
          currency: selectedCurrency, // Instructs Paystack which currency ledger to open
          metadata: {
            userId: userId,
            coinAmount: coinAmount,
            baseCurrency: selectedCurrency,
            monetaryValue: rawTotalAmount,
          },
        }),
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || 'The checkout subsystem failed to generate payment sessions.');
      }

      return {
        success: true,
        message: 'Global payment gateway portal established successfully.',
        authorizationUrl: data.data.authorization_url,
      };

    } catch (error: any) {
      console.error('International checkout session instantiation failure:', error);
      return {
        success: false,
        message: error.message || 'A routing initialization failure block interrupted processing loops.',
      };
    }
  }
);