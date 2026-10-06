import { NextRequest, NextResponse } from 'next/server';
import { autonomousNewsReporter } from '@/ai/flows/news-reporter';
import { adminDb as db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Twilio Inbound Webhook Endpoint
 * Receives SMS / WhatsApp messages from Twilio and auto-responds systematically
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString()?.trim() || '';

    console.log(`[Twilio Inbound Webhook] Message from ${from}: "${body}"`);

    let responseMessage = "Welcome to Lonkind Auto News Bot! Reply NEWS for latest tech updates, or HELP for support.";

    const upperCmd = body.toUpperCase();

    if (upperCmd.includes('NEWS') || upperCmd.includes('UPDATE')) {
      try {
        const result = await autonomousNewsReporter();
        responseMessage = `📰 [Lonkind Auto News Alert]\n\n${result.postContent || 'Latest tech updates published on timeline.'}\n\nVisit: https://lonkind.com`;
      } catch (newsErr) {
        responseMessage = "📰 [Lonkind News Bot]\n\nStay tuned for breaking tech & startup updates on Lonkind!";
      }
    } else if (upperCmd.includes('SUBSCRIBE') || upperCmd.includes('JOIN')) {
      // Mark user phone as subscribed in Firestore
      const cleanPhone = from.replace('whatsapp:', '');
      const userSnap = await db.collection('users').where('phone', '==', cleanPhone).limit(1).get();
      if (!userSnap.empty) {
        await userSnap.docs[0].ref.update({ newsSubscribed: true });
      }
      responseMessage = "✅ You are now subscribed to Lonkind Auto News updates via Twilio!";
    } else if (upperCmd.includes('HELP')) {
      responseMessage = "🤖 [Lonkind Bot Help]\n- Reply 'NEWS' to get latest tech news.\n- Reply 'SUBSCRIBE' for daily SMS news alerts.\n- Visit https://lonkind.com for live feed.";
    }

    // Log inbound Twilio message
    await db.collection('twilio_bot_logs').add({
      botName: 'Twilio Inbound Webhook Bot',
      type: 'inbound_message',
      fromPhone: from,
      incomingMessage: body,
      replyMessage: responseMessage,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Return TwiML XML Response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${responseMessage}</Message>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    console.error('Twilio Webhook Error:', error);
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Lonkind Auto News Bot is active. Visit https://lonkind.com</Message>
</Response>`;
    return new NextResponse(fallbackTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
