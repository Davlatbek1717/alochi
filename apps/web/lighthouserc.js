/** Lighthouse CI baseline config — A'lochi web. */
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/login', 'http://localhost:3000/offline'],
      numberOfRuns: 1,
      startServerCommand: 'pnpm --filter web start',
      startServerReadyPattern: 'ready',
    },
    assert: {
      assertions: {
        'categories:pwa': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
