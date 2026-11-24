import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * ============================================================================
 * LONKIND DEFENSE-IN-DEPTH SECURITY SHIELD
 * - Server-side sliding-window rate limiting (Auth, Financial, Admin)
 * - XSS & HTML/JS payload sanitization + strict HTTPS ad URL validation
 * - Mass-assignment field stripping
 * - Strict positive integer guards for all wallet/gift/payout math
 * - Constant-time webhook signature verification (`crypto.timingSafeEqual`)
 * - Immutable `security_audit_logs` writer
 * ============================================================================
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_BUCKETS = new Map<string, RateBucket>();

export const RATE_LIMIT_PRESETS = {
  AUTH_BRUTE_FORCE: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  FINANCIAL_ACTION: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per min
  ADMIN_SENSITIVE: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per min
} as const;

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimit(params: {
  namespace: string;
  key: string;
  maxRequests: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const bucketKey = `${params.namespace}:${params.key}`;
  const existing = RATE_BUCKETS.get(bucketKey);

  // Periodic cleanup to prevent unbounded memory growth
  if (RATE_BUCKETS.size > 5000) {
    for (const [k, v] of RATE_BUCKETS.entries()) {
      if (now >= v.resetAt) RATE_BUCKETS.delete(k);
    }
  }

  if (!existing || now >= existing.resetAt) {
    RATE_BUCKETS.set(bucketKey, { count: 1, resetAt: now + params.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, params.maxRequests - 1),
      retryAfterSeconds: Math.ceil(params.windowMs / 1000),
    };
  }

  if (existing.count >= params.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, params.maxRequests - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function rateLimitExceededResponse(retryAfterSeconds = 60): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many attempts, please wait a moment',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Strips `<script>`, `<style>`, HTML tags, inline JS handlers, and dangerous URI
 * schemes to prevent stored/reflected XSS in captions, names, chat, and ad copy.
 */
export function sanitizePlainText(raw: unknown, maxLength = 500): string {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/\0/g, '');
  text = text.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\b(javascript|vbscript|data)\s*:/gi, '');
  text = text.replace(/\bon[a-z]{2,20}\s*=/gi, '');
  return text.trim().slice(0, maxLength);
}

const BLOCKED_AD_FILE_EXTENSIONS = /\.(exe|apk|bat|cmd|scr|msi|sh|dmg|ps1|vbs|jar|dll|com|pif)(\?|#|$)/i;

/**
 * Strict destination URL validator for ads:
 * - Allows internal single-slash app routes (`/live/...`, `/about`, etc.)
 * - Allows external `https://` URLs ONLY (blocks `javascript:`, `data:`, executable downloads)
 */
export function isStrictlySafeAdUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (/[\s<>'"`]/.test(trimmed)) return false;

  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !trimmed.includes('..');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return false;
    if (BLOCKED_AD_FILE_EXTENSIONS.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Mass Assignment Protection: copies ONLY explicitly whitelisted keys from an
 * untrusted request body, silently stripping privileged fields like `role`,
 * `isAdmin`, `coins`, `diamonds`, etc.
 */
export function pickAllowedFields<T extends Record<string, any>>(
  input: unknown,
  allowedKeys: readonly (keyof T)[]
): Partial<T> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const source = input as Record<string, any>;
  const safe: Partial<T> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      safe[key] = source[key as string];
    }
  }
  return safe;
}

/**
 * Strict Positive Integer Guard for wallet coins, gifts, and diamond payouts.
 * Rejects negative numbers, zero, NaN, Infinity, floats, and non-numbers.
 */
export function parseStrictPositiveInt(
  value: unknown,
  maxAllowed = 10_000_000
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value <= 0 || value > maxAllowed) return null;
  return value;
}

/**
 * Constant-time webhook signature verifier using `crypto.timingSafeEqual`
 * over SHA-256 digests so timing side-channels and length mismatches are impossible.
 */
export function verifyWebhookSignatureTimingSafe(
  providedSignature: string,
  expectedSecret: string
): boolean {
  if (!providedSignature || !expectedSecret) return false;
  const providedHash = crypto.createHash('sha256').update(providedSignature, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(expectedSecret, 'utf8').digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

export type SecurityAuditAction =
  | 'admin_login'
  | 'admin_2fa_requested'
  | 'admin_2fa_verified'
  | 'admin_2fa_failed'
  | 'admin_role_change'
  | 'admin_payout_decision'
  | 'admin_ad_refund'
  | 'admin_ad_manual_refund'
  | 'admin_platform_control'
  | 'failed_login_spike'
  | 'rate_limit_exceeded'
  | 'webhook_signature_rejected'
  | 'database_backup_created'
  | 'database_backup_downloaded';

/**
 * Appends an immutable entry to `security_audit_logs` (Admin SDK server-only).
 * Never throws so an audit write hiccup cannot crash a critical flow.
 */
export async function writeSecurityAuditLog(params: {
  action: SecurityAuditAction;
  actorUid?: string | null;
  actorHandle?: string | null;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'blocked' | 'failed';
  details: Record<string, any>;
}): Promise<void> {
  try {
    await adminDb.collection('security_audit_logs').add({
      action: params.action,
      actorUid: params.actorUid || 'anonymous',
      actorHandle: params.actorHandle || null,
      ipAddress: params.ipAddress || 'unknown',
      userAgent: (params.userAgent || '').slice(0, 200),
      status: params.status,
      details: params.details || {},
      immutable: true,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[security_audit_logs] Failed to persist audit entry:', err);
  }
}
