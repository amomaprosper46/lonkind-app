
'use server';
/**
 * @fileOverview A Genkit flow for generating impactful ideas.
 *
 * - generateIdeas - A function that takes a topic and keywords and returns a list of ideas.
 * - GenerateIdeasInput - The input type for the generateIdeas function.
 * - GenerateIdeasOutput - The return type for the generateIdeas function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the input schema using Zod
const GenerateIdeasInputSchema = z.object({
  topic: z.string().describe('The main topic for the ideas (e.g., Renewable Energy)'),
  keywords: z.string().describe('Comma-separated keywords to focus on (e.g., solar, community, affordable)'),
  scope: z.string().optional().describe('The scope of the ideas (e.g., local communities, global scale)'),
});
export type GenerateIdeasInput = z.infer<typeof GenerateIdeasInputSchema>;

// Define the output schema using Zod
const GenerateIdeasOutputSchema = z.object({
  ideas: z.array(z.string()).describe('A list of generated idea strings.'),
});
export type GenerateIdeasOutput = z.infer<typeof GenerateIdeasOutputSchema>;


// The main exported function that calls the flow
export async function generateIdeas(input: GenerateIdeasInput): Promise<GenerateIdeasOutput> {
  return generateIdeasFlow(input);
}


// Define the prompt for the AI model
const ideasPrompt = ai.definePrompt({
    name: 'ideasPrompt',
    input: { schema: GenerateIdeasInputSchema },
    output: { schema: GenerateIdeasOutputSchema },
    prompt: `You are an expert at brainstorming innovative and impactful ideas.
    Generate a list of 3 creative ideas based on the following criteria.
    Return your response as a list of strings in the 'ideas' field.

    Topic: {{{topic}}}
    Keywords: {{{keywords}}}
    {{#if scope}}
    Scope: {{{scope}}}
    {{/if}}
    `,
});


// Define the main Genkit flow
const generateIdeasFlow = ai.defineFlow(
  {
    name: 'generateIdeasFlow',
    inputSchema: GenerateIdeasInputSchema,
    outputSchema: GenerateIdeasOutputSchema,
  },
  async (input) => {
    const { output } = await ideasPrompt(input);
    return output!;
  }
);
