// k6 load test for the A'lochi student lesson flow.
//
// Purpose: smoke a realistic student session (login -> me -> next lesson ->
// progress) under sustained load and verify SLOs:
//   - p95 latency < 500ms
//   - request error rate < 5%
//
// USAGE:
//   k6 run test/load/lesson-flow.js
//
// Required local install (one-off):
//   - Windows : winget install k6 --id Grafana.k6
//   - macOS   : brew install k6
//   - Linux   : https://grafana.com/docs/k6/latest/set-up/install-k6/
//
// ENVIRONMENT (override via -e KEY=VALUE):
//   API_URL        Base URL of the API to hit. Default: http://localhost:3001
//                  Use the staging URL for realistic load — this script is
//                  NOT intended to be run against production.
//   LOAD_LOGIN     Login of the seeded student account.  Default: student.test
//   LOAD_PASSWORD  Password for the seeded account.       Default: Test1234!
//
// Example (staging):
//   k6 run -e API_URL=https://staging-api.alochi.uz \
//          -e LOAD_LOGIN=loadtest.student \
//          -e LOAD_PASSWORD=*** \
//          test/load/lesson-flow.js

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up
    { duration: '2m',  target: 100 },  // ramp to peak
    { duration: '30s', target: 100 },  // hold peak
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const LOGIN = __ENV.LOAD_LOGIN || 'student.test';
const PASSWORD = __ENV.LOAD_PASSWORD || 'Test1234!';

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ login: LOGIN, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(res, { 'login 200/201': (r) => r.status === 200 || r.status === 201 });

  let token;
  try {
    const body = res.json();
    token = body?.data?.accessToken ?? body?.accessToken;
  } catch (_e) {
    token = undefined;
  }

  if (!token) {
    throw new Error(`setup: failed to obtain access token (status=${res.status})`);
  }
  return { token };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  const r1 = http.get(`${BASE_URL}/users/me`, { headers });
  check(r1, { 'me 200': (r) => r.status === 200 });
  sleep(1);

  const r2 = http.get(`${BASE_URL}/lessons/next`, { headers });
  check(r2, { 'next 200/404': (r) => r.status === 200 || r.status === 404 });
  sleep(1);

  const r3 = http.get(`${BASE_URL}/progress/my`, { headers });
  check(r3, { 'progress 200': (r) => r.status === 200 });
  sleep(2);
}
