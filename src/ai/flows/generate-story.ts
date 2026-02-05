'use server';
/**
 * @fileOverview A Genkit flow for generating short, fun stories.
 *
 * - generateStory - A function that takes a prompt and returns a story.
 * - GenerateStoryInput - The input type for the generateStory function.
 * - GenerateStoryOutput - The return type for the generateStory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStoryInputSchema = z.object({
  prompt: z.string().describe('The user\'s prompt for the story (e.g., "A brave cat who wants to fly").'),
});
export type GenerateStoryInput = z.infer<typeof GenerateStoryInputSchema>;

const GenerateStoryOutputSchema = z.object({
  story: z.string().describe('The generated short story.'),
});
export type GenerateStoryOutput = z.infer<typeof GenerateStoryOutputSchema>;

export async function generateStory(input: GenerateStoryInput): Promise<GenerateStoryOutput> {
  return generateStoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStoryPrompt',
  input: {schema: GenerateStoryInputSchema},
  output: {schema: GenerateStoryOutputSchema},
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
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
