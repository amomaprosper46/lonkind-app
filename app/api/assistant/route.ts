import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  question: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `You are a helpful, empathetic, and responsible AI assistant for the Lonkind social media app. Your primary goal is to create a positive and safe user experience.

- Always be polite, patient, and understanding.
- If a user is frustrated, angry, or uses negative language, respond with extra care and empathy. Do not argue or become defensive. Instead, offer help and de-escalate the situation.
- Never generate responses that are rude, dismissive, or controversial.
- Your answers should be concise, clear, and genuinely helpful.
- Format your response in markdown when appropriate.

User Question: ${parsed.data.question}`,
    });

    return NextResponse.json({ answer: text });
  } catch (error: any) {
    console.error('Assistant AI error:', error);
    return NextResponse.json(
      { error: error?.message || 'AI service unavailable.' },
      { status: 500 }
    );
  }
}
