import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { validateStrictGmail, GMAIL_ONLY_ERROR } from '@/lib/gmail-validation';

/**
 * POST /api/auth/validate-email
 * Server-side strict Gmail-only validation & dot/alias duplicate prevention
 * for new Lonkind signups and email-change flows.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.email !== 'string') {
      return NextResponse.json(
        { valid: false, error: GMAIL_ONLY_ERROR },
        { status: 400 }
      );
    }

    const result = validateStrictGmail(body.email);
    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 400 }
      );
    }

    const { normalizedEmail, canonicalEmail } = result;

    // Anti-abuse duplicate check across canonicalEmail & legacy email variants
    const usersCol = adminDb.collection('users');
    const checks = [
      usersCol.where('canonicalEmail', '==', canonicalEmail).limit(1).get(),
      usersCol.where('email', '==', normalizedEmail).limit(1).get(),
    ];
    if (canonicalEmail !== normalizedEmail) {
      checks.push(usersCol.where('email', '==', canonicalEmail).limit(1).get());
    }

    const snapshots = await Promise.all(checks);
    const alreadyExists = snapshots.some((snap) => !snap.empty);

    if (alreadyExists) {
      return NextResponse.json(
        {
          valid: false,
          error:
            'An account with this Gmail address already exists (dot-variants of the same Gmail are not permitted). Please sign in instead.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      valid: true,
      normalizedEmail,
      canonicalEmail,
    });
  } catch (error: any) {
    console.error('[Validate Email] Error:', error);
    return NextResponse.json(
      { valid: false, error: 'Unable to validate email right now. Please try again.' },
      { status: 500 }
    );
  }
}
