// tests/utils/dataInstance.test.ts
// Phase 3c — which classroom's board the client loads, derived from the URL.
// instanceDataBasePath takes the query string directly so it's testable
// without mocking window.location.

import { describe, it, expect } from 'vitest';
import { instanceDataBasePath, instanceIdFromSearch } from '../../src/utils/dataInstance';

describe('instanceDataBasePath', () => {
  it('defaults to /data when no classroom is in the URL', () => {
    expect(instanceDataBasePath('')).toBe('/data');
    expect(instanceDataBasePath('?g=G123&token=abc')).toBe('/data');
  });

  it('routes to the per-instance path for a non-default classroom', () => {
    expect(instanceDataBasePath('?g=G1&i=classroom-7')).toBe('/data/i/classroom-7');
    expect(instanceDataBasePath('?i=room-2&token=x')).toBe('/data/i/room-2');
  });

  it('treats the default classroom as plain /data (no redundant prefix)', () => {
    expect(instanceDataBasePath('?i=classroom-1')).toBe('/data');
  });

  it('ignores a malformed/unsafe id (no path traversal)', () => {
    expect(instanceDataBasePath('?i=../secret')).toBe('/data');
    expect(instanceDataBasePath('?i=a/b')).toBe('/data');
    expect(instanceDataBasePath('?i=')).toBe('/data');
    expect(instanceDataBasePath('?i=Bad_Caps')).toBe('/data'); // uppercase/underscore not allowed
  });
});

describe('instanceIdFromSearch (classroom badge)', () => {
  it('returns the non-default classroom id', () => {
    expect(instanceIdFromSearch('?g=G1&i=classroom-7')).toBe('classroom-7');
    expect(instanceIdFromSearch('?i=room-2')).toBe('room-2');
  });

  it('returns null for the default board, a missing id, or an unsafe id', () => {
    expect(instanceIdFromSearch('')).toBeNull();
    expect(instanceIdFromSearch('?i=classroom-1')).toBeNull();
    expect(instanceIdFromSearch('?i=../secret')).toBeNull();
    expect(instanceIdFromSearch('?i=Bad_Caps')).toBeNull();
  });
});
