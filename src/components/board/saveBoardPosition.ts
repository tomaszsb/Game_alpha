// src/components/board/saveBoardPosition.ts
//
// Workstream 3 / Phase D — drag-to-save.
//
// When an admin drags a space tile on the BoardCanvas, the new pos_x/pos_y
// needs to round-trip through the editor's save endpoint so the change
// persists across reloads (and so the smart-edge router can recompute on
// the next render).
//
// Same wire shape as DataEditor's save flow: fetch the SOURCE_FILES CSVs,
// mutate the rows in memory, export, POST to /api/admin/save-source-files.
// Reuses the v2.65.7 header-aware parser/exporter, so any column the editor
// UI doesn't expose still round-trips opaquely via SpaceRow._extraColumns.
//
// pos_x/pos_y live in _extraColumns rather than promoted to a named
// SpaceRow field — they're already round-trip-safe and promoting them
// would reorder columns in the on-disk CSV. The drag handler writes
// both as strings (matching the rest of the CSV plumbing).
//
// Extracted from BoardCanvas as a pure async function so it can be unit
// tested without mounting React Flow + the full GameContext.

import { parseSpacesCSV, exportSpacesCSV } from '../editor/utils/csvExport';
import { getAdminPassword } from '../../utils/adminAuth';
import { getBackendURL } from '../../utils/networkDetection';

export interface SaveBoardPositionDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getBackendURL?: () => string;
}

export type SaveBoardPositionResult =
  | { success: true; spaceName: string; x: number; y: number }
  | { success: false; step: string; detail: string };

/**
 * Persist a single space's new pos_x/pos_y to Spaces.csv via the editor's
 * existing save endpoint. Both visit_type rows (First + Subsequent) for the
 * space get the same coordinates — positions are per-space, not per-visit.
 *
 * Returns a tagged result so callers can render a success/error toast. On
 * failure, `step` + `detail` match the v2.65.7 per-step diagnostic contract
 * surfaced by /api/admin/save-source-files.
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

  let step = 'fetch_spaces';
  try {
    const spacesResponse = await fetchFn('/data/SOURCE_FILES/Spaces.csv?_=' + Date.now());
    if (!spacesResponse.ok) {
      return { success: false, step, detail: `HTTP ${spacesResponse.status} loading Spaces.csv` };
    }
    const spacesText = await spacesResponse.text();

    step = 'fetch_dice';
    const diceResponse = await fetchFn('/data/SOURCE_FILES/DiceRoll Info.csv?_=' + Date.now());
    if (!diceResponse.ok) {
      return { success: false, step, detail: `HTTP ${diceResponse.status} loading DiceRoll Info.csv` };
    }
    const diceRollCSV = await diceResponse.text();

    step = 'parse';
    const rows = parseSpacesCSV(spacesText);
    const matching = rows.filter(r => r.space_name === spaceName);
    if (matching.length === 0) {
      return { success: false, step, detail: `Space "${spaceName}" not found in Spaces.csv` };
    }
    for (const row of matching) {
      const extras = row._extraColumns ?? {};
      row._extraColumns = { ...extras, pos_x: String(x), pos_y: String(y) };
    }

    step = 'export';
    const spacesCSV = exportSpacesCSV(rows);

    step = 'post';
    const backendURL = getURL();
    const response = await fetchFn(`${backendURL}/api/admin/save-source-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, spacesCSV, diceRollCSV })
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
