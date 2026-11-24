import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { guardGeminiAiEndpoint } from '@/lib/app-check-server';

const roastRateLimit = new Map<string, number>();

export async function POST(req: NextRequest) {
  const aiGuard = await guardGeminiAiEndpoint(req, 'ai_roast', 10, 10 * 60 * 1000);
  if (!aiGuard.ok) return aiGuard.response;
  try {
    const body = await req.json();
    const { userId, name, handle, bio, postCount, followersCount, followingCount, isProfessional, badges, style } = body;

    if (!userId || !name || !handle) {
      return NextResponse.json({ error: 'User ID, name, and handle are required.' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        if (decoded.uid !== userId) {
          return NextResponse.json({ error: 'Forbidden: User ID mismatch.' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
      }
    }

    const lastCall = roastRateLimit.get(userId) || 0;
    if (Date.now() - lastCall < 15_000) {
      return NextResponse.json(
        { error: 'Please wait a few seconds before generating another roast.' },
        { status: 429 }
      );
    }
    roastRateLimit.set(userId, Date.now());

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
