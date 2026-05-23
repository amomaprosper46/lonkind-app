'use server';
/**
 * @fileOverview A Genkit flow for creating or retrieving a conversation between two users.
 *
 * - createOrGetConversation - A function that takes two user IDs and returns a conversation ID.
 * - CreateOrGetConversationInput - The input type for the function.
 * - CreateOrGetConversationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CreateOrGetConversationInputSchema = z.object({
  currentUser: z.object({
    uid: z.string(),
    name: z.string(),
    avatarUrl: z.string(),
  }),
  targetUser: z.object({
    uid: z.string(),
    name: z.string(),
    avatarUrl: z.string(),
  }),
});
export type CreateOrGetConversationInput = z.infer<typeof CreateOrGetConversationInputSchema>;

const CreateOrGetConversationOutputSchema = z.object({
  conversationId: z.string(),
});
export type CreateOrGetConversationOutput = z.infer<typeof CreateOrGetConversationOutputSchema>;


export async function createOrGetConversation(input: CreateOrGetConversationInput): Promise<CreateOrGetConversationOutput> {
    return createOrGetConversationFlow(input);
}


const createOrGetConversationFlow = ai.defineFlow(
  {
    name: 'createOrGetConversationFlow',
    inputSchema: CreateOrGetConversationInputSchema,
    outputSchema: CreateOrGetConversationOutputSchema,
  },
  async ({ currentUser, targetUser }) => {
    const conversationsRef = collection(db, 'conversations');
    const participantUids = [currentUser.uid, targetUser.uid].sort();

    // Check if a conversation already exists
    const q = query(conversationsRef, where('participantUids', '==', participantUids));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Conversation exists, return its ID
      return { conversationId: querySnapshot.docs[0].id };
    } else {
      // Conversation does not exist, create a new one
      const newConversationDoc = await addDoc(conversationsRef, {
        participantUids,
        participants: [
          { uid: currentUser.uid, name: currentUser.name, avatarUrl: currentUser.avatarUrl },
          { uid: targetUser.uid, name: targetUser.name, avatarUrl: targetUser.avatarUrl },
        ],
        createdAt: serverTimestamp(),
      });
      return { conversationId: newConversationDoc.id };
    }
  }
);
