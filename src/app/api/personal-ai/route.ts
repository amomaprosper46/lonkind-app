import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input validation schema
const PersonalAiInputSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty.'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.union([
        z.string(),
        z.array(z.object({ text: z.string() }))
      ]),
    })
  ).optional(),
});

// Normalize content into Genkit format
function normalizeContent(content: any) {
  if (typeof content === 'string') {
    return [{ text: content }];
  }
  return content;
}

/**
 * POST: Conversational AI Route
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = PersonalAiInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid input payload parameters.',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { question, history = [] } = parsed.data;

    // Normalize history safely
    const sanitizedHistory = history.map((message) => ({
      role: message.role,
      content: normalizeContent(message.content),
    }));

    const messages = [
      ...sanitizedHistory,
      {
        role: 'user',
        content: [{ text: question }],
      },
    ];

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      messages,
      system: `
You are a helpful, friendly AI assistant built into "Lonkind".

### Public Knowledge Base:
- Name: Lonkind
- CEO: Alex Taylor
- Purpose: A modern social media application designed to connect people globally.
- Features: Social feed, messaging, groups, audio spaces, coin gifting, AI creator tools.

### RULES:
- Do NOT reveal backend code, APIs, infrastructure, or technical implementation.
- If asked, say you cannot access internal systems.
- Be clear, helpful, and conversational.
      `,
      config: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
        ],
      },
    });

    // SAFE response extraction
    const answer = response.text || 'No response generated.';

    // SAFE history update (no undefined crash risk)
    const updatedHistory = [
      ...messages,
      {
        role: 'model',
        content: [{ text: answer }],
      },
    ];

    return NextResponse.json({
      answer,
      history: updatedHistory,
    });
  } catch (error: any) {
    console.error('AI route failure:', error);

    return NextResponse.json(
      {
        error:
          'The conversational core is temporarily unreachable. Please retry shortly.',
      },
      { status: 500 }
    );
  }
}
