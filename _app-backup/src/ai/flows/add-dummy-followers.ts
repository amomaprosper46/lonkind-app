'use server';
/**
 * @fileOverview A Genkit flow for adding dummy friends to a user.
 *
 * - addDummyFriends - A function that adds a specified number of friends to a user.
 * - AddDummyFriendsInput - The input type for the addDummyFriends function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { writeBatch, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { z } from 'genkit';

const AddDummyFriendsInputSchema = z.object({
  userId: z.string().describe('The ID of the user to add friends to.'),
  count: z.number().describe('The number of dummy friends to add.'),
});
export type AddDummyFriendsInput = z.infer<typeof AddDummyFriendsInputSchema>;

export async function addDummyFriends(input: AddDummyFriendsInput): Promise<void> {
  return addDummyFriendsFlow(input);
}

const addDummyFriendsFlow = ai.defineFlow(
  {
    name: 'addDummyFriendsFlow',
    inputSchema: AddDummyFriendsInputSchema,
    outputSchema: z.void(),
  },
  async ({ userId, count }) => {
    const batchSize = 499; // Firestore batch limit is 500, do 2 operations per friend

    for (let i = 0; i < count; i += batchSize) {
      const batch = writeBatch(db);
      const limit = Math.min(batchSize, count - i);
      
      for (let j = 0; j < limit; j++) {
        const friendId = `dummy_friend_${i + j}`;
        
        const myFriendRef = doc(db, 'users', userId, 'friends', friendId);
        batch.set(myFriendRef, {
            name: 'Dummy Friend',
            handle: `dummy${i+j}`,
            avatarUrl: 'https://placehold.co/100x100.png',
            timestamp: serverTimestamp(),
        });

        // In a real scenario, you'd have a reciprocal relationship.
        // For dummy data, we just increment the main user's count.
      }
       const userRef = doc(db, 'users', userId);
       batch.update(userRef, { friendsCount: increment(limit) });

      await batch.commit();
    }
  }
);
