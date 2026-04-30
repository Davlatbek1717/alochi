import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

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

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
