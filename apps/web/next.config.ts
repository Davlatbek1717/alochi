import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
// next-intl plugin wires the server-side getRequestConfig.
// Uncomment once pages are migrated to [locale] folder structure (Phase 6b).
// import createNextIntlPlugin from 'next-intl/plugin';
// const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // /api/** must NEVER be cached — RBAC + tenant scoping must always re-check on the server
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
      // login pages must never be cached (root + tenant-scoped variants)
      {
        urlPattern: /\/login(\/|$)/,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /\/[^/]+\/login(\/|$)/,
        handler: 'NetworkOnly',
      },
      // documents fall back to network-first (still works offline via fallback page)
      {
        urlPattern: ({ request }: { request: Request }) => request.destination === 'document',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 5,
        },
      },
    ],
  },
});

/**
 * Headers applied to every HTTP response served by Next. The browser
 * enforces these regardless of the route, so they're our defence
 * against clickjacking, MIME-sniffing, and a future CSP rollout.
 *
 * NOTE on Content-Security-Policy: Next 15 + the AI tutor + Mediapipe
 * face SDK currently rely on `unsafe-inline` styles and `wasm-unsafe-eval`,
 * so a strict CSP would break the lesson runner. We ship a permissive
 * scaffold here so the headers are present and tunable, and leave
 * tightening it (nonce-based scripts, hashed inline styles) as Phase 28.
 */
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=()',
  },
  // HSTS only makes sense in production. Hosts behind localhost would
  // otherwise force every dev session into HTTPS-only mode.
  ...(process.env.NODE_ENV === 'production'
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// withNextIntl wrapping deferred until [locale] folder migration (Phase 6b).
export default withPWA(nextConfig);
