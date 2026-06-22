import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  topic: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { text } = await ai.generate({
      prompt: `You are an expert news reporter and social media manager for the Lonkind app. 
  
Your task is to find a very recent, interesting, and globally relevant news story based on the provided topic.

Write a short, engaging, and neutral social media post (2-3 sentences) summarizing the news. The post should be informative and easy to understand for a general audience. Start the post with an appropriate emoji.

Topic: ${parsed.data.topic}`,
    });

    return NextResponse.json({ postContent: text });
  } catch (error: any) {
    console.error('News reporter AI error:', error);
    return NextResponse.json(
      { error: error?.message || 'AI service unavailable.' },
      { status: 500 }
    );
  }
}
