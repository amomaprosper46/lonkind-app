'use server';

/**
 * @fileOverview Secure full-text keyword search routing engine for Lonkind.
 * Transitions from restrictive prefix matching to tokenized array element validation.
 *
 * - searchPosts - A function that searches posts by tokenized keyword clusters.
 * - SearchPostsInput - The input type for the searchPosts function.
 * - SearchPostsOutput - The return type for the searchPosts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin';

const SearchPostsInputSchema = z.object({
  searchText: z.string().trim().describe('The text queries to filter post content with.'),
});
export type SearchPostsInput = z.infer<typeof SearchPostsInputSchema>;

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
  createdAt: z.string().describe('ISO string representation of the post timestamp.'),
});

const SearchPostsOutputSchema = z.object({
  posts: z.array(PostSchema).describe('A list of posts that match the search token keys.'),
});
export type SearchPostsOutput = z.infer<typeof SearchPostsOutputSchema>;

/**
 * Clean Server Action Wrapper
 * This acts as the secure execution barrier that Next.js tracing safely recognizes.
 */
export async function searchPosts(input: SearchPostsInput): Promise<SearchPostsOutput> {
  const { searchText } = input;
  if (!searchText) {
    return { posts: [] };
  }

  try {
    // 1. Tokenize the Search Input into lowercase match clusters
    const searchTokens = searchText
      .toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 1)
      .slice(0, 10); // Firestore maximum capacity limit for array-contains-any

    if (searchTokens.length === 0) {
      return { posts: [] };
    }

    const postsCollectionRef = adminDb.collection('posts');

    // 2. Query execution leveraging high-performance array filters
    const querySnapshot = await postsCollectionRef
      .where('searchKeywords', 'array-contains-any', searchTokens)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const posts: any[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      const timestampValue = data.timestamp?.toDate 
        ? data.timestamp.toDate().toISOString() 
        : new Date().toISOString();

      posts.push({
        id: doc.id,
        content: data.content || '',
        author: data.author || { name: 'Anonymous', handle: 'anonymous', avatarUrl: '', uid: '' },
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        createdAt: timestampValue,
      });
    });

    return { posts };

  } catch (error) {
    console.error('Full-text document index search execution failed:', error);
    return { posts: [] };
  }
}

// Register Genkit registration tracing schema for background orchestration tracking logs
export const searchPostsFlow = ai.defineFlow(
  {
    name: 'searchPostsFlow',
    inputSchema: SearchPostsInputSchema,
    outputSchema: SearchPostsOutputSchema,
  },
  async (input) => {
    return searchPosts(input);
  }
);