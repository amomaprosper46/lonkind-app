import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';
import { adminDb as db } from '@/lib/firebase-admin';

const InputSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty.'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.array(z.object({ text: z.string() })),
    })
  ).optional().describe('Passing historical chat context structures preserves conversational continuity.'),
});

/**
 * POST: Secure, Context-Aware Core Assistant Router
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting / Authentication Check
    // Optional: Extract Bearer token from header to verify active session UIDs before processing AI compute
    
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { question, history } = parsed.data;

    const messages: any[] = [
      ...history.map((m: any) => ({
        role: m.role,
        content: typeof m.content === 'string' ? [{ text: m.content }] : m.content
      })),
      { role: 'user', content: [{ text: question }] }
    ];

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      messages: messages,
      system: `You are Lonki, a helpful, empathetic, and responsible AI assistant for the Lonkind social media app. Your primary goal is to create a positive and safe user experience.

### Behavioral Rules:
- Always be polite, patient, and understanding.
- If a user is frustrated, angry, or uses negative language, respond with extra care and empathy. Do not argue or become defensive. Instead, offer help and de-escalate the situation.
- Never generate responses that are rude, dismissive, or highly controversial.
- Your answers should be concise, clear, and genuinely helpful.
- Format your response in markdown when appropriate.
- Focus strictly on answering questions relating to app configuration, account help, support, and social interaction rules. Re-route completely off-topic systemic questions politely back to app functionality.`,
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ]
      }
    });

    const updatedHistory = [...messages, response.message];

    return NextResponse.json({ 
      answer: response.text,
      history: updatedHistory 
    });

  } catch (error: any) {
    console.error('Lonki Assistant core module runtime failure:', error);
    return NextResponse.json(
      { error: 'The platform assistant is temporarily recalibrating. Please retry shortly.' },
      { status: 500 }
    );
  }
}
