'use server';
/**
 * @fileOverview A Genkit flow for translating text found within an image.
 *
 * - translateImageText - A function that takes an image URL and returns the English translation of any text in it.
 * - TranslateImageTextInput - The input type for the function.
 * - TranslateImageTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateImageTextInputSchema = z.object({
  imageUrl: z.string().describe('The public URL of the image to process.'),
});
export type TranslateImageTextInput = z.infer<typeof TranslateImageTextInputSchema>;

const TranslateImageTextOutputSchema = z.object({
  translation: z.string().describe('The English translation of the text found in the image. If no text is found, this will be an empty string.'),
});
export type TranslateImageTextOutput = z.infer<typeof TranslateImageTextOutputSchema>;

export async function translateImageText(input: TranslateImageTextInput): Promise<TranslateImageTextOutput> {
  return translateImageTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateImageTextPrompt',
  input: { schema: TranslateImageTextInputSchema },
  output: { schema: TranslateImageTextOutputSchema },
  prompt: `You are an expert at Optical Character Recognition (OCR) and translation.
Your task is to analyze the provided image, identify any text within it, and translate that text to English.

- If you find text, provide only the English translation.
- If the text is already in English, return the original text.
- If there is no text in the image, return an empty string for the translation.

Do not include any extra explanations or commentary.

Image to analyze: {{media url=imageUrl}}
`,
});

const translateImageTextFlow = ai.defineFlow(
  {
    name: 'translateImageTextFlow',
    inputSchema: TranslateImageTextInputSchema,
    outputSchema: TranslateImageTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
