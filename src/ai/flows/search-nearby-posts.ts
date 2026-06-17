'use server';
/**
 * @fileOverview Secure, high-precision geo-fencing lookup engine for Lonkind feeds.
 * Resolves Firestore range evaluation restrictions by handling neighborhood cluster 
 * aggregation and real-time chronological sorting on the server layer.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin'; // Use server-side admin instance
import ngeohash from 'ngeohash';

const SearchNearbyPostsInputSchema = z.object({
  geohash: z.string().trim().describe('The primary geohash string tracking the active user\'s coordinate locus.'),
});
export type SearchNearbyPostsInput = z.infer<typeof SearchNearbyPostsInputSchema>;

const PostSchema = z.object({
  id: z.string(),
  content: z.string(),
  author: z.object({
    name: z.string(),
    handle: z.string(),
    avatarUrl: z.string(),
    uid: z.string(),
    isProfessional: z.boolean().optional(),
  }),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  geohash: z.string().optional(),
  createdAt: z.string().describe('ISO string representation of the post timestamp.'),
});

const SearchNearbyPostsOutputSchema = z.object({
  posts: z.array(PostSchema).describe('A chronologically sorted list of adjacent geographic timeline events.'),
});
export type SearchNearbyPostsOutput = z.infer<typeof SearchNearbyPostsOutputSchema>;

export async function searchNearbyPosts(input: SearchNearbyPostsInput): Promise<SearchNearbyPostsOutput> {
  return searchNearbyPostsFlow(input);
}

const searchNearbyPostsFlow = ai.defineFlow(
  {
    name: 'searchNearbyPostsFlow',
    inputSchema: SearchNearbyPostsInputSchema,
    outputSchema: SearchNearbyPostsOutputSchema,
  },
  async ({ geohash }) => {
    if (!geohash) {
      return { posts: [] };
    }

    try {
      /**
       * 1. Resolve Geographic Grid Boundaries
       * Truncating a geohash to 5 characters creates an operational boundary grid area 
       * of approximately 4.9km x 4.9km. To stop posts on the immediate other side of 
       * a grid edge from disappearing, we calculate the current block plus its 8 neighboring grids.
       */
      const coreGrid = geohash.substring(0, 5);
      const targetNeighbors = ngeohash.neighbors(coreGrid);
      const processingGrids = [coreGrid, ...targetNeighbors];

      const postsCollectionRef = adminDb.collection('posts');
      
      /**
       * 2. Parallel Query Dispatch
       * Because Firestore limits single-field string range comparisons, we map over 
       * our localized geographic clusters in parallel to pool match collections efficiently.
       */
      const queryPromises = processingGrids.map((gridCell) => {
        return postsCollectionRef
          .where('geohash', '>=', gridCell)
          .where('geohash', '<=', gridCell + '\uf8ff')
          .limit(15) // Limit pool collection density per localized cell
          .get();
      });

      const snapshots = await Promise.all(queryPromises);
      const consolidatedPosts: any[] = [];

      // 3. Process data packets into unified structures
      snapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // Deduplicate if any posts cross grid line calculations
          if (!consolidatedPosts.some(p => p.id === doc.id)) {
            // Safe conversion of Firestore server Timestamps to serializable string signatures
            const timestampValue = data.timestamp?.toDate 
              ? data.timestamp.toDate().toISOString() 
              : new Date().toISOString();

            consolidatedPosts.push({
              id: doc.id,
              content: data.content || '',
              author: data.author || { name: 'Anonymous', handle: 'anonymous', avatarUrl: '', uid: '' },
              imageUrl: data.imageUrl,
              videoUrl: data.videoUrl,
              geohash: data.geohash,
              createdAt: timestampValue,
            });
          }
        });
      });

      /**
       * 4. Multi-Index Memory Sorting Block
       * Overcomes Firestore's index range restriction by running lightning-fast 
       * chronological array comparisons directly inside your node server execution environment.
       */
      const chronologicallySortedPosts = consolidatedPosts
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 25); // Return the top 25 newest hyper-local feed records

      return { posts: chronologicallySortedPosts };

    } catch (error) {
      console.error('Hyper-local timeline geo-query compilation execution failed:', error);
      return { posts: [] };
    }
  }
);