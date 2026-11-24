import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_PROD_ORIGINS = new Set([
  'https://lonkind.com',
  'https://www.lonkind.com',
  'https://impactful-ideas.web.app',
  'https://impactful-ideas.firebaseapp.com',
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true;
  if (ALLOWED_PROD_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      (parsed.protocol === 'https:' || parsed.protocol === 'http:')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

/**
 * Defense-in-Depth Middleware:
 * - Enforces strict CORS on `/api/*` allowing only `https://lonkind.com` & local dev origins.
 * - Attaches standard HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`,
 *   `Referrer-Policy`) to all matched responses.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin') || '';

  if (pathname.startsWith('/api/')) {
    const allowed = isAllowedOrigin(origin);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      if (origin && !allowed) {
        return applySecurityHeaders(
          new NextResponse(JSON.stringify({ error: 'CORS origin not allowed.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      const preflight = new NextResponse(null, { status: 204 });
      if (origin && allowed) {
        preflight.headers.set('Access-Control-Allow-Origin', origin);
        preflight.headers.set('Access-Control-Allow-Credentials', 'true');
        preflight.headers.set(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        );
        preflight.headers.set(
          'Access-Control-Allow-Headers',
          'Authorization, Content-Type, X-Requested-With'
        );
        preflight.headers.set('Vary', 'Origin');
      }
      return applySecurityHeaders(preflight);
    }

    // Block cross-origin API calls from unauthorized origins (webhooks have no Origin header)
    if (origin && !allowed) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Origin not permitted by Lonkind CORS policy.' }, { status: 403 })
      );
    }

    const res = NextResponse.next();
    if (origin && allowed) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Credentials', 'true');
      res.headers.set('Vary', 'Origin');
    }
    return applySecurityHeaders(res);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/api/:path*'],
};
