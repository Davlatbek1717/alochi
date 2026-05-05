import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18n = createIntlMiddleware(routing);

/**
 * Combined middleware: tenant subdomain resolution + i18n locale routing.
 *
 * Subdomain resolution (Phase 8 — Tenant Custom Domain):
 *   abc-english.adouptivo.com → forward as-is; Next.js pages can read
 *   the x-tenant-slug request header that this middleware injects.
 *   Full custom domain support (abc.uz) will be wired here once
 *   wildcard TLS is configured on the reverse proxy.
 *
 * For now the slug is extracted from the first subdomain segment and
 * injected as x-tenant-slug so login pages and branding loaders can
 * read it without needing to parse the hostname themselves.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  // Extract the first subdomain segment (e.g. "abc-english" from
  // "abc-english.adouptivo.com" or "abc-english.localhost:3000").
  const subdomain = hostname.split('.')[0];

  // Exclude bare domains (www, adouptivo, localhost) — those are the
  // platform root and don't carry a tenant slug.
  const isRootDomain =
    ['www', 'adouptivo', 'localhost', 'app'].includes(subdomain) ||
    !subdomain.includes('-') && subdomain.length < 4;

  // Clone headers so we can inject x-tenant-slug for downstream pages.
  const requestHeaders = new Headers(request.headers);
  if (!isRootDomain) {
    requestHeaders.set('x-tenant-slug', subdomain);
  }

  const response = handleI18n(
    new NextRequest(request, { headers: requestHeaders }),
  );
  if (response) return response;
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
