import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Sendchamp Incoming Webhook Handler
 * Receives real-time SMS status updates, delivery reports, and incoming messages.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    console.log('[Sendchamp Webhook Received]:', JSON.stringify(payload));

    const event = payload.event || payload.type || 'delivery_report';
    const reference = payload.reference || payload.id || payload.data?.reference;
    const recipient = payload.recipient || payload.to || payload.phone_number;
    const status = payload.status || payload.delivery_status || 'delivered';

    // Store Webhook Event Log in Firestore
    const logRef = db.collection('sendchamp_webhook_logs').doc();
    await logRef.set({
      event,
      reference: reference || null,
      recipient: recipient || null,
      status,
      payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      status: 'success',
      message: 'Sendchamp webhook event received and logged successfully.',
    });
  } catch (error: any) {
    console.error('Sendchamp Webhook Processing Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Webhook processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Lonkind Sendchamp Webhook Endpoint',
    version: '2.0',
  });
}
