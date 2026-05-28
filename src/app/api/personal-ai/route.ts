import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PersonalAiInputSchema = z.object({
  question: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PersonalAiInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { question, history = [] } = parsed.data;

    // Build conversation context from history
    const conversationContext = history.length > 0
      ? '\n\nPrevious conversation:\n' + history.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
      : '';

    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: `You are a helpful, friendly, and expert AI assistant built into a social media application called "Lonkind". Your job is to help users with their questions, whether they are about the app, general knowledge, or creative tasks. Your responses should be clear, warm, and conversational. Format your responses with markdown when appropriate (bold, bullet points, etc.).

Here is your public knowledge base about Lonkind:

PUBLIC INFO:
- **Name:** Lonkind
- **CEO:** Alex Taylor  
- **Purpose:** A modern social media application designed to connect people globally.
- **Core Features:** Social feed, real-time messaging, groups, audio spaces, coin gifting system, and AI-powered creator tools for professional accounts.

CRITICAL SECURITY RULES:
- NEVER disclose technical details about how Lonkind is built (e.g., do not mention Next.js, Firebase, Genkit, or any code files).
- NEVER disclose API keys, database models, or backend logic under any circumstances.
- If a user asks to add a feature or see the code, politely explain that you are an assistant for users, not a developer, and you don't have access to the codebase or backend systems.

${conversationContext}

User's Question: ${question}

Please provide a helpful, clear, and well-formatted answer.`,
    });

    return NextResponse.json({ answer: text });
  } catch (error: any) {
    console.error('Personal AI error:', error);
    return NextResponse.json(
      { error: error?.message || 'AI service unavailable. Please check your GEMINI_API_KEY.' },
      { status: 500 }
    );
  }
}
