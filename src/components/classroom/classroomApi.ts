// src/components/classroom/classroomApi.ts
//
// Teacher instance layer, Phase 2 — typed client for the classroom catalog
// endpoints. Same DI pattern as saveBoardPosition: deps are injectable so
// every call is unit-testable without a network.
//
// Auth note (Phase 2): the maintainer is teacher #1, so writes send the
// admin password header. Phase 3 swaps in per-classroom write tokens —
// only this module needs to change.

import { getAdminPassword } from '../../utils/adminAuth';
import { getTeacherSession } from '../../utils/teacherAuth';
import { getBackendURL } from '../../utils/networkDetection';
import { DEFAULT_INSTANCE_ID } from '../board/saveBoardPosition';

export interface ClassroomApiDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getTeacherSession?: () => string | null;
  getBackendURL?: () => string;
}

export interface SpaceProtection {
  tier: 'structural' | 'semantic' | 'path-choice';
  reason: string;
}

export interface CatalogSpace {
  name: string;
  phase: string;
  title: string;
  used: boolean;
  protection: SpaceProtection | null;
  copyId: string | null;
  detour: string | null;
  /** Safe-subset stock values, keyed by visit type ("First"/"Subsequent"). */
  stock: Record<string, Record<string, string>>;
}

/**
 * Card ownership tier (CARD_LIBRARY_DESIGN.md "the model"). Stored
 * structurally — never the skin's display word ("school"/"teacher") — so a
 * reskin can rename tiers through the UI_STRINGS vocabulary swap without a
 * data migration. `id` is nullable: an `official` card has no owner account,
 * and a classroom with no owner bound yet produces `individual` copies with
 * `id: null`.
 */
export interface CardOwner {
  tier: 'official' | 'group' | 'individual';
  id: string | null;
}

export interface TeacherCopy {
  slot: string;
  createdAt: string;
  updatedAt: string;
  copiedFromStockVersion: string | null;
  /** Always present — new copies write it, loadInstance backfills old ones. */
  owner: CardOwner;
  /**
   * Optional free-text note on what this card is FOR (CARD_LIBRARY_DESIGN.md
   * stage 2, "Role field") — what makes a rolodex of near-identical cards
   * navigable ("Shorter version for a 45-minute period"). New cards always
   * write it (default ''); a card saved before stage 2 simply lacks the key,
   * so this is optional rather than always-string.
   */
  role?: string;
  rows: Record<string, Record<string, string>>;
}

export interface ValidationIssue {
  code: string;
  space?: string;
  copyId?: string;
  message: string;
  candidates?: string[];
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  detours: Record<string, string>;
  suggestions: Record<string, { target: string | null; candidates: string[] }>;
}

/** A card deck an authored space can deal from (Phase 4b slice 2). */
export type CardDeck = 'W' | 'B' | 'I' | 'L' | 'E';

/** An optional card draw dealt on arrival at an authored space. */
export interface CardDrawSpec {
  type: CardDeck;
  count: number;
}

/** A teacher-authored space spliced onto an A→B edge (Phase 4a/4b). */
export interface Insertion {
  id: string;
  displayName: string;
  from: string;
  to: string;
  story?: string;
  time?: string;
  fee?: string;
  /** Fee as a percentage (slice 4); wins over the flat fee. */
  feePercent?: number;
  /** What the percentage is charged on: the player's loans (default) or project scope. */
  feeBasis?: 'loans' | 'scope';
  pos_x?: string;
  pos_y?: string;
  /** Cards dealt automatically when a player lands here (slice 2). */
  cardDraw?: CardDrawSpec;
  /** Six destinations, one per die face — makes this a dice space (slice 3). */
  diceOutcomes?: string[];
  createdAt: string;
  updatedAt: string;
}

/** An edge the teacher can splice a new space onto (4a fixed/choice + 4b dice). */
export interface InsertionEdge {
  from: string;
  to: string;
  /** True when this edge is a dice outcome — players only route through the
   *  new space on the rolls that lead to `to`, not every visit (Phase 4b). */
  dice?: boolean;
}

export interface CatalogResponse {
  success: boolean;
  editableFields: string[];
  spaces: CatalogSpace[];
  copies: Record<string, TeacherCopy>;
  configVersion: number;
  stockVersion?: string;
  validation: ValidationReport | null;
  /** Existing authored spaces (Phase 4a), keyed by authored id. */
  insertions: Record<string, Insertion>;
  /** Fixed edges available to splice a new space onto (Phase 4a). */
  edges: InsertionEdge[];
}

export type MutationResult =
  | { success: true; report: ValidationReport; dryRun?: boolean; copyId?: string; insertionId?: string }
  | { success: false; report?: ValidationReport; error?: string; detail?: string };

function resolveDeps(deps: ClassroomApiDeps) {
  return {
    fetchFn: deps.fetch ?? fetch,
    getPassword: deps.getAdminPassword ?? getAdminPassword,
    getSession: deps.getTeacherSession ?? getTeacherSession,
    getURL: deps.getBackendURL ?? getBackendURL,
  };
}

export async function fetchCatalog(
  instanceId: string = DEFAULT_INSTANCE_ID,
  deps: ClassroomApiDeps = {}
): Promise<CatalogResponse> {
  const { fetchFn, getURL } = resolveDeps(deps);
  const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/catalog?_=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Catalog unavailable (HTTP ${response.status})`);
  }
  return await response.json() as CatalogResponse;
}

// Catalog writes authorize with EITHER the admin master password OR the
// teacher's session (Phase 3 — a classroom owner can edit their own room).
// Whichever is present is sent; the server checks ownership for the session.
async function mutate(path: string, method: string, body: unknown, deps: ClassroomApiDeps): Promise<MutationResult> {
  const { fetchFn, getPassword, getSession, getURL } = resolveDeps(deps);
  const password = getPassword();
  const session = getSession();
  if (!password && !session) {
    return { success: false, error: 'Not signed in. Log in as the classroom owner or admin.' };
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (password) headers['x-admin-password'] = password;
  if (session) headers['x-teacher-session'] = session;
  try {
    const response = await fetchFn(`${getURL()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return data as MutationResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Switch a space on/off. The hybrid confirm flow: call with dryRun:true to
 * get the report (pass-through suggestion + candidates, or protection
 * errors) WITHOUT saving; the confirmed call (optionally with the
 * teacher's chosen detour) saves and rebakes.
 */
export function postBoardChange(
  instanceId: string,
  args: { space: string; used: boolean; detour?: string; dryRun?: boolean },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  const body: Record<string, unknown> = {
    changes: { [args.space]: { used: args.used, ...(args.detour !== undefined ? { detour: args.detour } : {}) } },
  };
  if (args.dryRun) body.dryRun = true;
  return mutate(`/api/instances/${instanceId}/board`, 'POST', body, deps);
}

/**
 * Create a full copy of the current stock card, with optional overrides.
 *
 * `tier` (CARD_LIBRARY_DESIGN.md stage 1) is the new card's ownership tier,
 * typed against the same three structural values the server stores. Omit it
 * for today's behavior: the server defaults to `individual` — this
 * classroom's own override, which is what a teacher copy has always been.
 * `official` (the curated deck every classroom gets) is ADMIN-only and the
 * server answers 403 without touching the classroom if the caller isn't.
 */
export function createCopy(
  instanceId: string,
  args: {
    slot: string; overrides?: Record<string, Record<string, string>>;
    tier?: CardOwner['tier']; role?: string;
  },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/copies`, 'POST', args, deps);
}

/**
 * Update a copy's fields (keyed by visit type) and/or its role note. Either
 * may be omitted — passing only `role` edits the note without touching a
 * single row, and vice versa; the server requires at least one of them.
 */
export function updateCopy(
  instanceId: string,
  copyId: string,
  args: { overrides?: Record<string, Record<string, string>>; role?: string },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/copies/${copyId}`, 'PATCH', args, deps);
}

/**
 * Unselect a card (CARD_LIBRARY_DESIGN.md "removing unselects, never
 * destroys", stage 2): if the given card is the one its space is currently
 * playing, that space goes back to the original — the card itself is left
 * exactly where it was, still pickable again later. A no-op if the card
 * wasn't the one playing. The HTTP verb is DELETE (same route as before
 * this rename); nothing on the server actually deletes the card anymore.
 */
export function unselectCopy(
  instanceId: string,
  copyId: string,
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/copies/${copyId}`, 'DELETE', undefined, deps);
}

/**
 * Choose which card a space plays (CARD_LIBRARY_DESIGN.md stage 2, the
 * rolodex picker): point it at `copyId`, or pass `null` to fall back to the
 * original. Selecting among cards already visible to you is not an admin
 * act — only minting an `official` card (via `createCopy` with
 * `tier: 'official'`) is — so this authorizes the same way as every other
 * Classroom Setup write.
 */
export function selectCard(
  instanceId: string,
  args: { slot: string; copyId: string | null },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(
    `/api/instances/${instanceId}/slots/${encodeURIComponent(args.slot)}/card`,
    'POST',
    { copyId: args.copyId },
    deps
  );
}

/**
 * Author a new narrative space on the A→B edge (Phase 4a). Same hybrid
 * confirm flow as board changes: dryRun:true returns the validation report
 * (edge exists? endpoints active? fixed edge?) WITHOUT saving; the confirmed
 * call saves and rebakes. `baseConfigVersion` opts into 409 conflict
 * rejection if the classroom changed in another session (audit round 4).
 */
export function createInsertion(
  instanceId: string,
  args: {
    from: string; to: string; displayName: string;
    story?: string; time?: string; fee?: string; feePercent?: number | null; feeBasis?: 'loans' | 'scope';
    pos_x?: string; pos_y?: string; cardDraw?: CardDrawSpec | null;
    diceOutcomes?: string[] | null;
    dryRun?: boolean; baseConfigVersion?: number;
  },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/insertions`, 'POST', args, deps);
}

/** A field in an insertion patch: a scalar, a card-draw spec, dice outcomes, or null to clear. */
export type InsertionPatchValue = string | number | CardDrawSpec | string[] | null;

/** Edit an authored space's content/edge (fields → values). */
export function updateInsertion(
  instanceId: string,
  insertionId: string,
  patch: Record<string, InsertionPatchValue>,
  args: { dryRun?: boolean; baseConfigVersion?: number } = {},
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/insertions/${insertionId}`, 'PATCH', { patch, ...args }, deps);
}

/** Remove an authored space; the bake re-stitches the original A→B edge. */
export function deleteInsertion(
  instanceId: string,
  insertionId: string,
  args: { baseConfigVersion?: number } = {},
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(
    `/api/instances/${instanceId}/insertions/${insertionId}`,
    'DELETE',
    Object.keys(args).length ? args : undefined,
    deps
  );
}
