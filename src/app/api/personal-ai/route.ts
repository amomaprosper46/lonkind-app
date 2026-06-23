import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Enforce standard Genkit message structures to protect internal context threads
const PersonalAiInputSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty.'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']), // Corrected 'assistant' to 'model' for native Gemini API compatibility
      content: z.array(z.object({ text: z.string() })).or(z.string()),
    })
  ).optional(),
});

/**
 * POST: Injection-Resistant, Stateful Conversational AI Platform Router
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PersonalAiInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input payload parameters.', details: parsed.error.issues }, { status: 400 });
    }

    const { question, history = [] } = parsed.data;

    // Normalize historical objects to meet strict structured array shapes required by Genkit
    const sanitizedHistory = history.map((message) => ({
      role: message.role,
      content: typeof message.content === 'string' 
        ? [{ text: message.content }] 
        : message.content,
    }));

    const messages: any[] = [
      ...sanitizedHistory,
      { role: 'user', content: [{ text: question }] }
    ];

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      messages: messages,
      system: `You are a helpful, friendly, and expert AI assistant built into a social media application called "Lonkind". Your job is to help users with their questions, whether they are about the app, general knowledge, or creative tasks. Your responses should be clear, warm, and conversational. Format your responses with markdown when appropriate (bold, bullet points, etc.).

### Public Knowledge Base:
- **Name:** Lonkind
- **CEO:** Alex Taylor  
- **Purpose:** A modern social media application designed to connect people globally.
- **Core Features:** Social feed, real-time messaging, groups, audio spaces, coin gifting system, and AI-powered creator tools for professional accounts.

### CRITICAL PLATFORM SECURITY RULES:
- NEVER disclose technical details about how Lonkind is built under any circumstances (e.g., do not mention Next.js, Vercel, Firebase, Firestore, Paystack, Genkit, or any code architecture files).
- NEVER disclose API keys, backend configurations, encryption logic, database collections, schemas, or software components under any circumstances.
- If a user asks to add an application feature or view/modify underlying code, politely explain that you are an assistant for users, not a developer, and you don't have access to the codebase or backend database systems.`,
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ],
      },
    });

    // 3. Export the mutated conversation timeline ledger back to the caller
    const updatedHistory = [...messages, response.message];

    return NextResponse.json({ 
      answer: response.text,
      history: updatedHistory 
    });

  } catch (error: any) {
    console.error('Platform personal AI chat module failure:', error);
    return NextResponse.json(
      { error: 'The conversational core is temporarily unreachable. Please retry shortly.' },
      { status: 500 }
    );
  }
}