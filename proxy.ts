import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// The browser extension's content script runs on arbitrary tabs (Google Meet,
// Zoom Web, YouTube, etc.) and talks to this backend cross-origin, so the
// live-meeting/API surface needs permissive CORS headers + preflight handling.
function withCors(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') {
      return withCors(new NextResponse(null, { status: 204 }), request);
    }
    return withCors(NextResponse.next(), request);
  }

  const session = request.cookies.get('session')?.value;

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users trying to access login back to landing page
  if (pathname === '/login') {
    if (session) {
      const landingUrl = new URL('/', request.url);
      return NextResponse.redirect(landingUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/:path*']
};
