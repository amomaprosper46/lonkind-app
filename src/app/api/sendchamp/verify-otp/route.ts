import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Sendchamp Live OTP Verification & Auth Custom Token Route
 */
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json({ error: 'Phone number and verification code are required.' }, { status: 400 });
    }

    const cleanPhone = phoneNumber.trim();
    const cleanCode = code.trim();

    const docId = cleanPhone.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Check primary Sendchamp collection first
    let otpDocRef = db.collection('sendchamp_otp_verifications').doc(docId);
    let otpSnap = await otpDocRef.get();

    // Fallback to legacy collection if needed
    if (!otpSnap.exists) {
      otpDocRef = db.collection('twilio_otp_verifications').doc(docId);
      otpSnap = await otpDocRef.get();
    }

    if (!otpSnap.exists) {
      return NextResponse.json({ error: 'No verification code was requested for this phone number.' }, { status: 400 });
    }

    const otpData = otpSnap.data()!;

    if (otpData.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
    }

    if (otpData.verified) {
      return NextResponse.json({ error: 'This verification code has already been used.' }, { status: 400 });
    }

    if (otpData.otpCode !== cleanCode) {
      await otpDocRef.update({ attempts: (otpData.attempts || 0) + 1 });
      return NextResponse.json({ error: 'Invalid verification code. Please check your SMS and try again.' }, { status: 400 });
    }

    // Mark as verified
    await otpDocRef.update({ verified: true });

    // Look up or create user in Firebase Auth by phone number
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByPhoneNumber(cleanPhone);
    } catch (e: any) {
      // User doesn't exist yet, create user with phone number
      userRecord = await admin.auth().createUser({
        phoneNumber: cleanPhone,
        displayName: `User_${cleanPhone.slice(-4)}`,
      });
    }

    // Ensure user document exists in Firestore
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      const defaultName = userRecord.displayName || `User_${cleanPhone.slice(-4)}`;
      const baseHandle = `user_${cleanPhone.slice(-4)}`;

      await userDocRef.set({
        uid: userRecord.uid,
        name: defaultName,
        handle: baseHandle,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanPhone}`,
        isProfessional: false,
        bio: 'Hey there! I am using Lonkind.',
        followersCount: 0,
        followingCount: 0,
        balance: 0,
        coins: 0,
        diamonds: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Create Firebase custom auth token
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully via Sendchamp!',
      customToken,
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error('Sendchamp Verify OTP Error:', error);
    return NextResponse.json({ error: error?.message || 'Verification failed.' }, { status: 500 });
  }
}
