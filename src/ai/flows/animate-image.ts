'use server';
/**
 * @fileOverview A Genkit flow for animating a static image into a short video.
 *
 * - animateImage - A function that takes an image and generates a video from it.
 * - AnimateImageInput - The input type for the function.
 * - AnimateImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { MediaPart } from 'genkit/media';

// Define the input schema using Zod
const AnimateImageInputSchema = z.object({
  imageUrl: z.string().describe("A public URL or data URI of the image to animate."),
});
export type AnimateImageInput = z.infer<typeof AnimateImageInputSchema>;

// Define the output schema using Zod
const AnimateImageOutputSchema = z.object({
  videoUrl: z.string().describe('The generated video as a data URI.'),
});
export type AnimateImageOutput = z.infer<typeof AnimateImageOutputSchema>;


// The main exported function that calls the flow
export async function animateImage(input: AnimateImageInput): Promise<AnimateImageOutput> {
  return animateImageFlow(input);
}


async function getVideoAsDataUri(video: MediaPart): Promise<string> {
    const fetch = (await import('node-fetch')).default;
    // The URL from Veo requires the API key to be appended for download.
    const videoDownloadResponse = await fetch(
      `${video.media!.url}&key=${process.env.GEMINI_API_KEY}`
    );
    
    if (!videoDownloadResponse.ok || !videoDownloadResponse.body) {
        throw new Error(`Failed to fetch video. Status: ${videoDownloadResponse.status}`);
    }

    const videoBuffer = await videoDownloadResponse.arrayBuffer();
    const base64Video = Buffer.from(videoBuffer).toString('base64');
    const contentType = video.media?.contentType || 'video/mp4';
    
    return `data:${contentType};base64,${base64Video}`;
}

// Define the main Genkit flow
const animateImageFlow = ai.defineFlow(
  {
    name: 'animateImageFlow',
    inputSchema: AnimateImageInputSchema,
    outputSchema: AnimateImageOutputSchema,
  },
  async ({ imageUrl }) => {
    let { operation } = await ai.generate({
        model: googleAI.model('veo-2.0-generate-001'),
        prompt: [
            { text: 'Subtly animate this image. Make the subject move slightly as if it were a short, looping video.' },
            { media: { url: imageUrl } },
        ],
        config: {
            durationSeconds: 4, // Generate a short video
            aspectRatio: '16:9', // Or match source, but this is a safe default
        },
    });

    if (!operation) {
        throw new Error('Video generation did not start an operation.');
    }

    // Poll the operation until it's complete. This can take a while.
    while (!operation.done) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        operation = await ai.checkOperation(operation);
    }
    
    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const videoPart = operation.output?.message?.content.find((p) => !!p.media);
    if (!videoPart) {
        throw new Error('No video was found in the operation result.');
    }
    
    const videoDataUri = await getVideoAsDataUri(videoPart);

    return {
        videoUrl: videoDataUri,
    };
  }
);
