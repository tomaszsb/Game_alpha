// src/utils/saveEdgeWaypoint.ts
//
// Persists a board connector's manual redirect point (G160) into the
// classroom's instance config — same server-side tier as tile positions
// (saveBoardPosition.ts), so a redirect drawn once (in-game or in the
// Board Layout Editor) is permanent: every teacher, every device, every
// future game sees the same fixed connector line.
//
// Mirrors saveBoardPosition.ts's auth/error contract exactly (admin
// password or teacher session; a tagged step+detail result on failure) so
// callers can reuse the same error-handling shape.

import { getAdminPassword } from './adminAuth';
import { getTeacherSession } from './teacherAuth';
import { getBackendURL } from './networkDetection';
import { DEFAULT_INSTANCE_ID } from '../components/board/saveBoardPosition';

export interface EdgeWaypointDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getTeacherSession?: () => string | null;
  getBackendURL?: () => string;
}

export type EdgeWaypointResult =
  | { success: true }
  | { success: false; step: string; detail: string };

function authHeaders(deps: EdgeWaypointDeps): { headers: Record<string, string> | null; unauth?: EdgeWaypointResult } {
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

/** Fetch the classroom's current edge-waypoint redirects. Public read, no auth required. */
export async function fetchEdgeWaypoints(
  deps: EdgeWaypointDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<Record<string, { x: number; y: number }>> {
  const fetchFn = deps.fetch ?? fetch;
  const getURL = deps.getBackendURL ?? getBackendURL;
  try {
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-waypoints`);
    if (!response.ok) return {};
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    return (data as { edgeWaypoints?: Record<string, { x: number; y: number }> }).edgeWaypoints || {};
  } catch {
    return {};
  }
}

export async function saveEdgeWaypoint(
  edgeId: string,
  x: number,
  y: number,
  deps: EdgeWaypointDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<EdgeWaypointResult> {
  const { headers, unauth } = authHeaders(deps);
  if (!headers) return unauth!;

  const step = 'post';
  try {
    const fetchFn = deps.fetch ?? fetch;
    const getURL = deps.getBackendURL ?? getBackendURL;
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-waypoints`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ edgeId, x, y })
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

export async function clearEdgeWaypoint(
  edgeId: string,
  deps: EdgeWaypointDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<EdgeWaypointResult> {
  const { headers, unauth } = authHeaders(deps);
  if (!headers) return unauth!;

  const step = 'delete';
  try {
    const fetchFn = deps.fetch ?? fetch;
    const getURL = deps.getBackendURL ?? getBackendURL;
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-waypoints/${encodeURIComponent(edgeId)}`, {
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

export async function clearAllEdgeWaypoints(
  deps: EdgeWaypointDeps = {},
  instanceId: string = DEFAULT_INSTANCE_ID
): Promise<EdgeWaypointResult> {
  const { headers, unauth } = authHeaders(deps);
  if (!headers) return unauth!;

  const step = 'delete';
  try {
    const fetchFn = deps.fetch ?? fetch;
    const getURL = deps.getBackendURL ?? getBackendURL;
    const response = await fetchFn(`${getURL()}/api/instances/${instanceId}/edge-waypoints`, {
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
