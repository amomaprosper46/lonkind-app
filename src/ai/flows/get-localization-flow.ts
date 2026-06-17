'use server';
/**
 * @fileOverview A secure, high-performance Genkit flow for localizing UI elements.
 * Free systemic utility—does not charge coins, ensuring global accessibility.
 *
 * - getLocalization - Translates raw UI JSON keys accurately to target language structures.
 * - GetLocalizationInput - The input type for the function.
 * - GetLocalizationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit'; // Using standard genkit instance imports

const GetLocalizationInputSchema = z.object({
  jsonContent: z.record(z.string()).describe('A JSON object where keys are IDs and values are the English strings to be translated.'),
  languageCode: z.string().describe('The two-letter ISO 639-1 code for the target language (e.g., "es", "fr", "yo").'),
});
export type GetLocalizationInput = z.infer<typeof GetLocalizationInputSchema>;

const GetLocalizationOutputSchema = z.record(z.string()).describe('The localized key-value structure mirroring the input constraints.');
export type GetLocalizationOutput = z.infer<typeof GetLocalizationOutputSchema>;

export async function getLocalization(input: GetLocalizationInput): Promise<GetLocalizationOutput> {
  return getLocalizationFlow(input);
}

const localizationPromptTemplate = ai.definePrompt({
  name: 'localizationPrompt',
  input: { schema: z.object({ jsonString: z.string(), languageCode: z.string() }) },
  output: { schema: GetLocalizationOutputSchema },
  prompt: `You are an expert UI/UX localization specialist for global social applications.
Translate the values of the following JSON object from English directly to the language specified by the code '{{languageCode}}'.

### Strict Requirements:
- Maintain the exact same JSON structure and keys. 
- Only translate the string values.
- Retain structural formatting variables (e.g., matching %s, {count}, or structural markup tokens) exactly as they appear in the source text.
- Do not add any extra conversational explanations, markup fences, or markdown text outside the valid JSON object structure.

JSON to translate:
{{{jsonString}}}
`,
});

const getLocalizationFlow = ai.defineFlow(
  {
    name: 'getLocalizationFlow',
    inputSchema: GetLocalizationInputSchema,
    outputSchema: GetLocalizationOutputSchema,
  },
  async ({ jsonContent, languageCode }) => {
    // 1. Fast path: Avoid hitting the LLM layer entirely if target matches English baseline
    if (languageCode.toLowerCase().startsWith('en')) {
      return jsonContent;
    }

    // 2. Performance guard: If the document payload contains zero keys, return early
    const keys = Object.keys(jsonContent);
    if (keys.length === 0) {
      return jsonContent;
    }

    try {
      const jsonString = JSON.stringify(jsonContent);
      
      // Execute the structured prompt execution block
      const { output } = await localizationPromptTemplate({ jsonString, languageCode });
      
      if (!output) {
        throw new Error('Localization compiler returned empty structured response maps.');
      }

      // 3. Validation Layer: Ensure the LLM didn't drop or alter keys during transformation
      const outputKeys = Object.keys(output);
      const isStructureValid = keys.every(key => outputKeys.includes(key));

      if (!isStructureValid) {
        console.warn(`Localization structure mismatch for code "${languageCode}". Falling back to baseline dictionary definitions.`);
        
        // Merge keys safely so the user doesn't end up with completely blank labels
        return { ...jsonContent, ...output };
      }

      return output;

    } catch (error) {
      console.error(`Systemic failure while rendering localization translation logs for "${languageCode}":`, error);
      
      // Fallback safe envelope—keeps the application layout working fine in English if the provider goes offline
      return jsonContent;
    }
  }
);