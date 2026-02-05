
'use server';
/**
 * @fileOverview A Genkit flow for creating a new group.
 *
 * - createGroup - A function that creates a new group, generating a cover image.
 * - CreateGroupInput - The input type for the function.
 * - CreateGroupOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateImage } from './generate-image';

const CreateGroupInputSchema = z.object({
  name: z.string().describe('The name of the group.'),
  description: z.string().describe('A short description of the group.'),
  creator: z.object({
      uid: z.string(),
      name: z.string(),
      handle: z.string(),
  })
});
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;

const CreateGroupOutputSchema = z.object({
  groupId: z.string(),
});
export type CreateGroupOutput = z.infer<typeof CreateGroupOutputSchema>;


export async function createGroup(input: CreateGroupInput): Promise<CreateGroupOutput> {
    return createGroupFlow(input);
}


const createGroupFlow = ai.defineFlow(
  {
    name: 'createGroupFlow',
    inputSchema: CreateGroupInputSchema,
    outputSchema: CreateGroupOutputSchema,
  },
  async ({ name, description, creator }) => {
    // Generate a cover image based on the group name.
    const imageResult = await generateImage({ 
        prompt: `A vibrant and abstract background image for a social media group called "${name}". Digital art, header image.` 
    });

    const groupsCollectionRef = collection(db, 'groups');
    
    const newGroupDoc = await addDoc(groupsCollectionRef, {
        name,
        description,
        coverUrl: imageResult.imageUrl,
        createdAt: serverTimestamp(),
        createdBy: creator.uid,
        memberCount: 1,
        members: [creator.uid],
    });
      
    return { groupId: newGroupDoc.id };
  }
);
