// tests/server/feedbackTriageShape.test.ts
//
// GET /api/public/feedback/open is the endpoint the /start triage sweep
// reads. For months it returned whatDoing/whatWrong/version/gitCommit and
// silently dropped `extra` — the free-text box where a reporter writes the
// part that doesn't fit in one line. The in-game form captured it and the
// file on disk stored it; only this view lost it.
//
// The cost was real. fb:93449bf2 was filed as whatWrong "It is on but should
// be off" with an `extra` explaining that the television reports a
// phone-sized layout despite being a 4K panel. v3.2.43 fixed the one-liner,
// flipped the report resolved, and never saw the paragraph — which was the
// substantive half of the report. It surfaced 2026-09-01 only because the
// maintainer remembered writing it.
//
// Nothing failed when the field went missing, which is exactly why this
// needs a test rather than care: a response object quietly missing a key
// looks identical to one that never had it. Wiring fingerprint, same
// approach as serverEndpointAuth.test.ts — server.js auto-listens on import,
// so it cannot be imported into a unit test.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../../server/server.js'), 'utf8');

/** The body of the public open-feedback handler, up to its closing res.json. */
function openFeedbackHandler(): string {
  const start = source.indexOf("app.get('/api/public/feedback/open',");
  expect(start, 'GET /api/public/feedback/open not found in server.js').toBeGreaterThan(-1);
  const end = source.indexOf('res.json({ reports, count: reports.length })', start);
  expect(end, 'handler end marker not found').toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('GET /api/public/feedback/open — what triage actually gets to read', () => {
  const handler = openFeedbackHandler();

  it('surfaces `extra`, the field a report can be closed without', () => {
    expect(handler).toMatch(/extra:/);
  });

  it('reads `extra` off the stored report rather than inventing it', () => {
    expect(handler).toMatch(/data\.extra/);
  });

  it('still surfaces the fields triage already depended on', () => {
    // A regression here would be just as silent as the one above.
    for (const field of ['whatDoing', 'whatWrong', 'contact', 'version', 'gitCommit']) {
      expect(handler, `${field} missing from the triage response`).toMatch(
        new RegExp(`${field}:`),
      );
    }
  });

  it('caps `extra` rather than returning it unbounded', () => {
    // Same trade consoleSummary makes: this endpoint exists to be cheap to
    // sweep, and one pathological paste must not be able to bloat it.
    expect(handler).toMatch(/data\.extra\.slice\(0,\s*\d+\)/);
  });

  it('sends null for an empty or whitespace-only `extra`, not an empty string', () => {
    // So a reader can tell "nothing written" from "something written",
    // matching how contact/version/gitCommit already behave.
    expect(handler).toMatch(/data\.extra\.trim\(\)/);
  });
});
