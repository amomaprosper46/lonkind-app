/**
 * @fileOverview Sendchamp Multi-Channel Messaging Client for Lonkind
 * Handles SMS, WhatsApp, and Verification OTP via Sendchamp API
 */

const SENDCHAMP_PUBLIC_KEY = process.env.SENDCHAMP_PUBLIC_KEY || 'sendchamp_live_$2a$10$cTdZkt2kKzOynmibSDzr9OfROwCfxyAazAB4Z/RjQrsKW5CdJAUvG';
const SENDCHAMP_SENDER_ID = process.env.SENDCHAMP_SENDER_ID || 'Lonkind';
const SENDCHAMP_BASE_URL = 'https://api.sendchamp.com/api/v1';

export interface SendchampResult {
  success: boolean;
  messageId?: string;
  referenceName?: string;
  status?: string;
  error?: string;
  data?: any;
}

/**
 * Send SMS via Sendchamp API
 */
export async function sendSendchampSms(to: string | string[], message: string): Promise<SendchampResult> {
  if (!SENDCHAMP_PUBLIC_KEY) {
    console.log(`[Sendchamp SMS Simulation] To: ${to} | Message: ${message}`);
    return {
      success: true,
      messageId: `SIM_SC_SMS_${Date.now()}`,
      status: 'simulated',
    };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const formattedRecipients = recipients.map(phone => {
    let cleaned = phone.replace(/[\s\-()+]/g, '');
    if (cleaned.startsWith('2340')) {
      cleaned = '234' + cleaned.slice(4);
    } else if (cleaned.startsWith('0')) {
      cleaned = '234' + cleaned.slice(1);
    }
    return cleaned;
  });

  const sendersToTry = [SENDCHAMP_SENDER_ID, 'N-Alert', 'Sendchamp'];
  let lastError = 'Failed to send SMS via Sendchamp.';

  for (const senderName of sendersToTry) {
    try {
      const response = await fetch(`${SENDCHAMP_BASE_URL}/sms/send`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SENDCHAMP_PUBLIC_KEY}`,
        },
        body: JSON.stringify({
          to: formattedRecipients,
          message,
          sender_name: senderName,
          route: 'dnd', // High-priority DND route for transactional SMS
        }),
      });

      const resData = await response.json();

      if (response.ok && (resData.status === 'success' || resData.code === '200')) {
        return {
          success: true,
          messageId: resData.data?.reference || resData.data?.id,
          status: resData.status,
          data: resData.data,
        };
      } else {
        console.warn(`[Sendchamp SMS Attempt Failed with sender '${senderName}']:`, resData);
        lastError = resData.message || resData.error || lastError;
      }
    } catch (error: any) {
      console.error(`[Sendchamp Exception with sender '${senderName}']:`, error);
      lastError = error.message || lastError;
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Send WhatsApp Message via Sendchamp API
 */
export async function sendSendchampWhatsApp(to: string, message: string): Promise<SendchampResult> {
  if (!SENDCHAMP_PUBLIC_KEY) {
    console.log(`[Sendchamp WhatsApp Simulation] To: ${to} | Message: ${message}`);
    return {
      success: true,
      messageId: `SIM_SC_WA_${Date.now()}`,
      status: 'simulated',
    };
  }

  const cleanPhone = to.replace(/[\s\-()+]/g, '');

  try {
    const response = await fetch(`${SENDCHAMP_BASE_URL}/whatsapp/message/send`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDCHAMP_PUBLIC_KEY}`,
      },
      body: JSON.stringify({
        recipient: cleanPhone,
        message,
        sender: SENDCHAMP_SENDER_ID,
        type: 'text',
      }),
    });

    const resData = await response.json();

    if (response.ok && (resData.status === 'success' || resData.code === '200')) {
      return {
        success: true,
        messageId: resData.data?.reference || resData.data?.id,
        status: resData.status,
        data: resData.data,
      };
    } else {
      console.error('[Sendchamp WhatsApp Error]:', resData);
      return {
        success: false,
        error: resData.message || 'Failed to send WhatsApp message via Sendchamp.',
      };
    }
  } catch (error: any) {
    console.error('Sendchamp WhatsApp Exception:', error);
    return {
      success: false,
      error: error.message || 'Sendchamp WhatsApp connection error.',
    };
  }
}
