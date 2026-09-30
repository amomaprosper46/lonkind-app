/**
 * @fileOverview Termii SMS & OTP Messaging Service for Lonkind
 * STRICTLY SERVER-SIDE ONLY — Exposes no keys to client/browser.
 * Provides direct telecom routing for transactional SMS, OTPs, and notifications across Nigeria and Africa.
 */

if (typeof window !== 'undefined') {
  throw new Error('Termii API client is strictly server-side and must never be imported into client components.');
}

export interface SendSmsParams {
  to: string; // Recipient phone number (e.g., '+2348123456789' or '08123456789')
  message: string;
  channel?: 'generic' | 'dnd' | 'whatsapp';
}

export interface SendOtpParams {
  to: string;
  pinLength?: number;
  pinTimeToLive?: number; // In minutes
  messageText?: string;
  channel?: 'generic' | 'dnd';
}

export interface VerifyOtpParams {
  pinId: string;
  pin: string;
}

export interface TermiiResponse {
  success: boolean;
  messageId?: string;
  pinId?: string;
  verified?: boolean;
  balance?: number;
  currency?: string;
  error?: string;
  raw?: any;
}

/**
 * ============================================================================
 * CRAFTED SMS TEMPLATES FOR LONKIND USERS
 * ============================================================================
 * Thoughtfully written, concise, professional messages designed for 
 * high deliverability, brand clarity, and anti-fraud protection.
 */
export const TermiiTemplates = {
  /**
   * 1. Phone Authentication & Verification OTP
   * Fits in 1 SMS credit (< 160 chars). Clear call to action and security disclaimer.
   */
  otp: (code: string | number, ttlMinutes: number = 10): string =>
    `Your Lonkind confirmation code is: ${code}. Valid for ${ttlMinutes} minutes. Never disclose this code to anyone, including Lonkind staff.`,

  /**
   * 2. Welcome to Lonkind Onboarding
   * Welcomes the user, displays their handle, and notes their welcome coin credit.
   */
  welcome: (name: string, handle: string, bonusCoins: number = 50): string =>
    `Welcome to Lonkind, ${name}! Your @${handle} profile is now live. We added ${bonusCoins} free coins to your wallet. Start connecting at https://lonkind.com`,

  /**
   * 3. Coin Gift / Creator Tip Received
   * Real-time SMS alert when a user receives coin gifts from a follower.
   */
  coinGiftReceived: (senderHandle: string, coins: number): string =>
    `Lonkind: Great news! @${senderHandle} just gifted you ${coins} coins. Your wallet balance has been updated. View your gift at https://lonkind.com`,

  /**
   * 4. Payout Withdrawal Processing Notification
   */
  payoutSubmitted: (amountNgn: number, bankName: string, accountLast4: string, ref: string): string =>
    `Lonkind: Payout request of ₦${amountNgn.toLocaleString()} to ${bankName} (*${accountLast4}) is being processed. Ref: ${ref}.`,

  /**
   * 5. Payout Successfully Completed Alert
   */
  payoutSuccessful: (amountNgn: number, bankName: string, accountLast4: string, ref: string): string =>
    `Lonkind: Payout of ₦${amountNgn.toLocaleString()} to ${bankName} (*${accountLast4}) has been successfully completed! Ref: ${ref}. Thank you for creating on Lonkind.`,

  /**
   * 6. Security / New Login Alert
   */
  securityLoginAlert: (deviceOrLocation: string, timeString: string): string =>
    `Lonkind Security Alert: New login detected on ${deviceOrLocation} at ${timeString}. If this wasn't you, secure your account at https://lonkind.com`,
};

/**
 * Normalizes phone numbers into Termii's required telecom format:
 * - Strips whitespace, dashes, plus signs, brackets
 * - Converts Nigerian local formats (e.g. '080...', '090...', '070...') into international '23480...'
 */
export function formatPhoneNumberForTermii(phone: string): string {
  let cleaned = phone.replace(/[\s\-()+]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    // 11-digit Nigerian mobile (e.g. 08012345678 -> 2348012345678)
    cleaned = '234' + cleaned.substring(1);
  }
  return cleaned;
}

function getTermiiConfig() {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID || 'Lonkind';
  const baseUrl = process.env.TERMII_BASE_URL || 'https://api.ng.termii.com';

  return { apiKey, senderId, baseUrl };
}

/**
 * Sends an SMS message via Termii with automatic DND channel failover
 */
export async function sendTermiiSms(params: SendSmsParams): Promise<TermiiResponse> {
  const { apiKey, senderId, baseUrl } = getTermiiConfig();

  if (!apiKey || apiKey === 'your_termii_api_key_here') {
    return {
      success: false,
      error: 'Termii API Key is not configured in .env',
    };
  }

  const formattedTo = formatPhoneNumberForTermii(params.to);
  const primaryChannel = params.channel || 'generic';

  try {
    // Attempt 1: Dispatch on specified channel
    let response = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedTo,
        from: senderId,
        sms: params.message,
        type: 'plain',
        channel: primaryChannel,
        api_key: apiKey,
      }),
    });

    let data = await response.json();

    if (response.ok && (data.message_id || data.code === 'ok' || data.message === 'Successfully Sent')) {
      return {
        success: true,
        messageId: data.message_id,
        raw: data,
      };
    }

    // Attempt 2: If generic channel failed (e.g. DND-active number or route restriction), fallback to DND channel
    if (primaryChannel === 'generic') {
      const fallbackResponse = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formattedTo,
          from: senderId,
          sms: params.message,
          type: 'plain',
          channel: 'dnd',
          api_key: apiKey,
        }),
      });

      const fallbackData = await fallbackResponse.json();

      if (fallbackResponse.ok && (fallbackData.message_id || fallbackData.code === 'ok')) {
        return {
          success: true,
          messageId: fallbackData.message_id,
          raw: fallbackData,
        };
      }
    }

    return {
      success: false,
      error: data.message || data.error || 'Failed to send SMS via Termii',
      raw: data,
    };
  } catch (error: any) {
    console.error('[Termii] Server error sending SMS:', error);
    return {
      success: false,
      error: error.message || 'Network error communicating with Termii SMS gateway',
    };
  }
}

/**
 * Dispatches an OTP verification code via Termii's dedicated OTP engine
 */
export async function sendTermiiOtp(params: SendOtpParams): Promise<TermiiResponse> {
  const { apiKey, senderId, baseUrl } = getTermiiConfig();

  if (!apiKey || apiKey === 'your_termii_api_key_here') {
    return {
      success: false,
      error: 'Termii API Key is not configured in .env',
    };
  }

  const formattedTo = formatPhoneNumberForTermii(params.to);
  const pinLength = params.pinLength || 6;
  const pinTimeToLive = params.pinTimeToLive || 10;
  const messageText = params.messageText || `Your Lonkind verification code is < 1234 >. Valid for ${pinTimeToLive} minutes. Never share this code with anyone.`;
  const channel = params.channel || 'generic';

  try {
    const response = await fetch(`${baseUrl}/api/sms/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        message_type: 'NUMERIC',
        to: formattedTo,
        from: senderId,
        channel: channel,
        pin_attempts: 5,
        pin_time_to_live: pinTimeToLive,
        pin_length: pinLength,
        pin_placeholder: '< 1234 >',
        message_text: messageText,
      }),
    });

    const data = await response.json();

    if (response.ok && data.pinId) {
      return {
        success: true,
        pinId: data.pinId,
        raw: data,
      };
    }

    // If generic channel OTP fails, retry using dnd channel
    if (channel === 'generic') {
      const dndRetry = await fetch(`${baseUrl}/api/sms/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          message_type: 'NUMERIC',
          to: formattedTo,
          from: senderId,
          channel: 'dnd',
          pin_attempts: 5,
          pin_time_to_live: pinTimeToLive,
          pin_length: pinLength,
          pin_placeholder: '< 1234 >',
          message_text: messageText,
        }),
      });

      const dndData = await dndRetry.json();
      if (dndRetry.ok && dndData.pinId) {
        return {
          success: true,
          pinId: dndData.pinId,
          raw: dndData,
        };
      }
    }

    return {
      success: false,
      error: data.message || data.error || 'Failed to send OTP code via Termii',
      raw: data,
    };
  } catch (error: any) {
    console.error('[Termii] Server error sending OTP:', error);
    return {
      success: false,
      error: error.message || 'Network error communicating with Termii OTP service',
    };
  }
}

/**
 * Verifies an OTP code submitted by the user
 */
export async function verifyTermiiOtp(params: VerifyOtpParams): Promise<TermiiResponse> {
  const { apiKey, baseUrl } = getTermiiConfig();

  if (!apiKey || apiKey === 'your_termii_api_key_here') {
    return {
      success: false,
      error: 'Termii API Key is not configured in .env',
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/sms/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        pin_id: params.pinId,
        pin: params.pin,
      }),
    });

    const data = await response.json();

    if (data.verified === true || data.verified === 'true') {
      return {
        success: true,
        verified: true,
        raw: data,
      };
    }

    return {
      success: false,
      verified: false,
      error: data.message || 'Invalid or expired verification code',
      raw: data,
    };
  } catch (error: any) {
    console.error('[Termii] Server error verifying OTP:', error);
    return {
      success: false,
      error: error.message || 'Network error verifying Termii OTP',
    };
  }
}

/**
 * Retrieves the real-time wallet balance and currency from Termii
 */
export async function getTermiiBalance(): Promise<TermiiResponse> {
  const { apiKey, baseUrl } = getTermiiConfig();

  if (!apiKey || apiKey === 'your_termii_api_key_here') {
    return {
      success: false,
      error: 'Termii API Key is not configured in .env',
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/get-balance?api_key=${apiKey}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (response.ok && data.balance !== undefined) {
      return {
        success: true,
        balance: data.balance,
        currency: data.currency,
        raw: data,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch Termii balance',
      raw: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to communicate with Termii balance API',
    };
  }
}
