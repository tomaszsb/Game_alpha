// src/utils/adminSettingsApi.ts
// Client for the admin-toggleable runtime settings endpoint (currently just
// the foreign-game text alert kill switch). Master-password-authed, same
// pattern as classroomAdminApi's adminRequest.

import { getAdminPassword } from './adminAuth';
import { getBackendURL } from './networkDetection';

export interface AdminSettings {
  foreignGameAlertsEnabled: boolean;
}

export interface AdminSettingsApiDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getBackendURL?: () => string;
}

function deps(d: AdminSettingsApiDeps) {
  return {
    fetchFn: d.fetch ?? fetch,
    getPassword: d.getAdminPassword ?? getAdminPassword,
    getURL: d.getBackendURL ?? getBackendURL,
  };
}

async function settingsRequest(path: string, method: string, body: unknown, d: AdminSettingsApiDeps): Promise<AdminSettings> {
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
  return (data as { settings: AdminSettings }).settings;
}

export async function getAdminSettings(d: AdminSettingsApiDeps = {}): Promise<AdminSettings> {
  return settingsRequest('/api/admin/settings', 'GET', undefined, d);
}

export async function setForeignGameAlertsEnabled(enabled: boolean, d: AdminSettingsApiDeps = {}): Promise<AdminSettings> {
  return settingsRequest('/api/admin/settings', 'POST', { foreignGameAlertsEnabled: enabled }, d);
}
