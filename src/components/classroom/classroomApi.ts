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

export interface TeacherCopy {
  slot: string;
  createdAt: string;
  updatedAt: string;
  copiedFromStockVersion: string | null;
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

/** A teacher-authored space spliced onto an A→B edge (Phase 4a). */
export interface Insertion {
  id: string;
  displayName: string;
  from: string;
  to: string;
  story?: string;
  time?: string;
  fee?: string;
  pos_x?: string;
  pos_y?: string;
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

/** Create a full copy of the current stock card, with optional overrides. */
export function createCopy(
  instanceId: string,
  args: { slot: string; overrides?: Record<string, Record<string, string>> },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/copies`, 'POST', args, deps);
}

/** Update a copy's fields (keyed by visit type). */
export function updateCopy(
  instanceId: string,
  copyId: string,
  overrides: Record<string, Record<string, string>>,
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/copies/${copyId}`, 'PATCH', { overrides }, deps);
}

/** Delete a copy; the slot reverts to the stock card. */
export function deleteCopy(
  instanceId: string,
  copyId: string,
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/copies/${copyId}`, 'DELETE', undefined, deps);
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
    story?: string; time?: string; fee?: string;
    pos_x?: string; pos_y?: string; dryRun?: boolean; baseConfigVersion?: number;
  },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${instanceId}/insertions`, 'POST', args, deps);
}

/** Edit an authored space's content/edge (fields → values). */
export function updateInsertion(
  instanceId: string,
  insertionId: string,
  patch: Record<string, string>,
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
