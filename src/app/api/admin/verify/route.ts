import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/verify
 * Strict server-side Super-Admin verification endpoint for `/admin` and `/admin/*`.
 */
export async function GET(req: NextRequest) {
  const result = await verifySuperAdminRequest(req);
  if (!result.authorized) {
    return NextResponse.json(
      { authorized: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    authorized: true,
    uid: result.uid,
    role: result.role,
    handle: result.handle || 'mow',
    name: result.userData?.name || 'Prosper Amoma',
  });
}
