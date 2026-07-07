'use server';
/**
 * @fileOverview A secure, monetized Genkit flow for generating engaging news summaries.
 * Validates user balance and deducts 2 coins per generation to protect server resources.
 *
 * - generateNewsPost - Validates account balance and executes the news reporter flow.
 * - GenerateNewsPostInput - The input type for the function.
 * - GenerateNewsPostOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

// 1. Updated input schema to require the user's ID for premium tracking
const GenerateNewsPostInputSchema = z.object({
  userId: z.string().describe('The UID of the user requesting the news post.'),
  topic: z.string().trim().min(2, 'Topic must be at least 2 characters long.').describe('The topic for the news post (e.g., "World News", "Technology").'),
});
export type GenerateNewsPostInput = z.infer<typeof GenerateNewsPostInputSchema>;

// 2. Updated output envelope to pass transaction states clearly to the frontend UI
const GenerateNewsPostOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  postContent: z.string().optional().describe('The generated content for the social media post.'),
});
export type GenerateNewsPostOutput = z.infer<typeof GenerateNewsPostOutputSchema>;

export async function generateNewsPost(input: GenerateNewsPostInput): Promise<GenerateNewsPostOutput> {
  return newsReporterFlow(input);
}

const newsReporterPromptTemplate = ai.definePrompt({
  name: 'newsReporterPrompt',
  input: { schema: z.object({ topic: z.string() }) },
  output: { schema: z.object({ postContent: z.string() }) },
  prompt: `You are an expert news reporter and social media manager for the Lonkind app. 
  
Your task is to find a very recent, interesting, and globally relevant news story based on the provided topic.

### Core Guidelines:
- Write a short, engaging, and objective social media post (2-3 sentences) summarizing the news. 
- The post should be informative and easy to understand for a general audience. 
- Start the post with an appropriate, professional news emoji.
- Do not make up or hallucinate completely fictional global disasters or fake current events if you lack concrete information on the topic. Keep summaries accurate to historical or current reality.
- Do not include conversational commentary or markdown wrapper code fences.

Topic: {{{topic}}}
`,
});

const newsReporterFlow = ai.defineFlow(
  {
    name: 'newsReporterFlow',
    inputSchema: GenerateNewsPostInputSchema,
    outputSchema: GenerateNewsPostOutputSchema,
  },
  async ({ userId, topic }) => {
    const NEWS_POST_COST = 2; // Premium execution balance constraint

    try {
      const userRef = adminDb.collection('users').doc(userId);
      let balanceSufficient = false;

      // 3. Run a secure server transaction to verify and deduct coins BEFORE executing the LLM
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User profile record could not be verified.');
        }

        const currentCoins = userDoc.data()?.coins || 0;

        if (currentCoins < NEWS_POST_COST) {
          balanceSufficient = false;
          return; // Terminate transaction line early
        }

        balanceSufficient = true;
        transaction.update(userRef, {
          coins: FieldValue.increment(-NEWS_POST_COST),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      if (!balanceSufficient) {
        return {
          success: false,
          message: `Insufficient coins. Generating an AI news post costs ${NEWS_POST_COST} coins. Please top up your wallet balance.`,
        };
      }

      // 4. Securely invoke the Genkit prompt with the clean input topic
      const { output } = await newsReporterPromptTemplate({ topic });

      if (!output?.postContent) {
        throw new Error('The news reporter engine failed to render a text summary summary.');
      }

      return {
        success: true,
        message: `News post generated successfully! ${NEWS_POST_COST} coins deducted.`,
        postContent: output.postContent,
      };

    } catch (error: any) {
      console.error('AI Command Center news generation loop failure:', error);
      return {
        success: false,
        message: error.message || 'An unexpected server issue occurred while broadcasting your news post.',
      };
    }
  }
);