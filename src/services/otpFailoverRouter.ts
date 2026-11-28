import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { writeSecurityAuditLog } from '@/lib/security-shield';

export type OtpProviderId = 'firebase' | 'sendchamp' | 'backup_sms';
export type OtpProviderHealth = 'active' | 'low_credit_or_failed' | 'disabled';

export interface OtpProviderConfig {
  id: OtpProviderId;
  label: string;
  description: string;
  enabled: boolean;
  priority: number; // 1 = highest
  health: OtpProviderHealth;
  lastError?: string | null;
  lastFailedAt?: string | null;
}

export const DEFAULT_OTP_PROVIDERS: OtpProviderConfig[] = [
  {
    id: 'firebase',
    label: 'Firebase Phone Auth',
    description: 'Primary — Active immediately out of the box via Firebase Phone Auth',
    enabled: true,
    priority: 1,
    health: 'active',
    lastError: null,
    lastFailedAt: null,
  },
  {
    id: 'sendchamp',
    label: 'SendChamp SMS API',
    description: 'Secondary — SENDCHAMP_API_KEY / SENDCHAMP_SENDER_ID',
    enabled: true,
    priority: 2,
    health: 'active',
    lastError: null,
    lastFailedAt: null,
  },
  {
    id: 'backup_sms',
    label: 'Backup SMS Gateway (Termii / Twilio)',
    description: 'Tertiary Failover — BACKUP_SMS_API_KEY / TERMII_API_KEY / TWILIO',
    enabled: true,
    priority: 3,
    health: 'active',
    lastError: null,
    lastFailedAt: null,
  },
];

const CONFIG_DOC_REF = () => adminDb.collection('platform_settings').doc('otp_failover_config');
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

export function normalizeToE164(rawPhone: string): string | null {
  const cleaned = String(rawPhone || '').trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return null;
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  if (!/^\+[1-9]\d{6,14}$/.test(withPlus)) return null;
  return withPlus;
}

export function hashOtpCode(uid: string, phoneE164: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`lonkind_phone_otp:${uid}:${phoneE164}:${code.trim()}`, 'utf8')
    .digest('hex');
}

export async function getOtpFailoverConfig(): Promise<OtpProviderConfig[]> {
  try {
    const snap = await CONFIG_DOC_REF().get();
    if (!snap.exists) return [...DEFAULT_OTP_PROVIDERS];
    const stored = snap.data()?.providers;
    if (!Array.isArray(stored) || stored.length === 0) {
      return [...DEFAULT_OTP_PROVIDERS];
    }
    const merged = DEFAULT_OTP_PROVIDERS.map((def) => {
      const found = stored.find((s: any) => s?.id === def.id);
      if (!found) return def;
      return {
        ...def,
        enabled: found.enabled !== false,
        priority: typeof found.priority === 'number' ? found.priority : def.priority,
        health:
          found.enabled === false
            ? ('disabled' as const)
            : found.health === 'low_credit_or_failed'
            ? ('low_credit_or_failed' as const)
            : ('active' as const),
        lastError: found.lastError || null,
        lastFailedAt: found.lastFailedAt || null,
      };
    });
    return merged.sort((a, b) => a.priority - b.priority);
  } catch {
    return [...DEFAULT_OTP_PROVIDERS];
  }
}

export async function saveOtpFailoverConfig(
  providers: OtpProviderConfig[],
  updatedByUid: string
): Promise<OtpProviderConfig[]> {
  const normalized = providers
    .map((p, idx) => ({
      ...p,
      priority: typeof p.priority === 'number' ? p.priority : idx + 1,
      health: !p.enabled
        ? ('disabled' as const)
        : p.health === 'low_credit_or_failed'
        ? ('low_credit_or_failed' as const)
        : ('active' as const),
    }))
    .sort((a, b) => a.priority - b.priority);

  await CONFIG_DOC_REF().set(
    {
      providers: normalized,
      updatedByUid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return normalized;
}

async function markProviderFailedAndAlert(params: {
  providerId: OtpProviderId;
  errorMessage: string;
  uid: string;
  ipAddress: string;
  userAgent: string;
  nextProviderId?: OtpProviderId | null;
}) {
  try {
    const current = await getOtpFailoverConfig();
    const updated = current.map((p) =>
      p.id === params.providerId
        ? {
            ...p,
            health: p.enabled ? ('low_credit_or_failed' as const) : ('disabled' as const),
            lastError: params.errorMessage.slice(0, 240),
            lastFailedAt: new Date().toISOString(),
          }
        : p
    );
    await CONFIG_DOC_REF().set(
      { providers: updated, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch {
    // Non-blocking health update
  }

  await writeSecurityAuditLog({
    action: 'sms_provider_failover',
    actorUid: params.uid,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    status: 'failed',
    details: {
      failedProvider: params.providerId,
      redirectedTo: params.nextProviderId || 'none',
      error: params.errorMessage.slice(0, 200),
    },
  });
}

async function dispatchViaSendChamp(
  phoneE164: string,
  otpCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.SENDCHAMP_API_KEY || '';
  const senderId = process.env.SENDCHAMP_SENDER_ID || 'Lonkind';
  if (!apiKey || apiKey.includes('xxxxxxx')) {
    return { ok: false, error: 'SendChamp API key is not configured.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://api.sendchamp.com/api/v1/sms/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [phoneE164.replace(/^\+/, '')],
        message: `Your Lonkind verification code is ${otpCode}. Valid for 10 minutes. Never share this code.`,
        sender_name: senderId,
        route: 'dnd',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => null);
    if (res.ok && (data?.status === 'success' || data?.code === 200)) {
      return { ok: true };
    }
    return {
      ok: false,
      error: String(data?.message || data?.error || `SendChamp HTTP ${res.status}`),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'SendChamp network timeout' };
  }
}

async function dispatchViaBackupSms(
  phoneE164: string,
  otpCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const backupApiKey = process.env.BACKUP_SMS_API_KEY || process.env.TERMII_API_KEY || '';
  const backupSender = process.env.BACKUP_SMS_SENDER_ID || process.env.TERMII_SENDER_ID || 'Lonkind';
  const baseUrl = (process.env.TERMII_BASE_URL || 'https://v3.api.termii.com').replace(/\/$/, '');

  // Adapter A: Termii / generic backup SMS key
  if (backupApiKey && !backupApiKey.includes('xxxxxxx')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneE164.replace(/^\+/, ''),
          from: backupSender,
          sms: `Your Lonkind verification code is ${otpCode}. Valid for 10 minutes.`,
          type: 'plain',
          channel: 'generic',
          api_key: backupApiKey,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.message_id || data?.code === 'ok')) {
        return { ok: true };
      }
      return { ok: false, error: String(data?.message || `Backup SMS HTTP ${res.status}`) };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Backup SMS network timeout' };
    }
  }

  // Adapter B: Twilio REST fallback if configured
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || '';
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || '';
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const creds = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const form = new URLSearchParams({
        To: phoneE164,
        From: twilioFrom,
        Body: `Your Lonkind verification code is ${otpCode}. Valid for 10 minutes.`,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      );
      if (res.ok) return { ok: true };
      const errData = await res.json().catch(() => null);
      return { ok: false, error: String(errData?.message || `Twilio HTTP ${res.status}`) };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Twilio network error' };
    }
  }

  return { ok: false, error: 'Backup SMS gateway credentials are not configured.' };
}

export type SendMandatoryOtpResult =
  | {
      success: true;
      mode: 'firebase_client' | 'server_sms';
      providerUsed: OtpProviderId;
      providerLabel: string;
      phoneE164: string;
      failoverTrace: string[];
      expiresAtIso: string;
    }
  | {
      success: false;
      status: number;
      error: string;
      failoverTrace: string[];
    };

/**
 * Unified 3-Provider Automatic SMS Failover Dispatcher (`sendMandatoryOtp`):
 *  - Enforces 1-phone-per-account uniqueness in `phone_registry/{e164Phone}`
 *  - Attempts Priority 1 -> Priority 2 -> Priority 3 automatically on failure/out-of-credit
 *  - Stores SHA-256 hashed 6-digit OTP (`expiresAt: 10 min`, `attempts: max 5`) in `otp_verifications/{uid}`
 */
export async function sendMandatoryOtp(params: {
  uid: string;
  rawPhone: string;
  skipProviders?: OtpProviderId[];
  failedClientProvider?: { id: OtpProviderId; error: string };
  ipAddress: string;
  userAgent: string;
}): Promise<SendMandatoryOtpResult> {
  const phoneE164 = normalizeToE164(params.rawPhone);
  if (!phoneE164) {
    return {
      success: false,
      status: 400,
      error: 'Please enter a valid international phone number (e.g., +14155552671 or +2348012345678).',
      failoverTrace: [],
    };
  }

  // Strict 1-phone-per-account uniqueness check
  const registrySnap = await adminDb.collection('phone_registry').doc(phoneE164).get();
  if (registrySnap.exists && registrySnap.data()?.uid && registrySnap.data()?.uid !== params.uid) {
    return {
      success: false,
      status: 409,
      error: 'This phone number is already registered to another Lonkind account.',
      failoverTrace: [],
    };
  }

  const failoverTrace: string[] = [];

  // Record client-side Firebase Phone Auth failure if the client is failing over
  if (params.failedClientProvider) {
    failoverTrace.push(`${params.failedClientProvider.id}: ${params.failedClientProvider.error}`);
    await markProviderFailedAndAlert({
      providerId: params.failedClientProvider.id,
      errorMessage: params.failedClientProvider.error,
      uid: params.uid,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      nextProviderId: 'sendchamp',
    });
  }

  const providers = await getOtpFailoverConfig();
  const skipSet = new Set<OtpProviderId>(params.skipProviders || []);
  const eligible = providers.filter((p) => p.enabled && !skipSet.has(p.id));

  if (eligible.length === 0) {
    return {
      success: false,
      status: 503,
      error: 'No SMS OTP providers are currently available. Please try again shortly.',
      failoverTrace,
    };
  }

  // Generate cryptographically secure 6-digit OTP & store hashed copy in `otp_verifications/{uid}`
  const otpCode = String(crypto.randomInt(100000, 1000000));
  const otpHash = hashOtpCode(params.uid, phoneE164, otpCode);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  for (let i = 0; i < eligible.length; i++) {
    const provider = eligible[i];
    const nextProvider = eligible[i + 1] || null;

    if (provider.id === 'firebase') {
      // Hand off to client Firebase Phone Auth (client automatically retries with skipProviders=['firebase'] if Firebase fails)
      await adminDb.collection('otp_verifications').doc(params.uid).set({
        uid: params.uid,
        phoneE164,
        otpHash,
        providerUsed: 'firebase',
        attempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        success: true,
        mode: 'firebase_client',
        providerUsed: 'firebase',
        providerLabel: provider.label,
        phoneE164,
        failoverTrace,
        expiresAtIso: expiresAt.toISOString(),
      };
    }

    const dispatchRes =
      provider.id === 'sendchamp'
        ? await dispatchViaSendChamp(phoneE164, otpCode)
        : await dispatchViaBackupSms(phoneE164, otpCode);

    if (dispatchRes.ok) {
      await adminDb.collection('otp_verifications').doc(params.uid).set({
        uid: params.uid,
        phoneE164,
        otpHash,
        providerUsed: provider.id,
        attempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        mode: 'server_sms',
        providerUsed: provider.id,
        providerLabel: provider.label,
        phoneE164,
        failoverTrace,
        expiresAtIso: expiresAt.toISOString(),
      };
    }

    // Automatic silent failover to the next provider + audit alert for `mow`
    failoverTrace.push(`${provider.id}: ${dispatchRes.error}`);
    await markProviderFailedAndAlert({
      providerId: provider.id,
      errorMessage: dispatchRes.error,
      uid: params.uid,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      nextProviderId: nextProvider?.id || null,
    });
  }

  return {
    success: false,
    status: 502,
    error:
      'We could not deliver the SMS code via our primary or backup gateways right now. Please check your phone number and try again.',
    failoverTrace,
  };
}

/**
 * Verifies a 6-digit OTP (or Firebase Phone Auth confirmation) and atomically registers
 * `phone_registry/{e164Phone}` so every verified phone number is strictly unique per account.
 */
export async function verifyMandatoryOtp(params: {
  uid: string;
  rawPhone: string;
  code?: string;
  verifiedByFirebaseAuth?: boolean;
}): Promise<{ ok: true; phoneE164: string; providerUsed: string } | { ok: false; status: number; error: string }> {
  const phoneE164 = normalizeToE164(params.rawPhone);
  if (!phoneE164) {
    return { ok: false, status: 400, error: 'Invalid phone number format.' };
  }

  const otpRef = adminDb.collection('otp_verifications').doc(params.uid);
  const regRef = adminDb.collection('phone_registry').doc(phoneE164);
  const userRef = adminDb.collection('users').doc(params.uid);

  let providerUsed = params.verifiedByFirebaseAuth ? 'firebase' : 'server_sms';

  try {
    await adminDb.runTransaction(async (tx) => {
      const [regSnap, otpSnap] = await Promise.all([tx.get(regRef), tx.get(otpRef)]);

      if (regSnap.exists && regSnap.data()?.uid && regSnap.data()?.uid !== params.uid) {
        throw new Error('PHONE_ALREADY_USED');
      }

      if (!params.verifiedByFirebaseAuth) {
        const cleanCode = String(params.code || '').replace(/\D/g, '').slice(0, 6);
        if (cleanCode.length !== 6) {
          throw new Error('INVALID_CODE_LENGTH');
        }
        if (!otpSnap.exists) {
          throw new Error('OTP_NOT_FOUND');
        }
        const otpData = otpSnap.data()!;
        const expiresAtMs = otpData.expiresAt?.toMillis?.() || 0;
        if (Date.now() > expiresAtMs) {
          tx.delete(otpRef);
          throw new Error('OTP_EXPIRED');
        }
        const attempts = Number(otpData.attempts || 0);
        if (attempts >= Number(otpData.maxAttempts || OTP_MAX_ATTEMPTS)) {
          tx.delete(otpRef);
          throw new Error('OTP_MAX_ATTEMPTS');
        }
        if (otpData.phoneE164 !== phoneE164) {
          throw new Error('OTP_PHONE_MISMATCH');
        }

        const expectedHex = String(otpData.otpHash || '');
        const providedHex = hashOtpCode(params.uid, phoneE164, cleanCode);
        const matches =
          expectedHex.length === providedHex.length &&
          crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(providedHex, 'hex'));

        if (!matches) {
          tx.update(otpRef, { attempts: FieldValue.increment(1) });
          throw new Error('OTP_MISMATCH');
        }
        providerUsed = String(otpData.providerUsed || 'sendchamp');
      }

      // Claim unique phone number in `phone_registry/{e164Phone}`
      tx.set(regRef, {
        uid: params.uid,
        phoneE164,
        providerUsed,
        verifiedAt: FieldValue.serverTimestamp(),
      });

      // Mark user's phone as verified
      tx.set(
        userRef,
        {
          phoneNumber: phoneE164,
          phoneVerified: true,
          phoneVerificationProvider: providerUsed,
          phoneVerifiedAt: FieldValue.serverTimestamp(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (otpSnap.exists) {
        tx.delete(otpRef);
      }
    });

    return { ok: true, phoneE164, providerUsed };
  } catch (err: any) {
    const code = err?.message || '';
    if (code === 'PHONE_ALREADY_USED') {
      return {
        ok: false,
        status: 409,
        error: 'This phone number is already linked to another Lonkind account.',
      };
    }
    if (code === 'INVALID_CODE_LENGTH') {
      return { ok: false, status: 400, error: 'Please enter the 6-digit verification code.' };
    }
    if (code === 'OTP_NOT_FOUND') {
      return { ok: false, status: 400, error: 'No active code found. Please request a new SMS code.' };
    }
    if (code === 'OTP_EXPIRED') {
      return { ok: false, status: 400, error: 'Your code has expired. Tap Resend to get a fresh code.' };
    }
    if (code === 'OTP_MAX_ATTEMPTS') {
      return { ok: false, status: 429, error: 'Too many wrong attempts. Please request a new SMS code.' };
    }
    if (code === 'OTP_PHONE_MISMATCH' || code === 'OTP_MISMATCH') {
      return { ok: false, status: 400, error: 'Incorrect 6-digit code. Please check and try again.' };
    }
    console.error('[verifyMandatoryOtp] Error:', err);
    return { ok: false, status: 500, error: 'Unable to verify phone code right now.' };
  }
}
