import { NextRequest, NextResponse } from 'next/server';
import { validateRealFullName } from '@/lib/real-name-validation';

/**
 * Server-side Real-Name Validation endpoint for Signup.
 * Ensures the submitted full name satisfies all real-name rules and returns
 * the cleanly capitalized formatted name before account creation proceeds.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Please enter your first and last name.' },
        { status: 400 }
      );
    }

    const result = validateRealFullName(body.name);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      formattedName: result.formattedName,
    });
  } catch (error: any) {
    console.error('Validate Name Error:', error);
    return NextResponse.json(
      { valid: false, error: 'Unable to validate name right now. Please try again.' },
      { status: 500 }
    );
  }
}
