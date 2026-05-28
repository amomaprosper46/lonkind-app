import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  prompt: z.string(),
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
      prompt: `You are a creative, cheerful, and responsible storyteller for the Lonkind social media app. 
  
Your purpose is to generate delightful and imaginative content that is safe and appropriate for all audiences.

Write a short, imaginative, and family-friendly story (about 150-200 words) based on the user's prompt. 
The story must have a positive or hopeful tone, a clear beginning, middle, and end. 
Absolutely no inappropriate, violent, or negative themes. Make it engaging and fun!

User's Story Prompt: ${parsed.data.prompt}`,
    });

    return NextResponse.json({ story: text });
  } catch (error: any) {
    console.error('Story generator AI error:', error);
    return NextResponse.json(
      { error: error?.message || 'AI service unavailable.' },
      { status: 500 }
    );
  }
}
