import { NextRequest, NextResponse } from 'next/server';
import { verifyTermiiOtp, formatPhoneNumberForTermii } from '@/lib/termii';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pinId, pin, phone } = body;

    if (!pinId || !pin) {
      return NextResponse.json(
        { error: 'pinId and pin are required.' },
        { status: 400 }
      );
    }

    // 1. Verify OTP with Termii
    const verification = await verifyTermiiOtp({ pinId, pin });

    if (!verification.success || !verification.verified) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired verification code.' },
        { status: 400 }
      );
    }

    // 2. If phone is provided, issue a Firebase Auth custom token for seamless sign-in
    let customToken: string | null = null;
    let userId: string | null = null;

    if (phone) {
      const e164Phone = '+' + formatPhoneNumberForTermii(phone);

      try {
        let userRecord;
        try {
          userRecord = await adminAuth.getUserByPhoneNumber(e164Phone);
        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            // Create user if not yet registered
            userRecord = await adminAuth.createUser({
              phoneNumber: e164Phone,
              displayName: `User ${e164Phone.slice(-4)}`,
            });

            // Initialize user doc in Firestore
            await adminDb.collection('users').doc(userRecord.uid).set({
              uid: userRecord.uid,
              phone: e164Phone,
              handle: `user_${e164Phone.slice(-6)}`,
              name: `User ${e164Phone.slice(-4)}`,
              createdAt: new Date(),
              coins: 50, // Welcome bonus
            }, { merge: true });
          } else {
            throw err;
          }
        }

        userId = userRecord.uid;
        customToken = await adminAuth.createCustomToken(userRecord.uid);
      } catch (authError: any) {
        console.error('Firebase Auth custom token creation failed:', authError);
      }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      customToken,
      userId,
      message: 'Code verified successfully',
    });
  } catch (error: any) {
    console.error('Termii verify-otp API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
