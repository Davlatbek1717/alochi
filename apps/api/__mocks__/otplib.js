'use strict';
// CJS-compatible mock for otplib v13 (ESM-only, breaks Jest).
// Used only in unit tests — the real library runs in production.
const crypto = require('crypto');

function generateSecret(opts) {
  const len = (opts && opts.length) || 20;
  return crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len);
}

function generateSync(opts) {
  return '123456'; // deterministic mock token
}

function verifySync(opts) {
  if (!opts || !opts.token || !opts.secret) return false;
  // Accept any 6-digit numeric code as valid in tests.
  return /^\d{6}$/.test(opts.token) ? { delta: 0 } : false;
}

function generateURI(opts) {
  const label = (opts && opts.label) || '';
  const issuer = (opts && opts.issuer) || '';
  const secret = (opts && opts.secret) || '';
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
}

module.exports = {
  generateSecret,
  generateSync,
  verifySync,
  generateURI,
};
