'use server';
/**
 * @fileOverview A simple AI assistant flow.
 *
 * - askAssistant - A function that takes a question and returns an answer.
 * - AssistantInput - The input type for the askAssistant function.
 * - AssistantOutput - The return type for the askAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssistantInputSchema = z.object({
  question: z.string().describe('The question to ask the assistant.'),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;

const AssistantOutputSchema = z.object({
  answer: z.string().describe('The answer from the assistant.'),
});
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;

export async function askAssistant(input: AssistantInput): Promise<AssistantOutput> {
  return assistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: {schema: AssistantInputSchema},
  output: {schema: AssistantOutputSchema},
  prompt: `You are a helpful, empathetic, and responsible AI assistant for the Lonkind social media app. Your primary goal is to create a positive and safe user experience.

- Always be polite, patient, and understanding.
- If a user is frustrated, angry, or uses negative language, respond with extra care and empathy. Do not argue or become defensive. Instead, offer help and de-escalate the situation.
- Never generate responses that are rude, dismissive, or controversial.
- Your answers should be concise, clear, and genuinely helpful.

User Question: {{{question}}}`,
});

const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantInputSchema,
    outputSchema: AssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
