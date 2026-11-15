import { NextRequest, NextResponse } from 'next/server';
import { sendTermiiSms } from '@/lib/termii';
import { adminAuth } from '@/lib/firebase-admin';

const recentSmsSends = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      } catch {
        return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Authentication required to send SMS.' }, { status: 401 });
    }

    const body = await req.json();
    const { to, message, channel } = body;

    if (!to || !message || typeof to !== 'string' || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Recipient phone number (to) and message are required.' },
        { status: 400 }
      );
    }

    const cleanTo = to.trim();
    const lastSent = recentSmsSends.get(cleanTo) || 0;
    if (Date.now() - lastSent < 60_000) {
      return NextResponse.json(
        { error: 'Please wait 60 seconds before sending another SMS to this number.' },
        { status: 429 }
      );
    }
    recentSmsSends.set(cleanTo, Date.now());

    const result = await sendTermiiSms({
      to: cleanTo,
      message: message.slice(0, 320),
      channel: channel || 'generic',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send SMS' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'SMS sent successfully',
    });
  } catch (error: any) {
    console.error('Termii send-sms API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
