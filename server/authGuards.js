// server/authGuards.js
// Pure auth-check helpers shared by server.js endpoints.
// Extracted so the security logic is unit-testable without booting the
// server monolith (server.js auto-listens on import).
//
// Two guards:
// - checkAdminPassword: x-admin-password header vs ADMIN_PASSWORD_HASH.
//   Rejects with 503 when the hash is unset so a misconfigured deploy
//   fails CLOSED (DEF-5: the old bare `!==` comparison let '' === ''
//   pass and exposed the debug endpoints).
// - checkFeedbackAccess: admin password OR the FEEDBACK_TOKEN secret.
//   Used by the feedback read/PATCH endpoints (DEF-6) so both the
//   admin dashboard panel and token-holding maintainer scripts work.

import crypto from 'crypto';

export function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Validate an x-admin-password header value against the configured hash.
 * @param {unknown} headerValue - raw header value (string | string[] | undefined)
 * @param {string | undefined} expectedHash - CONFIG.ADMIN_PASSWORD_HASH (sha256 hex)
 * @returns {{ok: true} | {ok: false, status: number, error: string}}
 */
export function checkAdminPassword(headerValue, expectedHash) {
  if (!expectedHash) {
    return { ok: false, status: 503, error: 'Admin endpoints disabled: ADMIN_PASSWORD_HASH not set' };
  }
  if (typeof headerValue !== 'string' || headerValue === '') {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const inputHash = crypto.createHash('sha256').update(headerValue).digest('hex');
  if (!timingSafeEqualStr(inputHash, expectedHash)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}

/**
 * Validate access to feedback read/update endpoints: either a valid
 * admin password header or the FEEDBACK_TOKEN secret (query/bearer).
 * @param {{adminHeader?: unknown, token?: string}} provided
 * @param {{adminHash?: string, feedbackToken?: string}} expected
 * @returns {{ok: true} | {ok: false, status: number, error: string}}
 */
export function checkFeedbackAccess(provided, expected) {
  const { adminHeader, token } = provided || {};
  const { adminHash, feedbackToken } = expected || {};

  if (!adminHash && !feedbackToken) {
    return { ok: false, status: 503, error: 'Feedback endpoints disabled: no ADMIN_PASSWORD_HASH or FEEDBACK_TOKEN set' };
  }
  if (adminHash && checkAdminPassword(adminHeader, adminHash).ok) {
    return { ok: true };
  }
  if (feedbackToken && token && timingSafeEqualStr(token, feedbackToken)) {
    return { ok: true };
  }
  return { ok: false, status: 401, error: 'Unauthorized' };
}
