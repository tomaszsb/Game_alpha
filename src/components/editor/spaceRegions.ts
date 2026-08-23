// src/components/editor/spaceRegions.ts
//
// ONE map of "which part of the player view is made by which editing fields".
//
// Both directions read this file and nothing else:
//   • click a part of the player view  → PlayerPreviewPanel asks this map for
//     the region id, SpaceDeckScreen hands the region's FIRST anchor to
//     SpaceEditor, which scrolls that field into view and focuses it.
//   • type in a field                  → SpaceEditor reports the anchor it just
//     changed, SpaceDeckScreen asks this map which region that anchor feeds,
//     and the player view pulses that part.
//
// The point of the single map is that the two directions cannot disagree. This
// repo has been bitten more than once by one conceptual rule living in two
// places and the copies drifting (the movement-resolver split,
// `requires_dice_roll` vs Next Step, VALID_OWNER_TIERS — see docs/core/CLAUDE.md
// "Parallel-systems audit"). A part of the player view this map does not know
// about is simply not clickable; it is never special-cased on one side only.
//
// ANCHORS. An anchor names a spot in the editor:
//   field:<SpaceRow column>   — a normal editing field
//   modal:<effect_action>     — a pop-up wording box (ModalConfig.csv row)
//   section:<name>            — a whole fieldset that has no single field of
//                               its own (only the outcome table, today)
// SpaceEditor marks each of those with data-editor-anchor="<anchor>".

import { SpaceRow } from './types/EditorTypes';

export type SpaceRegionAnchor = string; // `field:${string}` | `modal:${string}` | `section:${string}`

export interface SpaceRegion {
  /** Stable id. Used as the class hook for the "that's this bit" pulse. */
  id: string;
  /**
   * What the maintainer would call this part of the player view. Sentence
   * case, plain words, and phrased so that "Edit " reads correctly in front
   * of it — that is exactly how the buttons name themselves out loud.
   */
  label: string;
  /**
   * The same part, named in as few words as still identify it — for the spots
   * in the editor too narrow for the full label (the five action columns).
   * Defaults to `label` when a region does not need one.
   */
  shortLabel?: string;
  /**
   * Every spot in the editor that feeds this part, most important first. The
   * first one is where clicking the player view lands.
   */
  anchors: SpaceRegionAnchor[];
}

export const SPACE_REGIONS: SpaceRegion[] = [
  {
    id: 'story',
    label: 'What players read here',
    anchors: ['field:Title', 'field:Event'],
  },
  {
    id: 'guidance',
    label: 'What to do and why',
    anchors: ['field:Action', 'field:Outcome'],
  },
  {
    id: 'cost',
    label: 'What this costs',
    anchors: ['field:Time', 'field:Fee'],
  },
  {
    id: 'action-W',
    label: 'The scope worktypes action',
    shortLabel: 'Scope worktypes',
    anchors: ['field:w_card', 'field:w_card_label'],
  },
  {
    id: 'action-B',
    label: 'The bank loan action',
    shortLabel: 'Bank loan',
    anchors: ['field:b_card', 'field:b_card_label'],
  },
  {
    id: 'action-I',
    label: 'The investment action',
    shortLabel: 'Investment',
    anchors: ['field:i_card', 'field:i_card_label'],
  },
  {
    id: 'action-L',
    label: 'The life event action',
    shortLabel: 'Life event',
    anchors: ['field:l_card', 'field:l_card_label'],
  },
  {
    id: 'action-E',
    label: 'The expeditor action',
    shortLabel: 'Expeditor',
    anchors: ['field:e_card', 'field:e_card_label'],
  },
  {
    id: 'outcomes',
    label: 'What the outcome decides',
    anchors: ['section:outcomes', 'field:requires_dice_roll', 'field:rolls'],
  },
  {
    id: 'destinations',
    label: 'Where they go next',
    anchors: [
      'field:space_1', 'field:space_2', 'field:space_3', 'field:space_4', 'field:space_5',
      'field:path',
    ],
  },
  {
    id: 'end-turn',
    label: 'The button that ends the turn',
    anchors: ['field:end_turn_label'],
  },
  {
    id: 'try-again',
    label: 'The button that negotiates again',
    anchors: ['field:try_again_label', 'field:Negotiate'],
  },
  // ── The pop-ups. Wording that only ever shows inside a pop-up lives here,
  //    including the per-action narratives, which are pop-up text even though
  //    they are stored as ordinary space columns.
  {
    id: 'popup-W',
    label: 'The pop-up for the scope worktypes action',
    anchors: ['modal:draw_W', 'field:w_card_narrative'],
  },
  {
    id: 'popup-B',
    label: 'The pop-up for the bank loan action',
    anchors: ['modal:draw_B', 'field:b_card_narrative'],
  },
  {
    id: 'popup-I',
    label: 'The pop-up for the investment action',
    anchors: ['modal:draw_I', 'field:i_card_narrative'],
  },
  {
    id: 'popup-L',
    label: 'The pop-up for the life event action',
    anchors: ['modal:draw_L', 'field:l_card_narrative'],
  },
  {
    id: 'popup-E',
    label: 'The pop-up for the expeditor action',
    anchors: ['modal:draw_E', 'field:e_card_narrative'],
  },
  {
    id: 'popup-time',
    label: 'The pop-up when days are added',
    anchors: ['modal:add'],
  },
  {
    id: 'popup-fee',
    label: 'The pop-up when a fee is charged',
    anchors: ['modal:deduct'],
  },
  {
    id: 'popup-outcome',
    label: 'The pop-up after an outcome',
    anchors: ['modal:dice'],
  },
  {
    id: 'popup-choice',
    label: 'The pop-up when players pick between things',
    anchors: ['modal:choice'],
  },
  {
    id: 'popup-negotiate',
    label: 'The pop-up for negotiating',
    anchors: ['modal:negotiate'],
  },
  {
    id: 'popup-end-game',
    label: 'The pop-up when the game ends',
    anchors: ['modal:end_game'],
  },
];

const BY_ID = new Map(SPACE_REGIONS.map(r => [r.id, r]));

/** The first place in the editor to send someone who clicked this part. */
export function firstAnchorOf(regionId: string): SpaceRegionAnchor | null {
  return BY_ID.get(regionId)?.anchors[0] ?? null;
}

export function regionById(regionId: string): SpaceRegion | undefined {
  return BY_ID.get(regionId);
}

/**
 * Which part of the player view an editor anchor feeds — the reverse
 * direction, off the same list. An anchor no region claims returns null and
 * nothing pulses, rather than something arbitrary lighting up.
 */
export function regionForAnchor(anchor: SpaceRegionAnchor): SpaceRegion | null {
  for (const region of SPACE_REGIONS) {
    if (region.anchors.includes(anchor)) return region;
  }
  return null;
}

/** Convenience for callers that hold a column name rather than an anchor. */
export function regionForField(field: keyof SpaceRow | string): SpaceRegion | null {
  return regionForAnchor(`field:${String(field)}`);
}

/** The space columns that feed one part, for anyone who needs the raw list. */
export function fieldsOfRegion(regionId: string): string[] {
  const region = BY_ID.get(regionId);
  if (!region) return [];
  return region.anchors
    .filter(a => a.startsWith('field:'))
    .map(a => a.slice('field:'.length));
}

/**
 * The heading the EDITOR puts on the fields that feed one part of the player
 * view. Deliberately the same words the player view calls that part out loud:
 * the two sides sat in different vocabularies until 2026-08-23 — the editor
 * named its sections after the data model ("(C) Actions", "Dice Outcome
 * Modals") while the player view named the same things plainly — and the
 * maintainer's verdict on the merged screen was that it was "hard to find
 * things on the left that match things on the right". Reading both sides off
 * this one list is what stops them drifting apart again.
 */
export function regionHeading(regionId: string): string {
  return BY_ID.get(regionId)?.label ?? '';
}

/** The same heading where the column is too narrow for the full label. */
export function regionShortLabel(regionId: string): string {
  const region = BY_ID.get(regionId);
  if (!region) return '';
  return region.shortLabel ?? region.label;
}

/** How a clickable part of the player view names itself out loud. */
export function editRegionLabel(regionId: string): string {
  const region = BY_ID.get(regionId);
  if (!region) return 'Edit this';
  return `Edit ${region.label.charAt(0).toLowerCase()}${region.label.slice(1)}`;
}

/**
 * The class the player view puts on a part while it is pulsing, and the class
 * the editor puts on the field it just sent you to. Kept here so the two
 * stylesheets agree on one name.
 */
export const REGION_PULSE_CLASS = 'space-region--just-edited';
