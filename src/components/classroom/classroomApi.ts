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
import { getBackendURL } from '../../utils/networkDetection';
import { DEFAULT_INSTANCE_ID } from '../board/saveBoardPosition';

export interface ClassroomApiDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
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

export interface CatalogResponse {
  success: boolean;
  editableFields: string[];
  spaces: CatalogSpace[];
  copies: Record<string, TeacherCopy>;
  configVersion: number;
  stockVersion?: string;
  validation: ValidationReport | null;
}

export type MutationResult =
  | { success: true; report: ValidationReport; dryRun?: boolean; copyId?: string }
  | { success: false; report?: ValidationReport; error?: string; detail?: string };

function resolveDeps(deps: ClassroomApiDeps) {
  return {
    fetchFn: deps.fetch ?? fetch,
    getPassword: deps.getAdminPassword ?? getAdminPassword,
    getURL: deps.getBackendURL ?? getBackendURL,
  };
}

export async function fetchCatalog(deps: ClassroomApiDeps = {}): Promise<CatalogResponse> {
  const { fetchFn, getURL } = resolveDeps(deps);
  const response = await fetchFn(`${getURL()}/api/instances/${DEFAULT_INSTANCE_ID}/catalog?_=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Catalog unavailable (HTTP ${response.status})`);
  }
  return await response.json() as CatalogResponse;
}

async function mutate(path: string, method: string, body: unknown, deps: ClassroomApiDeps): Promise<MutationResult> {
  const { fetchFn, getPassword, getURL } = resolveDeps(deps);
  const password = getPassword();
  if (!password) {
    return { success: false, error: 'Admin session expired. Re-open Admin Tools to re-authenticate.' };
  }
  try {
    const response = await fetchFn(`${getURL()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': password,
      },
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
  args: { space: string; used: boolean; detour?: string; dryRun?: boolean },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  const body: Record<string, unknown> = {
    changes: { [args.space]: { used: args.used, ...(args.detour !== undefined ? { detour: args.detour } : {}) } },
  };
  if (args.dryRun) body.dryRun = true;
  return mutate(`/api/instances/${DEFAULT_INSTANCE_ID}/board`, 'POST', body, deps);
}

/** Create a full copy of the current stock card, with optional overrides. */
export function createCopy(
  args: { slot: string; overrides?: Record<string, Record<string, string>> },
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${DEFAULT_INSTANCE_ID}/copies`, 'POST', args, deps);
}

/** Update a copy's fields (keyed by visit type). */
export function updateCopy(
  copyId: string,
  overrides: Record<string, Record<string, string>>,
  deps: ClassroomApiDeps = {}
): Promise<MutationResult> {
  return mutate(`/api/instances/${DEFAULT_INSTANCE_ID}/copies/${copyId}`, 'PATCH', { overrides }, deps);
}

/** Delete a copy; the slot reverts to the stock card. */
export function deleteCopy(copyId: string, deps: ClassroomApiDeps = {}): Promise<MutationResult> {
  return mutate(`/api/instances/${DEFAULT_INSTANCE_ID}/copies/${copyId}`, 'DELETE', undefined, deps);
}
