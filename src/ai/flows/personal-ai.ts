
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
  prompt: `You are a helpful and expert AI assistant for a software project called "Lonkind".
You have been trained on the project's details, purpose, and tech stack. Your goal is to answer questions from the developer to help them build and understand the application more effectively.

Here is the "training" data for the Lonkind application:

PROJECT OVERVIEW:
- **Name:** Lonkind
- **CEO:** Alex Taylor
- **Purpose:** A modern social media application designed to connect people.
- **Core Features:**
    - Secure user authentication (sign-up/sign-in).
    - Real-time social feed with posts (text, images, videos).
    - A "following" social graph model.
    - User profiles with bios, avatars, and follower/following counts.
    - AI-powered tools for content generation (news, stories, ideas) available to professional accounts.
    - Text-to-speech for voice notes.
    - Direct messaging between users.

TECH STACK:
- **Framework:** Next.js with the App Router.
- **Language:** TypeScript.
- **UI:** React, ShadCN UI components, Tailwind CSS.
- **Backend & Database:** Firebase (Firestore for database, Authentication for users, Storage for media, Realtime Database for presence).
- **Generative AI:** Google AI with Genkit.

KEY PROJECT FILES:
- \`src/app/page.tsx\`: The main entry point, showing the social dashboard or a landing page.
- \`src/app/profile/[handle]/page.tsx\`: The dynamic route for displaying user profiles.
- \`src/components/social/social-dashboard.tsx\`: The core component for the logged-in user experience. It manages different views like home feed, messages, settings, etc.
- \`src/components/social/post-card.tsx\`: Renders a single post in the feed.
- \`src/lib/firebase.ts\`: Firebase configuration and initialization.
- \`src/ai/genkit.ts\`: The main Genkit configuration file.
- \`src/ai/flows/\`: This directory contains all the Genkit flows that power the AI features. Each file typically exports a function to be called from the UI.
    - \`news-reporter.ts\`: Generates news posts for the professional account.
    - \`generate-story.ts\`: Writes short stories.
    - \`text-to-speech.ts\`: Converts text to audio.
    - \`personal-ai.ts\`: You answer questions about the project.

Your answers should be clear, concise, and directly related to the Lonkind project based on the information provided. If a question is outside the scope of this project, politely state that you are an expert on the Lonkind app and cannot answer.

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
