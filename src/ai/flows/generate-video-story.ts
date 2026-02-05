'use server';
/**
 * @fileOverview A Genkit flow for generating a short video story from text.
 *
 * - generateVideoStory - Creates a video with sound from a story prompt.
 * - GenerateVideoStoryInput - Input schema for the flow.
 * - GenerateVideoStoryOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { MediaPart } from 'genkit/media';

// Schemas
const GenerateVideoStoryInputSchema = z.object({
  story: z.string().describe('The full text of the story to be turned into a video.'),
});
export type GenerateVideoStoryInput = z.infer<typeof GenerateVideoStoryInputSchema>;

const GenerateVideoStoryOutputSchema = z.object({
  videoUrl: z.string().describe('A data URI for the generated video.'),
});
export type GenerateVideoStoryOutput = z.infer<typeof GenerateVideoStoryOutputSchema>;

// Main exported function
export async function generateVideoStory(input: GenerateVideoStoryInput): Promise<GenerateVideoStoryOutput> {
  return generateVideoStoryFlow(input);
}


// Helper: Download a media part and convert to data URI
async function getMediaAsDataUri(mediaPart: MediaPart, apiKey: string, defaultContentType: string): Promise<string> {
    const fetch = (await import('node-fetch')).default;
    const url = `${mediaPart.media!.url}&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch media. Status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = mediaPart.media?.contentType || defaultContentType;
    
    return `data:${contentType};base64,${base64}`;
}


// The main flow
const generateVideoStoryFlow = ai.defineFlow(
  {
    name: 'generateVideoStoryFlow',
    inputSchema: GenerateVideoStoryInputSchema,
    outputSchema: GenerateVideoStoryOutputSchema,
  },
  async ({ story }) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set.');
    }

    // 1. Generate a single video. Using veo-2.0 for better stability.
    let { operation } = await ai.generate({
        model: googleAI.model('veo-2.0-generate-001'),
        prompt: story,
        config: {
            durationSeconds: 8,
            aspectRatio: '16:9',
        },
    });

    if (!operation) {
        throw new Error('Video generation did not start an operation.');
    }

    // 2. Poll for video operation result
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        operation = await ai.checkOperation(operation);
    }
    
    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    // 3. Process result and convert to data URI
    const videoPart = operation.output?.message?.content.find((p) => !!p.media);
    if (!videoPart) {
        throw new Error('No video was found in the operation result.');
    }
    
    const videoDataUri = await getMediaAsDataUri(videoPart, process.env.GEMINI_API_KEY!, 'video/mp4');

    return {
        videoUrl: videoDataUri,
    };
  }
);
