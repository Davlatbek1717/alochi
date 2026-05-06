import { NextRequest, NextResponse } from 'next/server';

/**
 * Tenant subdomain resolution.
 *
 * abc-english.adouptivo.com → forward as-is; Next.js pages read the
 * x-tenant-slug request header that this middleware injects. Full
 * custom domain support (abc.uz) will be wired here once wildcard
 * TLS is configured on the reverse proxy.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const subdomain = hostname.split('.')[0];

  const isRootDomain =
    ['www', 'adouptivo', 'localhost', 'app'].includes(subdomain) ||
    (!subdomain.includes('-') && subdomain.length < 4);

  const requestHeaders = new Headers(request.headers);
  if (!isRootDomain) {
    requestHeaders.set('x-tenant-slug', subdomain);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
