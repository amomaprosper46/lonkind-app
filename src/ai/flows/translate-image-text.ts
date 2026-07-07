'use server';
/**
 * @fileOverview A secure, monetized Genkit flow for extracting and translating text from images.
 * Validates user balance and deducts 3 coins per multimodal processing run.
 *
 * - translateImageText - Validates data, handles coin deduction, and executes OCR/Translation.
 * - TranslateImageTextInput - The input type for the function.
 * - TranslateImageTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

// 1. Updated schema to require the user's ID for coin charging
const TranslateImageTextInputSchema = z.object({
  userId: z.string().describe('The UID of the user requesting the image processing.'),
  imageUrl: z.string().url('Must provide a valid image URL link.').describe('The public URL of the image to process.'),
});
export type TranslateImageTextInput = z.infer<typeof TranslateImageTextInputSchema>;

// 2. Clearer envelope design communicating transaction status back to your client layout
const TranslateImageTextOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  translation: z.string().optional().describe('The English translation of the text found in the image.'),
});
export type TranslateImageTextOutput = z.infer<typeof TranslateImageTextOutputSchema>;

export async function translateImageText(input: TranslateImageTextInput): Promise<TranslateImageTextOutput> {
  return translateImageTextFlow(input);
}

const translationPromptTemplate = ai.definePrompt({
  name: 'translateImageTextPrompt',
  input: { schema: z.object({ imageUrl: z.string() }) },
  output: { schema: z.object({ translation: z.string() }) },
  prompt: `You are an expert at Optical Character Recognition (OCR) and translation.
Your task is to analyze the provided image, identify any text within it, and translate that text to English.

- If you find text, provide only the English translation.
- If the text is already in English, return the original text.
- If there is no text in the image, return an empty string for the translation.

Do not include any extra explanations, markdown wrapper code fences, or meta-commentary.

Image to analyze: {{media url=imageUrl}}
`,
});

const translateImageTextFlow = ai.defineFlow(
  {
    name: 'translateImageTextFlow',
    inputSchema: TranslateImageTextInputSchema,
    outputSchema: TranslateImageTextOutputSchema,
  },
  async ({ userId, imageUrl }) => {
    const IMAGE_TRANSLATION_COST = 3; // Premium multimodal transaction fee

    try {
      const userRef = adminDb.collection('users').doc(userId);
      let balanceSufficient = false;

      // 3. Atomically check and deduct 3 coins BEFORE firing the multimodal processing layers
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User profile record could not be verified.');
        }

        const currentCoins = userDoc.data()?.coins || 0;

        if (currentCoins < IMAGE_TRANSLATION_COST) {
          balanceSufficient = false;
          return;
        }

        balanceSufficient = true;
        transaction.update(userRef, {
          coins: FieldValue.increment(-IMAGE_TRANSLATION_COST),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      if (!balanceSufficient) {
        return {
          success: false,
          message: `Insufficient coins. Multi-modal processing costs ${IMAGE_TRANSLATION_COST} coins. Please purchase more coins to continue.`,
        };
      }

      // 4. Securely fire the Genkit prompt with the public image parameter
      const { output } = await translationPromptTemplate({ imageUrl });

      return {
        success: true,
        message: `Image processed successfully! ${IMAGE_TRANSLATION_COST} coins deducted.`,
        translation: output?.translation ?? '',
      };

    } catch (error: any) {
      console.error('Multimodal translation engine failed:', error);
      return {
        success: false,
        message: error.message || 'An unexpected internal processing roadblock occurred.',
      };
    }
  }
);