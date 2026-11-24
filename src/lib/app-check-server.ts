import { NextRequest, NextResponse } from 'next/server';
import { adminAppCheck, adminAuth } from '@/lib/firebase-admin';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';

/**
 * Verifies the `X-Firebase-AppCheck` header on sensitive endpoints (Gemini AI,
 * coin purchases, gift sending, ad creation).
 * - If a token is supplied, it is cryptographically verified via `adminAppCheck.verifyToken`.
 * - When `ENFORCE_APP_CHECK=true` in production env, requests missing a valid App Check
 *   token are immediately rejected with `401 Unauthorized` so bots outside `lonkind.com`
 *   cannot spam APIs or drain Gemini quota.
 */
export async function verifyAppCheckRequest(
  req: NextRequest,
  endpointName: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const token = req.headers.get('X-Firebase-AppCheck') || req.headers.get('x-firebase-appcheck') || '';

  if (!token) {
    if (ENFORCE_APP_CHECK) {
      await writeSecurityAuditLog({
        action: 'rate_limit_exceeded',
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || '',
        status: 'blocked',
        details: { endpoint: endpointName, reason: 'MISSING_APP_CHECK_TOKEN' },
      });
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'App verification required. Please use the official Lonkind app.' },
          { status: 401 }
        ),
      };
    }
    return { ok: true };
  }

  try {
    await adminAppCheck.verifyToken(token);
    return { ok: true };
  } catch {
    if (ENFORCE_APP_CHECK) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Invalid or expired App Check token.' },
          { status: 401 }
        ),
      };
    }
    return { ok: true };
  }
}

/**
 * Combined App Check + Per-User Gemini AI Quota Guard (15 requests / 10 minutes).
 * Prevents any single user or automated script from draining Gemini AI API quota.
 */
export async function guardGeminiAiEndpoint(
  req: NextRequest,
  endpointName: string,
  maxRequests = 15,
  windowMs = 10 * 60 * 1000
): Promise<{ ok: true; actorKey: string } | { ok: false; response: NextResponse }> {
  const appCheck = await verifyAppCheckRequest(req, endpointName);
  if (!appCheck.ok) return appCheck;

  let actorKey = getClientIp(req);
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
      if (decoded?.uid) actorKey = `uid:${decoded.uid}`;
    } catch {
      // Fall back to IP key if token is absent/expired
    }
  }

  const rl = checkRateLimit({
    namespace: `gemini_${endpointName}`,
    key: actorKey,
    maxRequests,
    windowMs,
  });

  if (!rl.allowed) {
    await writeSecurityAuditLog({
      action: 'rate_limit_exceeded',
      actorUid: actorKey.startsWith('uid:') ? actorKey.slice(4) : 'anonymous',
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent') || '',
      status: 'blocked',
      details: { endpoint: endpointName, quotaType: 'gemini_ai' },
    });
    return {
      ok: false,
      response: rateLimitExceededResponse(rl.retryAfterSeconds),
    };
  }

  return { ok: true, actorKey };
}
