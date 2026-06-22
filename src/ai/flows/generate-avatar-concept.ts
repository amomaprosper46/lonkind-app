'use server';
/**
 * @fileOverview AI-powered avatar style suggestion generator.
 * Generates creative avatar description prompts that users can use
 * to visualize unique profile pictures.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AvatarInputSchema = z.object({
  name: z.string().describe('The display name of the user.'),
  handle: z.string().describe('The username/handle of the user.'),
  bio: z.string().optional().describe('The current bio of the user.'),
  style: z.enum([
    'anime',
    'cyberpunk',
    'cartoon',
    'pixel-art',
    'watercolor',
    'fantasy',
    'minimalist',
    'afrofuturism',
  ]).describe('The art style for the avatar.'),
  mood: z.enum(['cool', 'fierce', 'chill', 'mysterious', 'happy', 'boss']).default('cool').describe('The mood/vibe of the avatar.'),
});

const AvatarOutputSchema = z.object({
  avatarDescription: z.string().describe('A vivid, detailed description of the generated avatar concept (2-3 sentences). This describes what the avatar looks like.'),
  avatarTitle: z.string().describe('A catchy name for this avatar style (e.g., "Neon Samurai", "Pixel King").'),
  colorPalette: z.array(z.string()).describe('3-4 hex color codes that define the avatar color scheme.'),
  shareCaption: z.string().describe('A short, viral caption the user can post with the avatar on social media (under 100 chars).'),
});

export const generateAvatarConcept = ai.defineFlow(
  {
    name: 'generateAvatarConcept',
    inputSchema: AvatarInputSchema,
    outputSchema: AvatarOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `You are a creative avatar designer for a social media platform called Lonkind. Your job is to create UNIQUE, STUNNING avatar concepts that users will love and want to show off.

Generate a custom avatar concept for this user:

**Name:** ${input.name}
**Handle:** @${input.handle}
**Bio:** ${input.bio || 'No bio set'}
**Style:** ${input.style}
**Mood:** ${input.mood}

RULES:
- The avatar description should be vivid and specific — imagine you're describing it to an artist
- Make it PERSONAL to this user (use their name/handle for inspiration)
- The color palette should match the style and mood perfectly
- The shareCaption should be catchy and under 100 characters
- The avatarTitle should be 2-3 words max, memorable and cool
- Make it something people would WANT as their profile picture
- Think about what would look amazing as a small circular profile picture

Style guidelines:
- anime: Clean lines, big expressive eyes, dynamic poses, vibrant colors
- cyberpunk: Neon lights, tech implants, dark backgrounds, glitch effects
- cartoon: Fun proportions, bold outlines, bright saturated colors
- pixel-art: Retro 16-bit style, chunky pixels, nostalgic palette
- watercolor: Soft flowing colors, artistic splatters, dreamy atmosphere
- fantasy: Magical elements, ethereal glow, mystical creatures/symbols
- minimalist: Clean shapes, limited palette, elegant simplicity
- afrofuturism: African-inspired patterns, futuristic tech, rich earth tones mixed with metallics`,
      output: {
        schema: AvatarOutputSchema,
      },
    });

    if (!output) {
      throw new Error('AI failed to generate an avatar concept.');
    }

    return output;
  }
);
