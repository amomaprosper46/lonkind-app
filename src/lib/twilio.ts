import twilio from 'twilio';
import { sendSendchampSms } from '@/lib/sendchamp';

// Environment credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || (fromPhone ? `whatsapp:${fromPhone}` : undefined);

// Twilio Client Singleton (or null if unconfigured)
let twilioClient: twilio.Twilio | null = null;

if (accountSid && authToken) {
  try {
    twilioClient = twilio(accountSid, authToken);
  } catch (err) {
    console.warn('Twilio client initialization warning:', err);
  }
}

export interface TwilioSendResult {
  success: boolean;
  sid?: string;
  simulated?: boolean;
  status?: string;
  error?: string;
  recipient?: string;
}

/**
 * Send an SMS message via Twilio (with Sendchamp / Termii Fallback)
 */
export async function sendTwilioSms(to: string, body: string): Promise<TwilioSendResult> {
  const cleanPhone = to.trim();
  if (!cleanPhone) {
    return { success: false, error: 'Recipient phone number is required.' };
  }

  if (!twilioClient || !fromPhone) {
    // Priority Fallback 1: Live Sendchamp API
    const scRes = await sendSendchampSms(cleanPhone, body);
    if (scRes.success) {
      return {
        success: true,
        sid: scRes.messageId || `sc_${Date.now()}`,
        status: 'sent',
        recipient: cleanPhone,
      };
    } else {
      console.warn(`[Sendchamp Live SMS Failed]: ${scRes.error}`);
      // If Sendchamp fails, report actual error to user
      return {
        success: false,
        error: `Sendchamp SMS Error: ${scRes.error}`,
        recipient: cleanPhone,
      };
    }
  }

  try {
    const message = await twilioClient.messages.create({
      body: body,
      from: fromPhone,
      to: cleanPhone,
    });

    return {
      success: true,
      sid: message.sid,
      status: message.status,
      recipient: cleanPhone,
    };
  } catch (error: any) {
    console.error(`Twilio SMS send error to ${cleanPhone}:`, error);
    return {
      success: false,
      error: error?.message || 'Failed to send SMS via Twilio.',
      recipient: cleanPhone,
    };
  }
}

/**
 * Send a WhatsApp message via Twilio
 */
export async function sendTwilioWhatsApp(to: string, body: string): Promise<TwilioSendResult> {
  const cleanPhone = to.trim();
  if (!cleanPhone) {
    return { success: false, error: 'Recipient phone number is required.' };
  }

  const formattedTo = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;
  const formattedFrom = fromWhatsApp ? (fromWhatsApp.startsWith('whatsapp:') ? fromWhatsApp : `whatsapp:${fromWhatsApp}`) : undefined;

  if (!twilioClient || !formattedFrom) {
    console.log(`[Twilio WhatsApp Simulation] To: ${formattedTo} | Body: ${body}`);
    return {
      success: true,
      simulated: true,
      sid: `SIM_WA_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: 'simulated_queued',
      recipient: formattedTo,
    };
  }

  try {
    const message = await twilioClient.messages.create({
      body: body,
      from: formattedFrom,
      to: formattedTo,
    });

    return {
      success: true,
      sid: message.sid,
      status: message.status,
      recipient: formattedTo,
    };
  } catch (error: any) {
    console.error(`Twilio WhatsApp send error to ${formattedTo}:`, error);
    return {
      success: false,
      error: error?.message || 'Failed to send WhatsApp message via Twilio.',
      recipient: formattedTo,
    };
  }
}

/**
 * Systematic Broadcast Helper for Auto News Reporter
 */
export async function broadcastTwilioNewsAlert(
  recipients: string[],
  newsTitle: string,
  newsContent: string,
  channel: 'sms' | 'whatsapp' | 'both' = 'sms'
): Promise<{ total: number; sent: number; results: TwilioSendResult[] }> {
  const formattedBody = `📰 [Lonkind Auto News Bot]\n\n🔥 ${newsTitle}\n\n${newsContent}\n\nRead more at https://lonkind.com`;

  const results: TwilioSendResult[] = [];
  let sentCount = 0;

  for (const phone of recipients) {
    if (channel === 'sms' || channel === 'both') {
      const smsRes = await sendTwilioSms(phone, formattedBody);
      results.push(smsRes);
      if (smsRes.success) sentCount++;
    }

    if (channel === 'whatsapp' || channel === 'both') {
      const waRes = await sendTwilioWhatsApp(phone, formattedBody);
      results.push(waRes);
      if (waRes.success && channel !== 'both') sentCount++;
    }
  }

  return {
    total: recipients.length,
    sent: sentCount,
    results,
  };
}
