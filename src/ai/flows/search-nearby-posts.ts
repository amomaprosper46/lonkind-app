'use server';
/**
 * @fileOverview A Genkit flow for searching posts by geohash.
 *
 * - searchNearbyPosts - A function that takes a geohash and returns matching posts.
 * - SearchNearbyPostsInput - The input type for the function.
 * - SearchNearbyPostsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Post } from '@/components/social/post-card';
import ngeohash from 'ngeohash';

const SearchNearbyPostsInputSchema = z.object({
  geohash: z.string().describe('The geohash string to search around.'),
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
    // We can't easily include a typed timestamp here from Firestore server values
});

const SearchNearbyPostsOutputSchema = z.object({
  posts: z.array(PostSchema).describe('A list of posts that are nearby.'),
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
    if (!geohash.trim()) {
        return { posts: [] };
    }
    
    // Query for posts with the same geohash prefix (e.g., first 5 chars)
    // This gives us a square-shaped area around the user.
    const searchGeohash = geohash.substring(0, 5);

    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('geohash', '>=', searchGeohash),
      where('geohash', '<=', searchGeohash + '\uf8ff'),
      orderBy('geohash'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    const querySnapshot = await getDocs(q);
    
    const posts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure content is a string and other fields exist
        return { 
            id: doc.id,
            content: data.content || '',
            author: data.author,
            imageUrl: data.imageUrl,
            videoUrl: data.videoUrl,
            reactions: data.reactions,
            comments: data.comments,
            timestamp: data.timestamp,
            geohash: data.geohash,
        } as Post;
    });
    
    return { posts };
  }
);
