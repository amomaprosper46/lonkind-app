'use server';
/**
 * @fileOverview A Genkit flow for searching posts.
 *
 * - searchPosts - A function that takes a query and returns matching posts.
 * - SearchPostsInput - The input type for the searchPosts function.
 * - SearchPostsOutput - The return type for the searchPosts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Post } from '@/components/social/post-card';

const SearchPostsInputSchema = z.object({
  searchText: z.string().describe('The text to search for in post content.'),
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
});

const SearchPostsOutputSchema = z.object({
  posts: z.array(PostSchema).describe('A list of posts that match the search query.'),
});
export type SearchPostsOutput = z.infer<typeof SearchPostsOutputSchema>;

export async function searchPosts(input: SearchPostsInput): Promise<SearchPostsOutput> {
  return searchPostsFlow(input);
}

const searchPostsFlow = ai.defineFlow(
  {
    name: 'searchPostsFlow',
    inputSchema: SearchPostsInputSchema,
    outputSchema: SearchPostsOutputSchema,
  },
  async ({ searchText }) => {
    if (!searchText.trim()) {
        return { posts: [] };
    }
    
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('content', '>=', searchText),
      where('content', '<=', searchText + '\uf8ff'),
      limit(5)
    );

    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
    
    return { posts: posts.map(p => ({...p, content: p.content || ''})) };
  }
);
