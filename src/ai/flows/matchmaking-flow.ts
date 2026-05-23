'use server';
/**
 * @fileOverview A Genkit flow for providing user matchmaking suggestions.
 *
 * - findMatches - A function that suggests other users to connect with.
 * - MatchmakingInput - The input type for the findMatches function.
 * - MatchmakingOutput - The return type for the findMatches function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';

const MatchmakingInputSchema = z.object({
  userId: z.string().describe('The ID of the user seeking matches.'),
});
export type MatchmakingInput = z.infer<typeof MatchmakingInputSchema>;

const SuggestedUserSchema = z.object({
    uid: z.string(),
    name: z.string(),
    handle: z.string(),
    avatarUrl: z.string(),
    bio: z.string().optional(),
    matchReason: z.string().describe("A brief, friendly explanation for why this user is a good match."),
});

const MatchmakingOutputSchema = z.object({
  suggestions: z.array(SuggestedUserSchema).describe('A list of suggested users.'),
});
export type MatchmakingOutput = z.infer<typeof MatchmakingOutputSchema>;

export async function findMatches(input: MatchmakingInput): Promise<MatchmakingOutput> {
  return matchmakingFlow(input);
}


// In a real app, this prompt would be much more sophisticated.
// It would likely include user interests, posts, and other data.
const matchPrompt = ai.definePrompt({
    name: 'matchmakingPrompt',
    input: { schema: z.object({ currentUserBio: z.string(), potentialMatchBio: z.string() }) },
    output: { schema: z.object({ reason: z.string() }) },
    prompt: `You are a friendly AI matchmaker for a social network. Based on the two user bios, provide a very short, compelling reason why they might want to connect.
    
    User 1 Bio: {{{currentUserBio}}}
    User 2 Bio: {{{potentialMatchBio}}}
    
    Reason:`,
});


const matchmakingFlow = ai.defineFlow(
  {
    name: 'matchmakingFlow',
    inputSchema: MatchmakingInputSchema,
    outputSchema: MatchmakingOutputSchema,
  },
  async ({ userId }) => {
    // 1. Get the current user's data (including who they already follow)
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
        return { suggestions: [] };
    }
    const currentUser = userDoc.data();

    const followingRef = collection(db, 'users', userId, 'following');
    const followingSnap = await getDocs(followingRef);
    const followingIds = new Set(followingSnap.docs.map(d => d.id));
    followingIds.add(userId); // Exclude self

    // 2. Fetch a few random users to consider
    const usersRef = collection(db, 'users');
    // Firestore doesn't have a native "not-in" for more than 10, or random.
    // This is a simplified approach for demonstration. A real app would use a more scalable discovery mechanism.
    const q = query(usersRef, limit(10));
    const querySnapshot = await getDocs(q);

    const potentialMatches = querySnapshot.docs
      .map(doc => ({ uid: doc.id, ...doc.data() } as any))
      .filter(user => !followingIds.has(user.uid));
      
    const suggestions = [];

    // 3. For the first 3 potential matches, ask the AI for a reason
    for (const match of potentialMatches.slice(0, 3)) {
        const { output } = await matchPrompt({ 
            currentUserBio: currentUser.bio || '', 
            potentialMatchBio: match.bio || '' 
        });

        if (output) {
            suggestions.push({
                uid: match.uid,
                name: match.name,
                handle: match.handle,
                avatarUrl: match.avatarUrl,
                bio: match.bio,
                matchReason: output.reason,
            });
        }
    }
    
    return { suggestions };
  }
);
