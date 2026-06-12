// tests/server/authGuards.test.ts
// Unit tests for the endpoint auth guards (DEF-5 fail-open fix, DEF-6
// feedback PII gate). These are the pure helpers server.js wires into
// /api/debug/* and /api/feedback/* — see serverEndpointAuth.test.ts for
// the wiring fingerprint.

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { timingSafeEqualStr, checkAdminPassword, checkFeedbackAccess } from '../../server/authGuards.js';

const PASSWORD = 'correct horse battery staple';
const HASH = crypto.createHash('sha256').update(PASSWORD).digest('hex');

describe('timingSafeEqualStr', () => {
  it('matches equal strings', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true);
  });

  it('rejects different strings and different lengths', () => {
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false);
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
  });

  it('treats null/undefined as empty without throwing', () => {
    expect(timingSafeEqualStr(null, '')).toBe(true);
    expect(timingSafeEqualStr(undefined, 'x')).toBe(false);
  });
});

describe('checkAdminPassword', () => {
  it('accepts the correct password', () => {
    expect(checkAdminPassword(PASSWORD, HASH)).toEqual({ ok: true });
  });

  it('rejects a wrong password with 401', () => {
    expect(checkAdminPassword('wrong', HASH)).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a missing header with 401', () => {
    expect(checkAdminPassword(undefined, HASH)).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a non-string header (e.g. repeated header array) with 401', () => {
    expect(checkAdminPassword(['a', 'b'], HASH)).toMatchObject({ ok: false, status: 401 });
  });

  it('FAILS CLOSED with 503 when no hash is configured (DEF-5)', () => {
    // The old debug-endpoint check compared '' !== '' and let everyone in
    // when ADMIN_PASSWORD_HASH was unset. Empty header + empty hash must
    // now be rejected.
    expect(checkAdminPassword('', '')).toMatchObject({ ok: false, status: 503 });
    expect(checkAdminPassword(undefined, '')).toMatchObject({ ok: false });
    expect(checkAdminPassword('anything', undefined)).toMatchObject({ ok: false });
  });
});

describe('checkFeedbackAccess (DEF-6)', () => {
  const expected = { adminHash: HASH, feedbackToken: 'secret-token' };

  it('accepts a valid admin password', () => {
    expect(checkFeedbackAccess({ adminHeader: PASSWORD }, expected)).toEqual({ ok: true });
  });

  it('accepts the feedback token', () => {
    expect(checkFeedbackAccess({ token: 'secret-token' }, expected)).toEqual({ ok: true });
  });

  it('rejects with 401 when neither credential is valid', () => {
    expect(checkFeedbackAccess({ adminHeader: 'wrong', token: 'wrong' }, expected)).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects with 401 when nothing is provided', () => {
    expect(checkFeedbackAccess({}, expected)).toMatchObject({ ok: false, status: 401 });
  });

  it('FAILS CLOSED with 503 when neither secret is configured', () => {
    expect(
      checkFeedbackAccess({ adminHeader: '', token: '' }, { adminHash: '', feedbackToken: undefined })
    ).toMatchObject({ ok: false, status: 503 });
  });

  it('still works when only one secret is configured', () => {
    expect(checkFeedbackAccess({ token: 'secret-token' }, { adminHash: '', feedbackToken: 'secret-token' })).toEqual({ ok: true });
    expect(checkFeedbackAccess({ adminHeader: PASSWORD }, { adminHash: HASH, feedbackToken: undefined })).toEqual({ ok: true });
    // ...and an empty admin header against token-only config is rejected, not crashed
    expect(checkFeedbackAccess({ adminHeader: '' }, { adminHash: '', feedbackToken: 'secret-token' }).ok).toBe(false);
  });
});
