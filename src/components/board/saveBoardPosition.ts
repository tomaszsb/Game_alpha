// src/components/board/saveBoardPosition.ts
//
// Workstream 3 / Phase D — drag-to-save, rewired for the teacher instance
// layer (docs/core/TEACHER_LAYER_DESIGN.md, Phase 1).
//
// Tile positions are classroom config now, not Spaces.csv content: the
// drag handler posts just the coordinates to the instance endpoint, the
// server overlays them onto stock and rebakes the resolved board. No more
// fetching + mutating + re-uploading the whole CSV, and positions survive
// every deploy by construction.
//
// Kept as a pure async function (extracted from BoardCanvas) so it can be
// unit tested without mounting React Flow + the full GameContext. The
// tagged result contract (step + detail) is unchanged so the BoardCanvas
// toast rendering keeps working.

import { getAdminPassword } from '../../utils/adminAuth';
import { getBackendURL } from '../../utils/networkDetection';

/** Phase 1: a single classroom per server. Phase 3 makes this dynamic. */
export const DEFAULT_INSTANCE_ID = 'classroom-1';

export interface SaveBoardPositionDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getBackendURL?: () => string;
}

export type SaveBoardPositionResult =
  | { success: true; spaceName: string; x: number; y: number }
  | { success: false; step: string; detail: string };

/**
 * Persist a single space's new pos_x/pos_y into the classroom's instance
 * config. Positions are per-space (the server applies them to both visit
 * rows when baking).
 */
export async function saveBoardPosition(
  spaceName: string,
  x: number,
  y: number,
  deps: SaveBoardPositionDeps = {}
): Promise<SaveBoardPositionResult> {
  const fetchFn = deps.fetch ?? fetch;
  const getPassword = deps.getAdminPassword ?? getAdminPassword;
  const getURL = deps.getBackendURL ?? getBackendURL;

  const password = getPassword();
  if (!password) {
    return { success: false, step: 'auth', detail: 'Admin session expired. Re-open the editor to re-authenticate.' };
  }

  const step = 'post';
  try {
    const backendURL = getURL();
    const response = await fetchFn(`${backendURL}/api/instances/${DEFAULT_INSTANCE_ID}/positions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': password
      },
      body: JSON.stringify({ positions: { [spaceName]: { x, y } } })
    });

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (response.ok && (data as { success?: boolean }).success) {
      return { success: true, spaceName, x, y };
    }

    const serverStep = (data as { step?: string }).step;
    const serverDetail = (data as { detail?: string; error?: string }).detail
      ?? (data as { error?: string }).error
      ?? `HTTP ${response.status}`;
    return {
      success: false,
      step: serverStep ?? step,
      detail: serverDetail
    };
  } catch (err) {
    return {
      success: false,
      step,
      detail: err instanceof Error ? err.message : String(err)
    };
  }
}
