'use server';
/**
 * @fileOverview A Genkit flow for adding dummy followers to a user.
 *
 * - addDummyFollowers - A function that adds a specified number of followers to a user.
 * - AddDummyFollowersInput - The input type for the addDummyFollowers function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { z } from 'genkit';

const AddDummyFollowersInputSchema = z.object({
  userId: z.string().describe('The ID of the user to add followers to.'),
  count: z.number().describe('The number of dummy followers to add.'),
});
export type AddDummyFollowersInput = z.infer<typeof AddDummyFollowersInputSchema>;

export async function addDummyFollowers(input: AddDummyFollowersInput): Promise<void> {
  return addDummyFollowersFlow(input);
}

const addDummyFollowersFlow = ai.defineFlow(
  {
    name: 'addDummyFollowersFlow',
    inputSchema: AddDummyFollowersInputSchema,
    outputSchema: z.void(),
  },
  async ({ userId, count }) => {
    const followersCollectionRef = collection(db, 'users', userId, 'followers');
    const batchSize = 500; // Firestore batch limit

    for (let i = 0; i < count; i += batchSize) {
      const batch = writeBatch(db);
      const limit = Math.min(batchSize, count - i);
      
      for (let j = 0; j < limit; j++) {
        const followerId = `dummy_follower_${i + j}`;
        const followerDocRef = doc(followersCollectionRef, followerId);
        batch.set(followerDocRef, {
            name: 'Dummy Follower',
            handle: `dummy${i+j}`,
            avatarUrl: 'https://placehold.co/100x100.png',
        });
      }
      await batch.commit();
    }
  }
);
