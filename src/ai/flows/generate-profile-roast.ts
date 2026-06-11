'use server';
/**
 * @fileOverview AI-powered profile roast bio generator.
 * Generates funny, shareable roast bios based on a user's profile data.
 * Designed to create viral content users will screenshot and share on social media.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RoastInputSchema = z.object({
  name: z.string().describe('The display name of the user being roasted.'),
  handle: z.string().describe('The username/handle of the user.'),
  bio: z.string().optional().describe('The current bio of the user, if any.'),
  postCount: z.number().optional().describe('Number of posts the user has made.'),
  followersCount: z.number().optional().describe('Number of followers.'),
  followingCount: z.number().optional().describe('Number of accounts they follow.'),
  isProfessional: z.boolean().optional().describe('Whether the user has a professional/verified badge.'),
  badges: z.array(z.string()).optional().describe('Any badges the user has earned.'),
  style: z.enum(['savage', 'playful', 'wholesome-roast']).default('playful').describe('The roast style.'),
});

const RoastOutputSchema = z.object({
  roastBio: z.string().describe('The generated roast bio. Max 160 characters, punchy and hilarious.'),
  roastTitle: z.string().describe('A short, catchy title for the roast (e.g. "The Verdict Is In 🔥").'),
  savageryLevel: z.number().min(1).max(10).describe('How savage the roast is on a scale of 1-10.'),
  emoji: z.string().describe('A single emoji that best represents this roast.'),
});

export const generateProfileRoast = ai.defineFlow(
  {
    name: 'generateProfileRoast',
    inputSchema: RoastInputSchema,
    outputSchema: RoastOutputSchema,
  },
  async (input) => {
    const statsContext = [
      input.postCount !== undefined ? `They have ${input.postCount} posts.` : '',
      input.followersCount !== undefined ? `They have ${input.followersCount} followers.` : '',
      input.followingCount !== undefined ? `They follow ${input.followingCount} people.` : '',
      input.isProfessional ? 'They have a verified/professional badge.' : '',
      input.badges?.length ? `Their badges: ${input.badges.join(', ')}.` : '',
      input.bio ? `Their current bio says: "${input.bio}"` : 'They have no bio set.',
    ].filter(Boolean).join(' ');

    const styleGuide = {
      'savage': 'Be brutally funny. Think comedy roast level humor. No mercy but keep it clever, not mean-spirited. Use wordplay and unexpected twists.',
      'playful': 'Be lighthearted and fun. Think friendly teasing between best friends. Witty observations, gentle ribbing.',
      'wholesome-roast': 'Roast them but in a way that is secretly a compliment. Backhanded compliments that make them laugh and feel good.',
    };

    const { output } = await ai.generate({
      prompt: `You are the funniest bio writer on the internet. Your roast bios go viral on Twitter and TikTok because they are hilariously accurate and quotable.

Generate a ROAST BIO for this user's social media profile:

**Name:** ${input.name}
**Handle:** @${input.handle}
${statsContext}

**Style:** ${styleGuide[input.style]}

RULES:
- The roast bio MUST be under 160 characters (this is a hard limit)
- Make it screenshot-worthy — people should WANT to share this on Twitter/TikTok
- Use modern internet humor, gen-z slang is OK
- Include 1-2 relevant emojis in the bio
- The roastTitle should be catchy and short (under 30 characters)
- Rate the savagery level honestly from 1-10
- Pick ONE emoji that captures the whole roast vibe

DO NOT:
- Be actually hurtful or discriminatory
- Reference sensitive topics (race, religion, sexuality, disability)
- Use profanity
- Be generic — make it specific to THIS user's stats and profile`,
      output: {
        schema: RoastOutputSchema,
      },
    });

    if (!output) {
      throw new Error('AI failed to generate a roast. Even the AI is speechless.');
    }

    return output;
  }
);
