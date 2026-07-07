import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, handle, bio, postCount, followersCount, followingCount, isProfessional, badges, style } = body;

    if (!userId || !name || !handle) {
      return NextResponse.json({ error: 'User ID, name, and handle are required.' }, { status: 400 });
    }

    // Lazy-load the AI flow to prevent SSR/build crashes
    const { generateProfileRoast } = await import('@/ai/flows/generate-profile-roast');

    const result = await generateProfileRoast({
      userId,
      name,
      handle,
      bio: bio || undefined,
      postCount: postCount ?? undefined,
      followersCount: followersCount ?? undefined,
      followingCount: followingCount ?? undefined,
      isProfessional: isProfessional ?? undefined,
      badges: badges ?? undefined,
      style: style || 'playful',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Roast generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate roast.' },
      { status: 500 }
    );
  }
}
