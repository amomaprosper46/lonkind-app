'use server';
/**
 * @fileOverview A secure Genkit flow for generating impactful ideas that costs coins.
 *
 * - generateIdeas - Verifies user balance, deducts 1 coin, and calls the LLM.
 * - GenerateIdeasInput - The input type for the generateIdeas function.
 * - GenerateIdeasOutput - The return type for the generateIdeas function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin';

// 1. Updated Input Schema to include the authenticated user's ID
const GenerateIdeasInputSchema = z.object({
  userId: z.string().describe('The UID of the user requesting the generation.'),
  topic: z.string().describe('The main topic for the ideas (e.g., Renewable Energy)'),
  keywords: z.string().describe('Comma-separated keywords to focus on (e.g., solar, community, affordable)'),
  scope: z.string().optional().describe('The scope of the ideas (e.g., local communities, global scale)'),
});
export type GenerateIdeasInput = z.infer<typeof GenerateIdeasInputSchema>;

// 2. Clearer Output Schema that tells the UI if a purchase/deduction failed
const GenerateIdeasOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  ideas: z.array(z.string()).optional().describe('A list of generated idea strings.'),
});
export type GenerateIdeasOutput = z.infer<typeof GenerateIdeasOutputSchema>;

export async function generateIdeas(input: GenerateIdeasInput): Promise<GenerateIdeasOutput> {
  return generateIdeasFlow(input);
}

const ideasPrompt = ai.definePrompt({
    name: 'ideasPrompt',
    input: { schema: GenerateIdeasInputSchema },
    output: { schema: GenerateIdeasOutputSchema },
    prompt: `You are an expert at brainstorming innovative and impactful ideas.
    Generate a list of 3 creative ideas based on the following criteria.
    Return your response as a list of strings in the 'ideas' field.

    Topic: {{{topic}}}
    Keywords: {{{keywords}}}
    {{#if scope}}
    Scope: {{{scope}}}
    {{/if}}
    `,
});

const generateIdeasFlow = ai.defineFlow(
  {
    name: 'generateIdeasFlow',
    inputSchema: GenerateIdeasInputSchema,
    outputSchema: GenerateIdeasOutputSchema,
  },
  async (input) => {
    const userRef = adminDb.collection('users').doc(input.userId);

    try {
      let balanceSufficient = false;

      // 3. Atomically verify balance and deduct 1 coin BEFORE generating the ideas
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User profile not found.');
        }

        const currentCoins = userDoc.data()?.coins || 0;

        if (currentCoins < 1) {
          balanceSufficient = false;
          return; // Exit transaction without changing anything
        }

        balanceSufficient = true;
        // Deduct exactly 1 coin for the API generation call
        transaction.update(userRef, {
          coins: admin.firestore.FieldValue.increment(-1)
        });
      });

      if (!balanceSufficient) {
        return {
          success: false,
          message: 'Insufficient coins. Please purchase more coins to use the Idea Generator.',
        };
      }

      // 4. Fire the LLM request now that payment has been safely processed
      const { output } = await ideasPrompt(input);

      return {
        success: true,
        message: 'Ideas generated successfully. 1 coin deducted.',
        ideas: output?.ideas || [],
      };

    } catch (error: any) {
      console.error('Failed to generate ideas or update balance:', error);
      return {
        success: false,
        message: error.message || 'An error occurred during generation.',
      };
    }
  }
);
