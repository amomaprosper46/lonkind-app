'use server';
/**
 * @fileOverview High-performance translation utility engine for user-generated content.
 * Free systemic utility—does not charge coins, maximizing cross-cultural accessibility.
 *
 * - translateText - Translates any arbitrary text block directly into English.
 * - TranslateTextInput - The input type for the function.
 * - TranslateTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateTextInputSchema = z.object({
  text: z.string().trim().describe('The raw foreign or multi-dialect text string to be translated.'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslateTextOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  translation: z.string().describe('The final translated English string payload.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;

export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const textTranslationPromptTemplate = ai.definePrompt({
  name: 'translateTextPrompt',
  input: { schema: z.object({ text: z.string() }) },
  output: { schema: z.object({ translation: z.string() }) },
  prompt: `You are an expert multi-lingual translator specializing in social media content.
Translate the following text accurately into English. 

### Core Rules:
- Preserve the original emotional tone, internet slang, and nuances.
- Maintain existing user handles (@username) and hashtags (#tag) exactly as they are written.
- If the text is already completely in English, return it exactly as it is.
- Do not provide any conversational commentary, explanations, or markdown fences.

Text to translate:
{{{text}}}
`,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async ({ text }) => {
    // 1. Structural Guard: Early exit if the text field is empty
    if (!text) {
      return {
        success: true,
        message: 'No text provided for translation.',
        translation: '',
      };
    }

    try {
      // 2. Execute the structured language translation compilation block
      const { output } = await textTranslationPromptTemplate({ text });

      if (!output) {
        throw new Error('The translation compilation engine returned an empty output stream.');
      }

      return {
        success: true,
        message: 'Content translated successfully.',
        translation: output.translation,
      };

    } catch (error: any) {
      console.error('Text translation pipeline encountered a runtime failure:', error);
      
      // Fallback safe envelope—returns original text so the UI layout doesn't break
      return {
        success: false,
        message: error.message || 'An unexpected exception occurred during text translation processing.',
        translation: text,
      };
    }
  }
);