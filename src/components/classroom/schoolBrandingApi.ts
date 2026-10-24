// src/components/classroom/schoolBrandingApi.ts
//
// School name + logo for one classroom (TEACHER_LAYER_DESIGN.md "Safe logo upload").
// Same DI pattern as classroomApi.ts: every dependency is injectable so each call is testable
// without a network. The server does the real checking (file content, size, type); the checks
// here only save a teacher a wasted trip.

import { getAdminPassword } from '../../utils/adminAuth';
import { getTeacherSession } from '../../utils/teacherAuth';
import { getBackendURL } from '../../utils/networkDetection';

export interface SchoolBrandingDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getTeacherSession?: () => string | null;
  getBackendURL?: () => string;
}

export type BrandingResult = { success: true } | { success: false; error: string };

export interface SchoolBranding {
  schoolName: string | null;
  /** Changes whenever the logo changes (used to bust the browser's copy); null = no logo. */
  logoVersion: number | null;
}

/** Same limit the server enforces. */
export const MAX_LOGO_BYTES = 1024 * 1024;

function resolve(deps: SchoolBrandingDeps) {
  return {
    fetchFn: deps.fetch ?? fetch,
    password: (deps.getAdminPassword ?? getAdminPassword)(),
    session: (deps.getTeacherSession ?? getTeacherSession)(),
    base: (deps.getBackendURL ?? getBackendURL)(),
  };
}

/** The full web address of a classroom's logo (usable from a page on another address, like the certificate). */
export function logoUrl(instanceId: string, logoVersion?: number | null, base: string = getBackendURL()): string {
  const v = logoVersion ? `?v=${logoVersion}` : '';
  return `${base}/api/instances/${instanceId}/logo${v}`;
}

/** Public: anyone may read the school name and whether there is a logo. Null if the classroom cannot be read. */
export async function fetchSchoolBranding(instanceId: string, deps: SchoolBrandingDeps = {}): Promise<SchoolBranding | null> {
  const { fetchFn, base } = resolve(deps);
  try {
    const response = await fetchFn(`${base}/api/instances/${encodeURIComponent(instanceId)}`);
    if (!response.ok) return null;
    const data = await response.json();
    const name = data?.meta?.schoolName;
    return {
      schoolName: typeof name === 'string' && name.trim() ? name.trim() : null,
      logoVersion: typeof data?.logoVersion === 'number' ? data.logoVersion : null,
    };
  } catch {
    return null;
  }
}

async function write(path: string, method: 'PUT' | 'DELETE', body: unknown, deps: SchoolBrandingDeps, fallback: string): Promise<BrandingResult> {
  const { fetchFn, password, session, base } = resolve(deps);
  if (!password && !session) return { success: false, error: 'Not signed in. Log in as the classroom owner or admin.' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (password) headers['x-admin-password'] = password;
  if (session) headers['x-teacher-session'] = session;
  try {
    const response = await fetchFn(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) return { success: false, error: data?.error || `${fallback} (HTTP ${response.status})` };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Read a chosen file as plain base64 (no "data:" prefix). */
export function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolveRead, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const text = String(reader.result ?? '');
      resolveRead(text.slice(text.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** Upload (or replace) the logo. Refuses early on the obvious problems; the server decides the rest. */
export async function uploadLogo(instanceId: string, file: File, deps: SchoolBrandingDeps = {}): Promise<BrandingResult> {
  if (file.size > MAX_LOGO_BYTES) return { success: false, error: 'Use a PNG or JPEG under 1 MB.' };
  if (file.type && file.type !== 'image/png' && file.type !== 'image/jpeg') {
    return { success: false, error: 'Use a PNG or JPEG picture.' };
  }
  let image: string;
  try {
    image = await readFileAsBase64(file);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'That file could not be read.' };
  }
  return write(`/api/instances/${instanceId}/logo`, 'PUT', { image }, deps, 'Could not save the logo');
}

export function removeLogo(instanceId: string, deps: SchoolBrandingDeps = {}): Promise<BrandingResult> {
  return write(`/api/instances/${instanceId}/logo`, 'DELETE', undefined, deps, 'Could not remove the logo');
}

/** Save the school name; an empty name clears it. */
export function saveSchoolName(instanceId: string, schoolName: string, deps: SchoolBrandingDeps = {}): Promise<BrandingResult> {
  return write(`/api/instances/${instanceId}/school-name`, 'PUT', { schoolName }, deps, 'Could not save the school name');
}
