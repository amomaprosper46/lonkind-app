import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, handle, bio, style, mood } = body;

    if (!name || !handle || !style) {
      return NextResponse.json({ error: 'Name, handle, and style are required.' }, { status: 400 });
    }

    // Lazy-load the AI flow to prevent SSR/build crashes
    const { generateAvatarConcept } = await import('@/ai/flows/generate-avatar-concept');

    const result = await generateAvatarConcept({
      name,
      handle,
      bio: bio || undefined,
      style,
      mood: mood || 'cool',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Avatar generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate avatar concept.' },
      { status: 500 }
    );
  }
}
