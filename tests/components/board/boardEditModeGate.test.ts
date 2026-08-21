// tests/components/board/boardEditModeGate.test.ts
//
// Regression cover for the "board draggable with no way to turn it off" bug:
// edit mode persisted in localStorage while the admin session lived in
// sessionStorage, so closing the tab dropped the login but kept edit mode on
// — and BoardToggle (which owns the off switch) renders nothing for a
// non-admin. Reproduced live before the fix: no admin session, no Edit button
// rendered, board nodes still carrying React Flow's `draggable` class.

import { describe, it, expect } from 'vitest';
import { readInitialBoardEditMode, BOARD_EDIT_MODE_KEY } from '../../../src/components/board/boardEditModeGate';

/** Minimal in-memory stand-in for localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

describe('readInitialBoardEditMode', () => {
  it('starts edit mode on when an admin left it on', () => {
    const storage = fakeStorage({ [BOARD_EDIT_MODE_KEY]: '1' });
    expect(readInitialBoardEditMode({ isAdmin: () => true, storage })).toBe(true);
  });

  it('starts edit mode off when an admin left it off', () => {
    const storage = fakeStorage({ [BOARD_EDIT_MODE_KEY]: '0' });
    expect(readInitialBoardEditMode({ isAdmin: () => false, storage })).toBe(false);
  });

  it('THE BUG: a stored "on" does not survive into a session with no admin login', () => {
    const storage = fakeStorage({ [BOARD_EDIT_MODE_KEY]: '1' });
    expect(readInitialBoardEditMode({ isAdmin: () => false, storage })).toBe(false);
  });

  it('clears the stored flag too, so it cannot come back on the next mount', () => {
    const storage = fakeStorage({ [BOARD_EDIT_MODE_KEY]: '1' });
    readInitialBoardEditMode({ isAdmin: () => false, storage });
    expect(storage.getItem(BOARD_EDIT_MODE_KEY)).toBe('0');
    // Second mount, still no admin, and now also as an admin who logs back
    // in: the forgotten "on" is gone for good rather than reappearing.
    expect(readInitialBoardEditMode({ isAdmin: () => false, storage })).toBe(false);
    expect(readInitialBoardEditMode({ isAdmin: () => true, storage })).toBe(false);
  });

  it('defaults to off when nothing is stored', () => {
    expect(readInitialBoardEditMode({ isAdmin: () => true, storage: fakeStorage() })).toBe(false);
  });

  it('fails closed when storage access throws (private mode)', () => {
    const throwing = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(readInitialBoardEditMode({ isAdmin: () => true, storage: throwing })).toBe(false);
  });
});
