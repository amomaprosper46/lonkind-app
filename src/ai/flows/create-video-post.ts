'use server';
/**
 * @fileOverview A Genkit flow for creating a new post with an AI-generated video.
 *
 * - createVideoPost - A function that creates a new post with a video data URI.
 * - CreateVideoPostInput - The input type for the function.
 * - CreateVideoPostOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const CreateVideoPostInputSchema = z.object({
  story: z.string().describe('The original story text for the post content.'),
  videoDataUri: z.string().describe("The AI-generated video as a data URI."),
  authorUid: z.string().describe("The UID of the user posting the video."),
});
export type CreateVideoPostInput = z.infer<typeof CreateVideoPostInputSchema>;

const CreateVideoPostOutputSchema = z.object({
  postId: z.string(),
});
export type CreateVideoPostOutput = z.infer<typeof CreateVideoPostOutputSchema>;


export async function createVideoPost(input: CreateVideoPostInput): Promise<CreateVideoPostOutput> {
    return createVideoPostFlow(input);
}


const createVideoPostFlow = ai.defineFlow(
  {
    name: 'createVideoPostFlow',
    inputSchema: CreateVideoPostInputSchema,
    outputSchema: CreateVideoPostOutputSchema,
  },
  async ({ story, videoDataUri, authorUid }) => {
    // 1. Get author details
    const userDocRef = doc(db, 'users', authorUid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        throw new Error(`User with UID ${authorUid} not found.`);
    }
    const author = userDoc.data();

    // 2. Upload the video from data URI to Firebase Storage
    const videoRef = ref(storage, `posts/${authorUid}/video-story-${Date.now()}.mp4`);
    const snapshot = await uploadString(videoRef, videoDataUri, 'data_url');
    const videoUrl = await getDownloadURL(snapshot.ref);

    // 3. Create the post document in Firestore
    const postsCollectionRef = collection(db, 'posts');
    const newPostDoc = await addDoc(postsCollectionRef, {
        author: {
            name: author.name,
            handle: author.handle,
            avatarUrl: author.avatarUrl,
            uid: author.uid,
            isProfessional: author.isProfessional || false,
        },
        content: story,
        videoUrl: videoUrl, // The public URL of the uploaded video
        reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
        comments: 0,
        timestamp: serverTimestamp(),
        groupId: null, // Ensure this post is not associated with a group
    });
      
    return { postId: newPostDoc.id };
  }
);
