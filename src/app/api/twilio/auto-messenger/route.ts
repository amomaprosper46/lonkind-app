import { NextRequest, NextResponse } from 'next/server';
import { sendTwilioSms, sendTwilioWhatsApp, broadcastTwilioNewsAlert } from '@/lib/twilio';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientPhone, message, channel = 'sms', isBroadcast = false, newsTitle = 'Platform Update' } = body;

    if (!message && !isBroadcast) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    if (isBroadcast) {
      // Fetch subscribers from Firestore
      const snapshot = await db.collection('users').where('newsSubscribed', '==', true).limit(100).get();
      const phoneNumbers: string[] = [];
      snapshot.forEach(doc => {
        const phone = doc.data().phoneNumber || doc.data().phone;
        if (phone) phoneNumbers.push(phone);
      });

      if (phoneNumbers.length === 0 && recipientPhone) {
        phoneNumbers.push(recipientPhone);
      }

      if (phoneNumbers.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No registered user phone numbers found for broadcast. Please specify recipientPhone.'
        }, { status: 400 });
      }

      const broadcastRes = await broadcastTwilioNewsAlert(phoneNumbers, newsTitle, message, channel);

      // Audit log
      await db.collection('twilio_bot_logs').add({
        botName: 'Systematic Auto Messaging Bot',
        type: 'broadcast',
        channel,
        recipientsCount: phoneNumbers.length,
        message,
        results: broadcastRes.results,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: `Systematic broadcast sent to ${phoneNumbers.length} recipients via Twilio (${channel}).`,
        broadcast: broadcastRes,
      });
    }

    // Single message dispatch
    if (!recipientPhone) {
      return NextResponse.json({ error: 'recipientPhone is required for single message.' }, { status: 400 });
    }

    const result = channel === 'whatsapp'
      ? await sendTwilioWhatsApp(recipientPhone, message)
      : await sendTwilioSms(recipientPhone, message);

    // Audit log
    await db.collection('twilio_bot_logs').add({
      botName: 'Systematic Auto Messaging Bot',
      type: 'direct_send',
      channel,
      recipientPhone,
      message,
      sid: result.sid,
      success: result.success,
      simulated: result.simulated || false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: result.success,
      message: result.simulated
        ? 'Message simulated (configure TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN in .env for live Twilio dispatch).'
        : 'Message sent successfully via Twilio.',
      details: result,
    });
  } catch (error: any) {
    console.error('Twilio Auto Messenger API Error:', error);
    return NextResponse.json({ error: error?.message || 'Twilio messaging failed.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const logsSnap = await db.collection('twilio_bot_logs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      success: true,
      botName: 'Lonkind Twilio Auto Messaging & News Bot',
      status: 'active',
      logsCount: logs.length,
      recentLogs: logs,
    });
  } catch (error: any) {
    console.error('Twilio Bot Logs Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch bot logs.' }, { status: 500 });
  }
}
