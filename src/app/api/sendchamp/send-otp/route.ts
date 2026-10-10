import { NextRequest, NextResponse } from 'next/server';
import { sendSendchampSms, sendSendchampWhatsApp } from '@/lib/sendchamp';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Sendchamp Live OTP Generator & Dispatch Route
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

    // Store in Firestore doc under 'sendchamp_otp_verifications'
    const docId = cleanPhone.replace(/[^a-zA-Z0-9]/g, '_');
    const otpDocRef = db.collection('sendchamp_otp_verifications').doc(docId);
    
    // Also store in legacy doc ref for backwards compatibility
    const legacyDocRef = db.collection('twilio_otp_verifications').doc(docId);

    const otpPayload = {
      phoneNumber: cleanPhone,
      otpCode,
      expiresAt,
      verified: false,
      attempts: 0,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    await Promise.all([
      otpDocRef.set(otpPayload),
      legacyDocRef.set(otpPayload),
    ]);

    const messageBody = `🔒 Your Lonkind verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;

    const sendResult = channel === 'whatsapp'
      ? await sendSendchampWhatsApp(cleanPhone, messageBody)
      : await sendSendchampSms(cleanPhone, messageBody);

    if (!sendResult.success) {
      console.error('[Sendchamp Send OTP Gateway Error]:', sendResult.error);
      return NextResponse.json({
        success: false,
        error: sendResult.error || 'Failed to send SMS code via Sendchamp gateway. Please check your phone number and try again.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanPhone} via SMS.`,
    });
  } catch (error: any) {
    console.error('Sendchamp Send OTP Exception:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate OTP.' }, { status: 500 });
  }
}
