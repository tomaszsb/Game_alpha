// src/components/board/boardEditModeGate.ts
//
// Board edit mode is admin-only, but the two halves of that rule used to live
// in storage with different lifetimes: the "is edit mode on" flag is
// localStorage (survives forever) while the admin session is sessionStorage
// (dies with the tab). A stored "on" therefore outlived the session that was
// allowed to set it — and because BoardToggle renders nothing at all for a
// non-admin, the board came back draggable with its own off switch nowhere on
// screen. The only escape was clearing site data.
//
// This is the single place that decides the starting value, so the flag can
// never outlive the permission again. Extracted from GameLayout (same reason
// saveBoardPosition was) so it is unit-testable without mounting the layout,
// GameContext and React Flow.

export const BOARD_EDIT_MODE_KEY = 'unravel:boardEditMode';

export interface BoardEditModeGateDeps {
  isAdmin: () => boolean;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

/**
 * The value board edit mode should start at on mount. Returns false and
 * clears the stored flag whenever there is no admin session, so a forgotten
 * "on" can never come back to a browser that has since lost its login.
 */
export function readInitialBoardEditMode({ isAdmin, storage }: BoardEditModeGateDeps): boolean {
  const store = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
  if (!store) return false;
  try {
    if (!isAdmin()) {
      store.setItem(BOARD_EDIT_MODE_KEY, '0');
      return false;
    }
    return store.getItem(BOARD_EDIT_MODE_KEY) === '1';
  } catch {
    // Private-mode / disabled-storage browsers throw on access. Failing
    // closed (edit off) is the safe direction for an admin-only control.
    return false;
  }
}
