import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { validateRealFullName } from '@/lib/real-name-validation';
import {
  CONSENT_VERSION,
  DEFAULT_USER_SETTINGS_SERVER as DEFAULT_USER_SETTINGS,
} from '@/lib/settings-defaults';

/**
 * Sendchamp Live OTP Verification & Auth Custom Token Route
 */
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code, name, isSignup, legalConsent } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json({ error: 'Phone number and verification code are required.' }, { status: 400 });
    }

    // Enforce Layer 1 Legal Consent Gate on phone signup
    let validatedConsent: {
      consentVersion: string;
      agreedAt: string;
      termsAndPrivacyAccepted: boolean;
      ageVerified: boolean;
      realNameAndGuidelinesAccepted: boolean;
    } | null = null;

    if (isSignup) {
      if (
        !legalConsent ||
        legalConsent.termsAndPrivacyAccepted !== true ||
        legalConsent.ageVerified !== true ||
        legalConsent.realNameAndGuidelinesAccepted !== true
      ) {
        return NextResponse.json(
          { error: 'You must accept all Layer 1 legal, age, and community agreements before creating an account.' },
          { status: 400 }
        );
      }
      validatedConsent = {
        consentVersion: typeof legalConsent.consentVersion === 'string' ? legalConsent.consentVersion : CONSENT_VERSION,
        agreedAt: typeof legalConsent.agreedAt === 'string' ? legalConsent.agreedAt : new Date().toISOString(),
        termsAndPrivacyAccepted: true,
        ageVerified: true,
        realNameAndGuidelinesAccepted: true,
      };
    }

    // Enforce server-side Real-Name Validation when signing up or when a name is provided
    let validatedFormattedName: string | null = null;
    if (isSignup || (typeof name === 'string' && name.trim().length > 0)) {
      const nameCheck = validateRealFullName(typeof name === 'string' ? name : '');
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.error }, { status: 400 });
      }
      validatedFormattedName = nameCheck.formattedName;
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
      if (validatedFormattedName && userRecord.displayName !== validatedFormattedName) {
        userRecord = await admin.auth().updateUser(userRecord.uid, {
          displayName: validatedFormattedName,
        });
      }
    } catch (e: any) {
      // User doesn't exist yet, create user with phone number
      const initialDisplayName = validatedFormattedName || `User_${cleanPhone.slice(-4)}`;
      userRecord = await admin.auth().createUser({
        phoneNumber: cleanPhone,
        displayName: initialDisplayName,
      });
    }

    // Ensure user document exists in Firestore
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      const finalName = validatedFormattedName || userRecord.displayName || `User_${cleanPhone.slice(-4)}`;
      const baseHandle = validatedFormattedName
        ? (validatedFormattedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user') + '_' + userRecord.uid.slice(-4)
        : `user_${cleanPhone.slice(-4)}`;

      await userDocRef.set({
        uid: userRecord.uid,
        name: finalName,
        handle: baseHandle,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userRecord.uid)}`,
        isProfessional: false,
        bio: 'Hey there! I am using Lonkind.',
        followersCount: 0,
        followingCount: 0,
        balance: 0,
        coins: 0,
        diamonds: 0,
        settings: DEFAULT_USER_SETTINGS,
        ...(validatedConsent ? { legalConsent: validatedConsent, onboardingLayerCompleted: 1 } : {}),
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
      formattedName: validatedFormattedName || userRecord.displayName || undefined,
    });
  } catch (error: any) {
    console.error('Sendchamp Verify OTP Error:', error);
    return NextResponse.json({ error: error?.message || 'Verification failed.' }, { status: 500 });
  }
}
