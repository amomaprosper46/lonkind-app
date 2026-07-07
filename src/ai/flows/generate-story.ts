'use server';
/**
 * @fileOverview A secure Genkit flow for generating short, fun stories.
 * Validates user balance and deducts 2 coins per story generation to protect server resources.
 *
 * - generateStory - A function that handles payment validation and execution.
 * - GenerateStoryInput - The input type for the generateStory function.
 * - GenerateStoryOutput - The return type for the generateStory function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// 1. Updated input schema to require the user's document ID
const GenerateStoryInputSchema = z.object({
  userId: z.string().describe('The UID of the user requesting the story.'),
  prompt: z.string().describe('The user\'s prompt for the story (e.g., "A brave cat who wants to fly").'),
});
export type GenerateStoryInput = z.infer<typeof GenerateStoryInputSchema>;

// 2. Updated output schema to handle payment authorization errors gracefully
const GenerateStoryOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  story: z.string().optional().describe('The generated short story.'),
});
export type GenerateStoryOutput = z.infer<typeof GenerateStoryOutputSchema>;

export async function generateStory(input: GenerateStoryInput): Promise<GenerateStoryOutput> {
  return generateStoryFlow(input);
}

const storyPromptTemplate = ai.definePrompt({
  name: 'generateStoryPrompt',
  input: { schema: GenerateStoryInputSchema },
  output: { schema: z.object({ story: z.string() }) }, // The internal model prompt directly outputs the text wrap
  prompt: `You are a creative, cheerful, and responsible storyteller for the Lonkind social media app.  
  
Your purpose is to generate delightful and imaginative content that is safe and appropriate for all audiences.

Write a short, imaginative, and family-friendly story (about 150-200 words) based on the user's prompt. 
The story must have a positive or hopeful tone, a clear beginning, middle, and end. 
Absolutely no inappropriate, violent, or negative themes. Make it engaging and fun!

User's Story Prompt: {{{prompt}}}`,
});

const generateStoryFlow = ai.defineFlow(
  {
    name: 'generateStoryFlow',
    inputSchema: GenerateStoryInputSchema,
    outputSchema: GenerateStoryOutputSchema,
  },
  async (input) => {
    const userRef = adminDb.collection('users').doc(input.userId);
    const STORY_COST = 2; // Premium feature consumption cost

    try {
      let balanceSufficient = false;

      // 3. Atomically check balance and deduct coins before calling the AI prompt
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User profile record not found.');
        }

        const currentCoins = userDoc.data()?.coins || 0;

        if (currentCoins < STORY_COST) {
          balanceSufficient = false;
          return; // Stop transaction right here
        }

        balanceSufficient = true;
        transaction.update(userRef, {
          coins: FieldValue.increment(-STORY_COST),
        });
      });

      if (!balanceSufficient) {
        return {
          success: false,
          message: `Insufficient coins. Story generation costs ${STORY_COST} coins. Please top up your account balance.`,
        };
      }

      // 4. Securely call your pre-compiled Genkit prompt once payment settles
      const { output } = await storyPromptTemplate(input);

      if (!output?.story) {
        throw new Error('The storyteller engine encountered an issue rendering the text.');
      }

      return {
        success: true,
        message: `Story generated successfully! ${STORY_COST} coins deducted.`,
        story: output.story,
      };

    } catch (error: any) {
      console.error('Failed story generation workflow sequence:', error);
      return {
        success: false,
        message: error.message || 'An unexpected server issue cropped up while weaving your story.',
      };
    }
  }
);