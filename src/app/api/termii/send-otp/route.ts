import { NextRequest, NextResponse } from 'next/server';
import { sendTermiiOtp } from '@/lib/termii';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  writeSecurityAuditLog,
} from '@/lib/security-shield';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number (to) is required.' },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const rl = checkRateLimit({
      namespace: 'termii_send_otp',
      key: `${clientIp}:${String(to).trim()}`,
      ...RATE_LIMIT_PRESETS.AUTH_BRUTE_FORCE,
    });
    if (!rl.allowed) {
      await writeSecurityAuditLog({
        action: 'failed_login_spike',
        ipAddress: clientIp,
        userAgent: req.headers.get('user-agent') || '',
        status: 'blocked',
        details: { endpoint: '/api/termii/send-otp' },
      });
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const result = await sendTermiiOtp({
      to,
      pinLength: 6,
      pinTimeToLive: 10,
      messageText: 'Your Lonkind verification code is < 1234 >. Valid for 10 minutes.',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch verification code' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      pinId: result.pinId,
      message: 'Verification code sent successfully via SMS',
    });
  } catch (error: any) {
    console.error('Termii send-otp API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
