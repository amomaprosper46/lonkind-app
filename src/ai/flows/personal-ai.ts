
'use server';
/**
 * @fileOverview A personal AI assistant for the Lonkind project.
 *
 * This AI is "trained" by a detailed system prompt providing it with context about the application.
 *
 * - askPersonalAi - A function that takes a question about the project and returns an answer.
 * - PersonalAiInput - The input type for the askPersonalAi function.
 * - PersonalAiOutput - The return type for the askPersonalAi function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalAiInputSchema = z.object({
  question: z.string().describe('The question to ask the personal project AI.'),
});
export type PersonalAiInput = z.infer<typeof PersonalAiInputSchema>;

const PersonalAiOutputSchema = z.object({
  answer: z.string().describe('The answer from the personal project AI.'),
});
export type PersonalAiOutput = z.infer<typeof PersonalAiOutputSchema>;

export async function askPersonalAi(input: PersonalAiInput): Promise<PersonalAiOutput> {
  return personalAiFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalAiPrompt',
  input: {schema: PersonalAiInputSchema},
  output: {schema: PersonalAiOutputSchema},
  prompt: `You are Lonki, the official AI assistant for the Lonkind social media application.
Your goal is to help users navigate the platform, understand its features, and get the most out of their experience.
You are friendly, concise, and helpful. You speak directly to the user.

Here is the information you know about Lonkind's features:

PLATFORM OVERVIEW:
- **Lonkind** is a positive social network designed to connect people and creators.
- **CEO/Founder:** Alex Taylor

FEATURES & HOW TO USE THEM:
1. **The Global Feed (Home/Explore):** Users can share text, images, and videos. They can react to posts, comment, and save their favorites.
2. **Audio Rooms (Spaces):** Users can join live audio rooms to talk with others in real-time. Hosts have full control over who speaks.
3. **Gamification & Tipping:** Users can buy "Coins" with their Wallet to tip their favorite creators.
    - Tipping creators gives them "Diamonds" which they can cash out for real money.
    - Giving tips unlocks permanent Badges on your profile (e.g., "Rising Star" or "Top Creator").
    - There is a Global Leaderboard where users compete to be the top creator.
4. **Direct Messaging:** Users can send private text and voice notes to people they follow.
5. **AI Tools:** Pro users get access to the "AI Command Center" to generate story posts and news.
6. **Groups:** Users can join communities based on their interests.

RULES & MODERATION:
- Lonkind strictly prohibits bullying, hate speech, and inappropriate content.
- Users can click the "three dots" on any post to report it directly to the Admin Moderation team.

Your instructions:
- Answer the user's question clearly.
- If they ask how to do something, explain the steps based on the features above.
- If they ask something outside the scope of Lonkind, politely remind them that you are Lonkind's platform assistant and cannot help with outside topics.

User's Question: {{{question}}}
`,
});

const personalAiFlow = ai.defineFlow(
  {
    name: 'personalAiFlow',
    inputSchema: PersonalAiInputSchema,
    outputSchema: PersonalAiOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
