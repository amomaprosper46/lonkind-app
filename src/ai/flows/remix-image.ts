
'use server';
/**
 * @fileOverview A Genkit flow for remixing an image based on a text prompt.
 *
 * - remixImage - A function that takes an image URL and a prompt and generates a new image.
 * - RemixImageInput - The input type for the function.
 * - RemixImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

const RemixImageInputSchema = z.object({
  imageUrl: z.string().describe("A public URL or data URI of the image to remix."),
  prompt: z.string().describe("A text prompt describing the desired transformation."),
});
export type RemixImageInput = z.infer<typeof RemixImageInputSchema>;

const RemixImageOutputSchema = z.object({
  remixedImageUrl: z.string().describe('The remixed image as a data URI.'),
});
export type RemixImageOutput = z.infer<typeof RemixImageOutputSchema>;

// Main exported function
export async function remixImage(input: RemixImageInput): Promise<RemixImageOutput> {
  return remixImageFlow(input);
}

// The Genkit flow
const remixImageFlow = ai.defineFlow(
  {
    name: 'remixImageFlow',
    inputSchema: RemixImageInputSchema,
    outputSchema: RemixImageOutputSchema,
  },
  async ({ imageUrl, prompt }) => {
    const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-image-preview'),
        prompt: [
            { media: { url: imageUrl } },
            { text: prompt },
        ],
        config: {
            // Must include both TEXT and IMAGE for this model
            responseModalities: ['TEXT', 'IMAGE'], 
        },
    });
    
    if (!media?.url) {
        throw new Error('Image remixing failed to return a valid image.');
    }

    return {
        remixedImageUrl: media.url,
    };
  }
);
