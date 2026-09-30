import { NextRequest, NextResponse } from 'next/server';
import { sendTermiiSms } from '@/lib/termii';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, message, channel } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Recipient phone number (to) and message are required.' },
        { status: 400 }
      );
    }

    const result = await sendTermiiSms({
      to,
      message,
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
