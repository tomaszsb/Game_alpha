// src/utils/saveEdgeAnchor.ts
//
// Persists a board connector's box-side anchor pin (2026-08-04) — which
// of a node's 4 side-middle points (top/right/bottom/left) an edge's
// source or target end is snapped to, instead of the automatic floating
// attach point. Same server-side tier and permanence model as tile
// positions and edge waypoints: a pin set once (in-game or in the Board
// Layout Editor) is visible to every teacher/device/future game.
//
// A separate field/endpoint from edge-waypoints (not reshaping that
// already-deployed shape again) but mirrors its auth/error contract
// exactly, same as saveEdgeWaypoint.ts does for saveBoardPosition.ts.

import { getAdminPassword } from './adminAuth';
import { getTeacherSession } from './teacherAuth';
import { getBackendURL } from './networkDetection';
import { DEFAULT_INSTANCE_ID } from '../components/board/saveBoardPosition';
import type { BoxAnchor } from './boardCommon';

export type EdgeEnd = 'source' | 'target';

export interface EdgeAnchorDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getTeacherSession?: () => string | null;
  getBackendURL?: () => string;
}

export type EdgeAnchorResult =
  | { success: true }
  | { success: false; step: string; detail: string };

function authHeaders(deps: EdgeAnchorDeps): { headers: Record<string, string> | null; unauth?: EdgeAnchorResult } {
  const getPassword = deps.getAdminPassword ?? getAdminPassword;
  const getSession = deps.getTeacherSession ?? getTeacherSession;
  const password = getPassword();
  const session = getSession();
  if (!password && !session) {
    return { headers: null, unauth: { success: false, step: 'auth', detail: 'Not signed in. Log in as the classroom owner or admin.' } };
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (password) headers['x-admin-password'] = password;
  if (session) headers['x-teacher-session'] = session;
  return { headers };
}

/** Fetch the classroom's current edge-anchor pins. Public read, no auth required. */
export async function fetchEdgeAnchors(
  deps: EdgeAnchorDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<Record<string, { source?: BoxAnchor; target?: BoxAnchor }>> {
  const fetchFn = deps.fetch ?? fetch;
  const getURL = deps.getBackendURL ?? getBackendURL;
  try {
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-anchors`);
    if (!response.ok) return {};
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    return (data as { edgeAnchors?: Record<string, { source?: BoxAnchor; target?: BoxAnchor }> }).edgeAnchors || {};
  } catch {
    return {};
  }
}

export async function saveEdgeAnchor(
  edgeId: string,
  end: EdgeEnd,
  anchor: BoxAnchor,
  deps: EdgeAnchorDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<EdgeAnchorResult> {
  const { headers, unauth } = authHeaders(deps);
  if (!headers) return unauth!;

  const step = 'post';
  try {
    const fetchFn = deps.fetch ?? fetch;
    const getURL = deps.getBackendURL ?? getBackendURL;
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-anchors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ edgeId, end, anchor })
    });
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (response.ok && (data as { success?: boolean }).success) {
      return { success: true };
    }
    const serverStep = (data as { step?: string }).step;
    const serverDetail = (data as { detail?: string; error?: string }).detail
      ?? (data as { error?: string }).error
      ?? `HTTP ${response.status}`;
    return { success: false, step: serverStep ?? step, detail: serverDetail };
  } catch (err) {
    return { success: false, step, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearEdgeAnchor(
  edgeId: string,
  end: EdgeEnd,
  deps: EdgeAnchorDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<EdgeAnchorResult> {
  const { headers, unauth } = authHeaders(deps);
  if (!headers) return unauth!;

  const step = 'delete';
  try {
    const fetchFn = deps.fetch ?? fetch;
    const getURL = deps.getBackendURL ?? getBackendURL;
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-anchors/${encodeURIComponent(edgeId)}/${end}`, {
      method: 'DELETE',
      headers,
    });
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (response.ok && (data as { success?: boolean }).success) {
      return { success: true };
    }
    const serverDetail = (data as { detail?: string; error?: string }).detail
      ?? (data as { error?: string }).error
      ?? `HTTP ${response.status}`;
    return { success: false, step, detail: serverDetail };
  } catch (err) {
    return { success: false, step, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearAllEdgeAnchors(
  deps: EdgeAnchorDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<EdgeAnchorResult> {
  const { headers, unauth } = authHeaders(deps);
  if (!headers) return unauth!;

  const step = 'delete';
  try {
    const fetchFn = deps.fetch ?? fetch;
    const getURL = deps.getBackendURL ?? getBackendURL;
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-anchors`, {
      method: 'DELETE',
      headers,
    });
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (response.ok && (data as { success?: boolean }).success) {
      return { success: true };
    }
    const serverDetail = (data as { detail?: string; error?: string }).detail
      ?? (data as { error?: string }).error
      ?? `HTTP ${response.status}`;
    return { success: false, step, detail: serverDetail };
  } catch (err) {
    return { success: false, step, detail: err instanceof Error ? err.message : String(err) };
  }
}
