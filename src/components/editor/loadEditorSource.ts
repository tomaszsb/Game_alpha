// src/components/editor/loadEditorSource.ts
//
// One place that reads the three space CSVs the editor works in, so the
// editor and the browse screen beside it can never disagree about what a
// space says.
//
// WHERE THIS READS FROM, and why it matters: `/data/SOURCE_FILES/*` is NOT
// the shipped stock. The server serves that path from the classroom's baked
// board first (server.js, `resolvedStatic`), and the bake substitutes the
// card each space is actually PLAYING for the stock row
// (instanceResolver.applyConfigToSpacesCsv), applies detours, and splices in
// spaces the teacher added. Two consequences worth knowing:
//   • what comes back is what players will see, not raw stock — which is
//     exactly what a preview needs;
//   • a switched-off space has no row here at all, because the bake drops it.
//     A caller showing one has to say so itself; there is nothing to read.

import { SpaceRow, DiceRollRow, ModalConfigRow } from './types/EditorTypes';
import { parseSpacesCSV, parseDiceRollCSV, parseModalConfigCSV } from './utils/csvExport';
import { DEFAULT_INSTANCE_ID } from '../board/saveBoardPosition';

export interface EditorSource {
  spaces: SpaceRow[];
  diceRolls: DiceRollRow[];
  modalConfigs: ModalConfigRow[];
}

/**
 * Where one classroom's baked board is served from.
 *
 * The default classroom is served at `/data` (server.js `resolvedStatic`);
 * every other classroom has its own tree at `/data/i/<id>`. A teacher editing
 * THEIR classroom must read THEIR board — reading the default one would show
 * them someone else's spaces and, worse, hand the save route a baseline from a
 * different classroom, which is what the content diff measures every edit
 * against.
 */
export function editorSourceBase(instanceId: string = DEFAULT_INSTANCE_ID): string {
  return instanceId === DEFAULT_INSTANCE_ID ? '/data' : `/data/i/${encodeURIComponent(instanceId)}`;
}

export async function loadEditorSource(instanceId: string = DEFAULT_INSTANCE_ID): Promise<EditorSource> {
  const bust = Date.now();
  const base = editorSourceBase(instanceId);
  const [spacesResponse, diceRollResponse, modalConfigResponse] = await Promise.all([
    fetch(`${base}/SOURCE_FILES/Spaces.csv?_=` + bust),
    fetch(`${base}/SOURCE_FILES/DiceRoll Info.csv?_=` + bust),
    fetch(`${base}/SOURCE_FILES/ModalConfig.csv?_=` + bust),
  ]);

  if (!spacesResponse.ok || !diceRollResponse.ok) {
    throw new Error('Failed to load source files');
  }

  const spaces = parseSpacesCSV(await spacesResponse.text());
  const diceRolls = parseDiceRollCSV(await diceRollResponse.text());
  // ModalConfig is optional — it may not exist yet.
  const modalConfigs = modalConfigResponse.ok
    ? parseModalConfigCSV(await modalConfigResponse.text())
    : [];

  return { spaces, diceRolls, modalConfigs };
}
