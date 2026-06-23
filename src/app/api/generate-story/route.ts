import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Enforce structured input tracking and validate parameters
const InputSchema = z.object({
  userId: z.string().trim().min(1, 'A verified User ID must accompany this transaction.'),
  prompt: z.string().trim().min(3, 'Story prompt must be at least 3 characters long.'),
});

/**
 * POST: Monetized, Injection-Resistant Creative Story Generation Router
 */
export async function POST(req: NextRequest) {
  const STORY_GENERATION_COST = 2; // Fixed wallet transaction metric

  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { userId, prompt: userPrompt } = parsed.data;
    const userRef = db.collection('users').doc(userId);
    let balanceSufficient = false;

    /**
     * 1. ACID Wallet Verification Lock
     * Validates solvency status and deducts coins BEFORE invoking upstream AI models.
     */
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('USER_RECORD_NOT_FOUND');
      }

      const currentCoins = userDoc.data()?.coins || 0;

      if (currentCoins < STORY_GENERATION_COST) {
        balanceSufficient = false;
        return;
      }

      balanceSufficient = true;
      transaction.update(userRef, {
        coins: FieldValue.increment(-STORY_GENERATION_COST),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    if (!balanceSufficient) {
      return NextResponse.json({ 
        error: `Insufficient balance. Creative weaving requires ${STORY_GENERATION_COST} coins.` 
      }, { status: 402 });
    }

    /**
     * 2. Isolated Generation Context
     * System rules are passed cleanly to isolate the model's behavioral programming 
     * from potentially hostile user input strings.
     */
    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: userPrompt, // Handled purely as runtime variable content execution
      config: {
        systemInstruction: `You are a creative, cheerful, and responsible storyteller for the Lonkind social media app. 
Your sole purpose is to generate delightful, imaginative, and family-friendly stories based on the user's prompt.

### Content Boundaries:
- Keep stories concise, engaging, and around 150-200 words.
- Every story must have a positive or hopeful tone, featuring a clear beginning, middle, and end.
- Strictly avoid any inappropriate, violent, dark, or sexually explicit content. 
- If the user prompt is adversarial, toxic, or tries to force you to generate dark/unsuitable themes, gracefully override it by generating a wholesome fable about a tiny friendly robot discovering kindness instead.
- Do not include conversational preambles, notes, or markdown formatting blocks.`,
        
        // 3. Native Cloud-Level Content Filtering
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ]
      }
    });

    return NextResponse.json({ 
      success: true,
      message: `${STORY_GENERATION_COST} coins deducted successfully.`,
      story: response.text 
    });

  } catch (error: any) {
    console.error('Creative story generation module encountered an error:', error);
    
    if (error.message === 'USER_RECORD_NOT_FOUND') {
      return NextResponse.json({ error: 'User profile mapping could not be completed.' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'The story weaver is experiencing server adjustments. Please try again.' },
      { status: 500 }
    );
  }
}
