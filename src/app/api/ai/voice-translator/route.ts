import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

/**
 * Lonkind AI Voice Note & Chat Translator Route
 * Translates audio voice notes & text into target language
 */
export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage = 'English' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text content is required for AI translation.' }, { status: 400 });
    }

    const response = await ai.generate({
      model: 'googleai/gemini-3.5-flash-lite',
      prompt: `
        You are Lonkind's AI Voice Note & Chat Translator Bot.
        Translate the following message into ${targetLanguage}.
        Keep the output natural, clear, and preserve emotional tone and emojis.
        
        Original Message:
        "${text}"

        Output format: Return ONLY the raw translated text, with no additional commentary.
      `,
    });

    const translatedText = response.text?.trim() || text;

    return NextResponse.json({
      success: true,
      originalText: text,
      translatedText,
      targetLanguage,
    });
  } catch (error: any) {
    console.error('Lonkind AI Voice Translator Error:', error);
    return NextResponse.json({ error: error?.message || 'Voice translation service failed.' }, { status: 500 });
  }
}
