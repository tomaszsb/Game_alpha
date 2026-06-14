// src/components/classroom/classroomAdminApi.ts
//
// Teacher instance layer, Phase 3c — client for the classroom/account
// management endpoints (separate from classroomApi's per-card catalog calls).
//
// Two audiences:
//  - the admin (master password) creates teacher accounts + classrooms and
//    assigns owners — `x-admin-password`;
//  - a logged-in teacher lists the classrooms they own — `x-teacher-session`.
// DI deps so each call is unit-testable without a network.

import { getAdminPassword } from '../../utils/adminAuth';
import { getTeacherSession } from '../../utils/teacherAuth';
import { getBackendURL } from '../../utils/networkDetection';

export interface ClassroomMeta {
  id: string;
  displayName: string;
  owner: string | null;
  coTeachers?: string[];
  classCode?: string | null;
  visibility?: string;
  createdAt?: string;
  updatedAt?: string;
  configVersion?: number;
}

export interface TeacherAccountInfo {
  id: string;
  username: string;
  displayName: string;
}

export interface AdminApiDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getTeacherSession?: () => string | null;
  getBackendURL?: () => string;
}

function deps(d: AdminApiDeps) {
  return {
    fetchFn: d.fetch ?? fetch,
    getPassword: d.getAdminPassword ?? getAdminPassword,
    getSession: d.getTeacherSession ?? getTeacherSession,
    getURL: d.getBackendURL ?? getBackendURL,
  };
}

async function adminRequest<T>(path: string, method: string, body: unknown, d: AdminApiDeps): Promise<T> {
  const { fetchFn, getPassword, getURL } = deps(d);
  const password = getPassword();
  if (!password) throw new Error('Admin session expired. Re-open Admin Tools to re-authenticate.');
  const response = await fetchFn(`${getURL()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': password,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as { success?: boolean }).success === false) {
    throw new Error((data as { error?: string }).error || `Request failed (HTTP ${response.status})`);
  }
  return data as T;
}

// ===== teacher (session-authed) =====

/** The logged-in teacher's own classrooms. */
export async function listMyClassrooms(d: AdminApiDeps = {}): Promise<ClassroomMeta[]> {
  const { fetchFn, getSession, getURL } = deps(d);
  const session = getSession();
  if (!session) throw new Error('Not signed in.');
  const response = await fetchFn(`${getURL()}/api/instances/mine?_=${Date.now()}`, {
    headers: { 'x-teacher-session': session },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || `Request failed (HTTP ${response.status})`);
  return (data as { instances: ClassroomMeta[] }).instances || [];
}

// ===== admin (master-password-authed) =====

/** Every classroom (admin tool). */
export async function listAllClassrooms(d: AdminApiDeps = {}): Promise<ClassroomMeta[]> {
  const data = await adminRequest<{ instances: ClassroomMeta[] }>('/api/admin/instances', 'GET', undefined, d);
  return data.instances || [];
}

/** Create a classroom, optionally assigning an owner account in one step. */
export async function createClassroom(
  args: { id: string; displayName?: string; owner?: string },
  d: AdminApiDeps = {}
): Promise<ClassroomMeta> {
  const data = await adminRequest<{ instance: ClassroomMeta }>('/api/admin/instances', 'POST', args, d);
  return data.instance;
}

/** Bind / rebind / clear (owner=null) a classroom's owner account. */
export async function setClassroomOwner(
  instanceId: string,
  owner: string | null,
  d: AdminApiDeps = {}
): Promise<void> {
  await adminRequest(`/api/admin/instances/${instanceId}/owner`, 'POST', { owner }, d);
}

/** Every teacher account (for the owner picker). */
export async function listTeacherAccounts(d: AdminApiDeps = {}): Promise<TeacherAccountInfo[]> {
  const data = await adminRequest<{ accounts: TeacherAccountInfo[] }>('/api/admin/accounts', 'GET', undefined, d);
  return data.accounts || [];
}

/** Create a teacher account (admin-minted). */
export async function createTeacherAccount(
  args: { username: string; password: string; displayName?: string },
  d: AdminApiDeps = {}
): Promise<TeacherAccountInfo> {
  const data = await adminRequest<{ account: TeacherAccountInfo }>('/api/admin/accounts', 'POST', args, d);
  return data.account;
}

/** Reset a teacher's password (admin-mediated). */
export async function resetTeacherPassword(
  accountId: string,
  newPassword: string,
  d: AdminApiDeps = {}
): Promise<void> {
  await adminRequest(`/api/admin/accounts/${accountId}/reset-password`, 'POST', { newPassword }, d);
}
