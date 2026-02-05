'use server';
/**
 * @fileOverview A Genkit flow for generating a news post.
 *
 * - generateNewsPost - A function that takes a topic and returns a social media post.
 * - GenerateNewsPostInput - The input type for the generateNewsPost function.
 * - GenerateNewsPostOutput - The return type for the generateNewsPost function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNewsPostInputSchema = z.object({
  topic: z.string().describe('The topic for the news post (e.g., "World News", "Technology").'),
});
export type GenerateNewsPostInput = z.infer<typeof GenerateNewsPostInputSchema>;

const GenerateNewsPostOutputSchema = z.object({
  postContent: z.string().describe('The generated content for the social media post, written in an engaging and informative tone. Should be about 2-3 sentences.'),
});
export type GenerateNewsPostOutput = z.infer<typeof GenerateNewsPostOutputSchema>;

export async function generateNewsPost(input: GenerateNewsPostInput): Promise<GenerateNewsPostOutput> {
  return newsReporterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'newsReporterPrompt',
  input: {schema: GenerateNewsPostInputSchema},
  output: {schema: GenerateNewsPostOutputSchema},
  prompt: `You are an expert news reporter and social media manager for the Lonkind app. 
  
Your task is to find a very recent, interesting, and globally relevant news story based on the provided topic.

Write a short, engaging, and neutral social media post (2-3 sentences) summarizing the news. The post should be informative and easy to understand for a general audience. Start the post with an appropriate emoji.

Topic: {{{topic}}}
`,
});

const newsReporterFlow = ai.defineFlow(
  {
    name: 'newsReporterFlow',
    inputSchema: GenerateNewsPostInputSchema,
    outputSchema: GenerateNewsPostOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
