'use server';
/**
 * @fileOverview A Genkit flow for adding dummy followers to a user.
 *
 * - addDummyFollowers - A function that adds a specified number of followers to a user.
 * - AddDummyFollowersInput - The input type for the addDummyFollowers function.
 */

import { ai } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'genkit';

const AddDummyFollowersInputSchema = z.object({
  userId: z.string().describe('The ID of the user to add followers to.'),
  count: z.number().min(1).max(500).describe('The number of dummy followers to add (max 500).'),
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
    // Only allow adding dummy followers to admin or test accounts
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.data();
    const adminSnap = await adminDb.collection('admins').doc(userId).get();
    const isAdmin =
      adminSnap.exists ||
      userData?.email === 'admin@lonkind.com' ||
      userData?.handle === 'admin_lonkind' ||
      userData?.role === 'admin';

    if (!isAdmin) {
      throw new Error('Unauthorized: Only administrators can run dummy follower seeding.');
    }

    const safeCount = Math.min(Math.max(1, count), 500);
    const followersCollectionRef = adminDb.collection('users').doc(userId).collection('followers');
    const batch = adminDb.batch();

    for (let j = 0; j < safeCount; j++) {
      const followerId = `dummy_follower_${j}`;
      const followerDocRef = followersCollectionRef.doc(followerId);
      batch.set(followerDocRef, {
        name: 'Dummy Follower',
        handle: `dummy${j}`,
        avatarUrl: 'https://placehold.co/100x100.png',
      });
    }
    await batch.commit();
  }
);
