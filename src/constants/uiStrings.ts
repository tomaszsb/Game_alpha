// Centralized UI text strings
// Both source components and tests import from here.
// Change a label once → tests stay green.
//
// 2026-08-14: CSV-portability lift — vocabulary swap for a reskin (e.g. the
// D&D-skin experiment renaming "Hire Expeditors" to something fantasy-
// flavored). Every leaf string below has a matching row key in
// UI_STRINGS.csv (`DICE_BUTTON.WORK`, `DICE_FEEDBACK.got`, etc.) and is
// resolved through getUIString(), which checks a CSV override map first and
// falls back to this file's hardcoded default — same fallback contract as
// characters.ts/violationRules.ts. Conditional strings (different wording
// depending on an argument) get one CSV key per branch (`.withSummary` /
// `.empty` suffixes) since a single template can't express a branch.
//
// The exported shapes (DICE_BUTTON, DICE_FEEDBACK, NOTIF, CARD_REPLACE,
// CARD_DETAILS, DISCARD_PILE) are UNCHANGED from before this lift — plain
// string members are now getters and template-function members now call
// getUIString() internally, but every call site elsewhere in the codebase
// reads/calls them exactly as it always did.

import { interpolateTemplate } from '../utils/templateInterpolation';
import type { UIStringCsvRow } from '../types/DataTypes';

/**
 * Built-in fallback text, keyed by the same dot-path used in UI_STRINGS.csv.
 * Used verbatim when the CSV is missing, or a specific key isn't present in
 * it (a reskin CSV doesn't have to override every string — only the ones it
 * wants to change).
 *
 * Not every key that appears in the exported shapes below has a row here:
 * `NOTIF.cardPlayDetailed`'s two branches embed literal `"` characters that
 * the shared CSV parser (DataService.parseCsvLine) can't round-trip
 * correctly, so those two stay in-code-only — never CSV-overridable, but
 * still routed through getUIString() for consistency (it'll always fall
 * back to this map for those two keys since UI_STRINGS.csv never carries a
 * row for them).
 */
const DEFAULT_UI_STRINGS: Record<string, string> = {
  'DICE_BUTTON.WORK': 'Get Work Packages',
  'DICE_BUTTON.BANK': 'Apply for Bank Loans',
  'DICE_BUTTON.EXPEDITOR': 'Hire Expeditors',
  'DICE_BUTTON.INVESTMENT': 'Seek Investments',
  'DICE_BUTTON.LIFE_EVENT': 'Check for Life Events',
  'DICE_BUTTON.FEE': 'Determine Fee Amount',
  'DICE_BUTTON.FUNDING': 'Determine Funding',
  'DICE_BUTTON.TIME': 'Determine Time Impact',
  'DICE_BUTTON.QUALITY': 'Assess Quality',
  'DICE_BUTTON.EFFECTS': 'Determine Effects',
  'DICE_BUTTON.BONUS': 'Check for Bonus',
  'DICE_BUTTON.BONUS_FUNDING': 'Check for Bonus Funding',
  'DICE_BUTTON.BONUS_EFFECTS': 'Check for Bonus Effects',
  'DICE_BUTTON.NEXT_STEP': 'Determine Next Step',
  'DICE_BUTTON.OUTCOME': 'Determine Outcome',

  'DICE_FEEDBACK.prefix': 'Outcome:',
  'DICE_FEEDBACK.got': 'Got {count} {typeName}{plural}',
  'DICE_FEEDBACK.gained': 'Gained ${amount}',
  'DICE_FEEDBACK.spent': 'Spent ${amount}',
  'DICE_FEEDBACK.timePenalty': 'Time Penalty: {days} {unit}',
  'DICE_FEEDBACK.timeSaved': 'Time Saved: {days} {unit}',
  'DICE_FEEDBACK.timeBonus': 'Time Bonus: {days} {unit}',
  'DICE_FEEDBACK.movedTo': 'Moved to {dest}',
  'DICE_FEEDBACK.ON_CURRENT_SPACE': 'on current space',
  'DICE_FEEDBACK.ACTION_COMPLETED': 'Action completed',

  'NOTIF.diceRollMedium.withSummary': '→ {summary}',
  'NOTIF.diceRollMedium.empty': 'No change this time',
  'NOTIF.diceRollDetailed.withSummary': '{player}: {summary}',
  'NOTIF.diceRollDetailed.empty': '{player}: no change this time',
  'NOTIF.NO_EFFECTS': 'No change',
  'NOTIF.cardPlayShort': '✓',
  'NOTIF.cardPlayMedium.withSummary': '⚡ Activated {name} → {summary}',
  'NOTIF.cardPlayMedium.empty': '⚡ Activated {name}',
  // Not CSV-overridable — see the doc comment above.
  'NOTIF.cardPlayDetailed.withSummary': '{player} activated "{name}" with effects: {summary}',
  'NOTIF.cardPlayDetailed.empty': '{player} activated "{name}"',

  'CARD_REPLACE.title': '{mode} {typeName}',
  'CARD_REPLACE.instruction': 'Select up to {max} to replace',
  'CARD_REPLACE.instructionReturn.plural': 'Select up to {max} to return',
  'CARD_REPLACE.instructionReturn.singular': 'Select one to return',
  'CARD_REPLACE.confirm.withCount': '{mode} {count}',
  'CARD_REPLACE.confirm.zero': '{mode}',
  'CARD_REPLACE.empty': 'No {typeName} available to {action}',
  'CARD_REPLACE.counter': '{selected} of {max} selected',
  'CARD_REPLACE.RETURN_BUTTON': 'Return to Main Panel',

  'CARD_DETAILS.TRANSFER_TOGGLE': '↔ Transfer',
  'CARD_DETAILS.TRANSFER_CONFIRM': 'Transfer',
  'CARD_DETAILS.TRANSFER_HEADING': 'Select player to transfer to:',

  'DISCARD_PILE.EMPTY_STATE': 'No resources used yet',
  'DISCARD_PILE.FILTER_LABEL': 'Filter by type',

  // --- RulesModal ---
  // 2026-08-14: reskin follow-up to the button/notification lift above.
  // RulesModal.tsx's "Key Spaces" section has a second, distinct problem on
  // top of plain wording: it names literal space ids (OWNER-SCOPE-INITIATION
  // etc.) in prose — a documentation-drift bug even for a same-language
  // reskin that just renames spaces, not just a translation gap. Rather than
  // building a live DataService lookup (this is a curated 5-item highlight
  // reel, not a generated list of every space — a lookup would still need a
  // hardcoded "which spaces count as highlights" list, no simpler than this),
  // the fix is the same as everywhere else: let a reskin CSV override the
  // label text directly, including the space names, same getUIString()
  // mechanism as the button/notification strings above.
  'RULES.title': 'Rules',
  'RULES.footer.gotIt': 'Got it!',
  'RULES.objective.heading': 'Game Objective',
  'RULES.objective.body': 'Navigate through the development process from initial scope to project completion. Manage your time, money, and resources while making strategic decisions to successfully complete your construction project.',
  'RULES.turnStructure.heading': 'Turn Structure',
  'RULES.turnStructure.step1.label': 'Determine Outcome:',
  'RULES.turnStructure.step1.body': 'Each space has different possible outcomes that affect your project',
  'RULES.turnStructure.step2.label': 'Complete Actions:',
  'RULES.turnStructure.step2.body': 'Perform any required actions (like hiring expeditors or securing funding)',
  'RULES.turnStructure.step3.label': 'End Turn:',
  'RULES.turnStructure.step3.body': 'Once all actions are completed, end your turn to advance',
  'RULES.resourceTypes.heading': 'Resource Types',
  'RULES.resourceTypes.W.label': 'Work Packages:',
  'RULES.resourceTypes.W.body': 'Construction work scopes and project requirements',
  'RULES.resourceTypes.B.label': 'Bank Loans:',
  'RULES.resourceTypes.B.body': 'Funding and financial resources',
  'RULES.resourceTypes.E.label': 'Expeditors:',
  'RULES.resourceTypes.E.body': 'Filing representatives who can help or hinder application processes',
  'RULES.resourceTypes.L.label': 'Life Events:',
  'RULES.resourceTypes.L.body': 'Real-world surprises like new laws, weather delays, and unforeseen circumstances',
  'RULES.resourceTypes.I.label': 'Investors:',
  'RULES.resourceTypes.I.body': 'Investment opportunities and funding partners',
  'RULES.keySpaces.heading': 'Key Spaces',
  'RULES.keySpaces.item1.label': 'OWNER-SCOPE-INITIATION:',
  'RULES.keySpaces.item1.body': 'Define project scope and hire expeditors',
  'RULES.keySpaces.item2.label': 'OWNER-FUND-INITIATION:',
  'RULES.keySpaces.item2.body': 'Secure initial funding',
  'RULES.keySpaces.item3.label': 'ARCH/ENG Spaces:',
  'RULES.keySpaces.item3.body': 'Work with architects and engineers',
  'RULES.keySpaces.item4.label': 'REG Spaces:',
  'RULES.keySpaces.item4.body': 'Handle permits and regulatory requirements',
  'RULES.keySpaces.item5.label': 'CON Spaces:',
  'RULES.keySpaces.item5.body': 'Construction and final project phases',
  'RULES.negotiation.heading': 'Negotiation',
  'RULES.negotiation.body': 'Some spaces allow negotiation. If you have a snapshot from entering the space, you can restore your previous state. Otherwise, you’ll receive a time penalty but can try again.',
  'RULES.winning.heading': 'Winning',
  'RULES.winning.body': 'Successfully navigate through all phases of development and reach the final completion space to win the game. Manage your resources wisely and make strategic decisions to overcome challenges along the way.',
};

const UI_STRING_OVERRIDES = new Map<string, string>();

/**
 * Resolve a UI_STRINGS.csv key to its display text, checking the CSV
 * override map first and falling back to DEFAULT_UI_STRINGS. Interpolates
 * `{token}` placeholders from `vars` either way (templateInterpolation.ts's
 * `interpolateTemplate` — same syntax ModalConfig.csv text already uses).
 * An unknown key (not in DEFAULT_UI_STRINGS either) returns the bare key so
 * a typo is visibly wrong rather than silently blank.
 *
 * Exported (unlike the object exports below, which wrap it for their own
 * key sets) for consumers with free-form prose rather than a fixed group of
 * labeled strings — RulesModal.tsx calls this directly per text node rather
 * than through a single-use named export for each one.
 */
export function getUIString(key: string, vars: Record<string, string | number | undefined> = {}): string {
  const template = UI_STRING_OVERRIDES.get(key) ?? DEFAULT_UI_STRINGS[key] ?? key;
  return interpolateTemplate(template, vars);
}

/**
 * Call once at app startup (after DataService.loadData() resolves) with
 * every row parsed from UI_STRINGS.csv, to let a reskin swap button/
 * notification vocabulary without a code edit. A row whose `key` isn't one
 * of DEFAULT_UI_STRINGS's known keys is skipped (logged) — doesn't error
 * the whole file, since a reskin CSV might carry extra rows for future keys
 * or a typo'd key that shouldn't silently do nothing forever unnoticed.
 * Missing/empty `rows` (no CSV, or every row skipped) is a no-op — every
 * key already has a valid built-in default from module load.
 */
export function configureUIStrings(rows: UIStringCsvRow[]): void {
  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    const key = (row.key || '').trim();
    const template = row.template ?? '';
    if (!key || !template) continue;
    if (!(key in DEFAULT_UI_STRINGS)) {
      console.error(`uiStrings.ts: skipping UI_STRINGS.csv row with unrecognized key "${key}" (not one of DEFAULT_UI_STRINGS's known keys).`);
      continue;
    }
    UI_STRING_OVERRIDES.set(key, template);
  }
}

/**
 * Test-only: clears every CSV override so a test that calls
 * configureUIStrings() doesn't leak state into the next test in the same
 * file (UI_STRING_OVERRIDES is module-level state, shared across every test
 * that imports this module normally — see endGameInsights.ts's `_testOnly`
 * for the same pattern). Not used by app code.
 */
export const _testOnly = { resetUIStringOverrides: () => UI_STRING_OVERRIDES.clear() };

// --- Dice roll button labels (formatDiceRollButton) ---
export const DICE_BUTTON = {
  get WORK() { return getUIString('DICE_BUTTON.WORK'); },
  get BANK() { return getUIString('DICE_BUTTON.BANK'); },
  get EXPEDITOR() { return getUIString('DICE_BUTTON.EXPEDITOR'); },
  get INVESTMENT() { return getUIString('DICE_BUTTON.INVESTMENT'); },
  get LIFE_EVENT() { return getUIString('DICE_BUTTON.LIFE_EVENT'); },
  get FEE() { return getUIString('DICE_BUTTON.FEE'); },
  get FUNDING() { return getUIString('DICE_BUTTON.FUNDING'); },
  get TIME() { return getUIString('DICE_BUTTON.TIME'); },
  get QUALITY() { return getUIString('DICE_BUTTON.QUALITY'); },
  get EFFECTS() { return getUIString('DICE_BUTTON.EFFECTS'); },
  get BONUS() { return getUIString('DICE_BUTTON.BONUS'); },
  get BONUS_FUNDING() { return getUIString('DICE_BUTTON.BONUS_FUNDING'); },
  get BONUS_EFFECTS() { return getUIString('DICE_BUTTON.BONUS_EFFECTS'); },
  get NEXT_STEP() { return getUIString('DICE_BUTTON.NEXT_STEP'); },
  get OUTCOME() { return getUIString('DICE_BUTTON.OUTCOME'); },
};

// --- Outcome feedback (formatDiceRollFeedback) ---
// Voice rule (no game language): never surface the raw die number — lead with a
// neutral word and let the outcomes carry the message.
export const DICE_FEEDBACK = {
  prefix: (_value: number) => getUIString('DICE_FEEDBACK.prefix'),
  got: (count: number, typeName: string, plural: string) => getUIString('DICE_FEEDBACK.got', { count, typeName, plural }),
  gained: (amount: number) => getUIString('DICE_FEEDBACK.gained', { amount }),
  spent: (amount: number) => getUIString('DICE_FEEDBACK.spent', { amount }),
  timePenalty: (days: number, unit: string) => getUIString('DICE_FEEDBACK.timePenalty', { days, unit }),
  timeSaved: (days: number, unit: string) => getUIString('DICE_FEEDBACK.timeSaved', { days, unit }),
  timeBonus: (days: number, unit: string) => getUIString('DICE_FEEDBACK.timeBonus', { days, unit }),
  movedTo: (dest: string) => getUIString('DICE_FEEDBACK.movedTo', { dest }),
  get ON_CURRENT_SPACE() { return getUIString('DICE_FEEDBACK.ON_CURRENT_SPACE'); },
  get ACTION_COMPLETED() { return getUIString('DICE_FEEDBACK.ACTION_COMPLETED'); },
};

// --- Notification format strings ---
export const NOTIF = {
  // createDiceRollNotification. Voice rule (no game language): no 🎲, no die
  // number — describe the outcome only.
  diceRollMedium: (summary: string) =>
    summary ? getUIString('NOTIF.diceRollMedium.withSummary', { summary }) : getUIString('NOTIF.diceRollMedium.empty'),
  diceRollDetailed: (player: string, summary: string) =>
    summary ? getUIString('NOTIF.diceRollDetailed.withSummary', { player, summary }) : getUIString('NOTIF.diceRollDetailed.empty', { player }),
  get NO_EFFECTS() { return getUIString('NOTIF.NO_EFFECTS'); },

  // createCardPlayNotification
  get cardPlayShort() { return getUIString('NOTIF.cardPlayShort'); },
  // Voice rule: no board-game iconography (the 🃏 playing-card joker leaked
  // game-deck framing). ⚡ reads as "activation" without implying a deck.
  cardPlayMedium: (name: string, summary: string) =>
    summary ? getUIString('NOTIF.cardPlayMedium.withSummary', { name, summary }) : getUIString('NOTIF.cardPlayMedium.empty', { name }),
  cardPlayDetailed: (player: string, name: string, summary: string) =>
    summary ? getUIString('NOTIF.cardPlayDetailed.withSummary', { player, name, summary }) : getUIString('NOTIF.cardPlayDetailed.empty', { player, name }),
};

// --- CardReplacementModal ---
export const CARD_REPLACE = {
  title: (mode: string, typeName: string) => getUIString('CARD_REPLACE.title', { mode, typeName }),
  instruction: (max: number) => getUIString('CARD_REPLACE.instruction', { max }),
  instructionReturn: (max: number) =>
    max > 1 ? getUIString('CARD_REPLACE.instructionReturn.plural', { max }) : getUIString('CARD_REPLACE.instructionReturn.singular'),
  confirm: (mode: string, count: number) =>
    count > 0 ? getUIString('CARD_REPLACE.confirm.withCount', { mode, count }) : getUIString('CARD_REPLACE.confirm.zero', { mode }),
  empty: (typeName: string, action: string) => getUIString('CARD_REPLACE.empty', { typeName, action }),
  counter: (selected: number, max: number) => getUIString('CARD_REPLACE.counter', { selected, max }),
  get RETURN_BUTTON() { return getUIString('CARD_REPLACE.RETURN_BUTTON'); },
};

// --- CardDetailsModal ---
export const CARD_DETAILS = {
  get TRANSFER_TOGGLE() { return getUIString('CARD_DETAILS.TRANSFER_TOGGLE'); },
  get TRANSFER_CONFIRM() { return getUIString('CARD_DETAILS.TRANSFER_CONFIRM'); },
  get TRANSFER_HEADING() { return getUIString('CARD_DETAILS.TRANSFER_HEADING'); },
};

// --- DiscardPileModal ---
export const DISCARD_PILE = {
  get EMPTY_STATE() { return getUIString('DISCARD_PILE.EMPTY_STATE'); },
  get FILTER_LABEL() { return getUIString('DISCARD_PILE.FILTER_LABEL'); },
};
