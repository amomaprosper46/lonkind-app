import { NextResponse } from 'next/server';

// Simple ping endpoint. Returns 200 OK quickly.
// The optional `ts` query param is ignored; it's used to bust caches.
export async function GET(request: Request) {
  // No heavy processing; just respond immediately.
  return NextResponse.json({ ok: true, timestamp: Date.now() });
}

export const dynamic = 'force-dynamic'; // Ensure no caching at the edge.
