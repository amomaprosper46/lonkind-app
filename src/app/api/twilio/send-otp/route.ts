import { NextRequest, NextResponse } from 'next/server';
import { sendTwilioSms, sendTwilioWhatsApp } from '@/lib/twilio';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Generate & Send 6-Digit Twilio OTP via SMS or WhatsApp
 */
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, channel = 'sms' } = await req.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Valid phone number is required.' }, { status: 400 });
    }

    const cleanPhone = phoneNumber.trim();

    // Generate secure 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

    // Store in Firestore doc
    const otpDocRef = db.collection('twilio_otp_verifications').doc(cleanPhone.replace(/[^a-zA-Z0-9]/g, '_'));
    await otpDocRef.set({
      phoneNumber: cleanPhone,
      otpCode,
      expiresAt,
      verified: false,
      attempts: 0,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    const messageBody = `🔒 Your Lonkind verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;

    const sendResult = channel === 'whatsapp'
      ? await sendTwilioWhatsApp(cleanPhone, messageBody)
      : await sendTwilioSms(cleanPhone, messageBody);

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error || 'Failed to send OTP via Twilio.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanPhone} via SMS.`,
    });
  } catch (error: any) {
    console.error('Twilio Send OTP Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate OTP.' }, { status: 500 });
  }
}
