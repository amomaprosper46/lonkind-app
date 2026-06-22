'use server';
/**
 * @fileOverview AI-powered profile roast bio generator with integrated coin economy.
 * Generates funny, shareable roast bios based on a user's profile data.
 * Charges 1 coin per generation to protect server resources.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin';

// 1. Added userId to the schema to track coin deduction
const RoastInputSchema = z.object({
  userId: z.string().describe('The UID of the user requesting the roast.'),
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
export type RoastInput = z.infer<typeof RoastInputSchema>;

// 2. Adjusted output schema to communicate success/failure state to the UI
const RoastOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  roastBio: z.string().optional().describe('The generated roast bio. Max 160 characters, punchy and hilarious.'),
  roastTitle: z.string().optional().describe('A short, catchy title for the roast (e.g. "The Verdict Is In 🔥").'),
  savageryLevel: z.number().optional().min(1).max(10).describe('How savage the roast is on a scale of 1-10.'),
  emoji: z.string().optional().describe('A single emoji that best represents this roast.'),
});
export type RoastOutput = z.infer<typeof RoastOutputSchema>;

export const generateProfileRoast = ai.defineFlow(
  {
    name: 'generateProfileRoast',
    inputSchema: RoastInputSchema,
    outputSchema: RoastOutputSchema,
  },
  async (input) => {
    const userRef = adminDb.collection('users').doc(input.userId);

    try {
      let balanceSufficient = false;

      // 3. Atomically check and deduct 1 coin before hitting the LLM API
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User profile not found.');
        }

        const currentCoins = userDoc.data()?.coins || 0;

        if (currentCoins < 1) {
          balanceSufficient = false;
          return;
        }

        balanceSufficient = true;
        transaction.update(userRef, {
          coins: admin.firestore.FieldValue.increment(-1)
        });
      });

      if (!balanceSufficient) {
        return {
          success: false,
          message: 'Insufficient coins. Please buy more coins to generate a profile roast.',
        };
      }

      // 4. Gather the stats context for the AI prompt
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

      // 5. Fire Genkit generation
      const { output } = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
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
          schema: z.object({
            roastBio: z.string(),
            roastTitle: z.string(),
            savageryLevel: z.number().min(1).max(10),
            emoji: z.string(),
          }),
        },
      });

      if (!output) {
        throw new Error('AI failed to generate a roast. Even the AI is speechless.');
      }

      return {
        success: true,
        message: 'Profile roasted successfully! 1 coin deducted.',
        roastBio: output.roastBio,
        roastTitle: output.roastTitle,
        savageryLevel: output.savageryLevel,
        emoji: output.emoji,
      };

    } catch (error: any) {
      console.error('Profile roast generation failed:', error);
      return {
        success: false,
        message: error.message || 'An error occurred while generating the profile roast.',
      };
    }
  }
);