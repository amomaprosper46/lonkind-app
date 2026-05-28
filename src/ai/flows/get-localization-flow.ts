'use server';
/**
 * @fileOverview A Genkit flow for localizing UI text.
 *
 * - getLocalization - A function that takes a JSON object of strings and a target language, and returns the translated strings.
 * - GetLocalizationInput - The input type for the function.
 * - GetLocalizationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetLocalizationInputSchema = z.object({
  jsonContent: z.record(z.string()).describe('A JSON object where keys are IDs and values are the English strings to be translated.'),
  languageCode: z.string().describe('The two-letter ISO 639-1 code for the target language (e.g., "es" for Spanish).'),
});
export type GetLocalizationInput = z.infer<typeof GetLocalizationInputSchema>;

// The output will have the same keys as the input, but with translated values.
const GetLocalizationOutputSchema = z.record(z.string());
export type GetLocalizationOutput = z.infer<typeof GetLocalizationOutputSchema>;

export async function getLocalization(input: GetLocalizationInput): Promise<GetLocalizationOutput> {
  return getLocalizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'localizationPrompt',
  input: { schema: GetLocalizationInputSchema },
  output: { schema: GetLocalizationOutputSchema },
  prompt: `You are an expert UI/UX localization specialist.
Translate the values of the following JSON object from English to the language specified by the language code '{{languageCode}}'.
Maintain the exact same JSON structure and keys. Only translate the string values. Do not add any extra explanations or text.

JSON to translate:
{{{jsonStringify jsonContent}}}
`,
});

// Register a helper to stringify JSON for the prompt
import Handlebars from 'handlebars';
Handlebars.registerHelper('jsonStringify', function(context) {
  return JSON.stringify(context);
});

const getLocalizationFlow = ai.defineFlow(
  {
    name: 'getLocalizationFlow',
    inputSchema: GetLocalizationInputSchema,
    outputSchema: GetLocalizationOutputSchema,
  },
  async ({ jsonContent, languageCode }) => {
    // If the target language is English, no need to call the AI.
    if (languageCode.startsWith('en')) {
      return jsonContent;
    }

    const { output } = await prompt({ jsonContent, languageCode });
    return output || jsonContent; // Fallback to original content on error
  }
);
