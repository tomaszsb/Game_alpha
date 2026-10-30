// src/components/classroom/townSettingsApi.ts
//
// A classroom's own town settings (round town, stage 1a): the `round_*` and `pulse_*` settings rows of TOWN.csv,
// such as switching the round town on for every game in the class. The stock values come from the stock town file;
// the classroom keeps only the ones a teacher changed, and an empty value resets one to stock. Same DI pattern as
// schoolBrandingApi.ts; the server checks everything again.

import { getAdminPassword } from '../../utils/adminAuth';
import { getTeacherSession } from '../../utils/teacherAuth';
import { getBackendURL } from '../../utils/networkDetection';

export interface TownSettingsDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getTeacherSession?: () => string | null;
  getBackendURL?: () => string;
  /** Where the stock town file is read from (the page's own data folder). */
  stockTownUrl?: string;
}

/** The same rules the server applies (server/instanceResolver.js). */
export const TOWN_SETTING_KEY = /^(round|pulse)_[a-z0-9_]{1,40}$/;
export const TOWN_SETTING_VALUE = /^[^,"\r\n]{0,400}$/;

export interface TownSettingRow {
  key: string;
  /** The value every classroom starts with. */
  stock: string;
  /** This classroom's own value, or null when it uses the stock one. */
  mine: string | null;
}

export type TownSettingResult = { success: true } | { success: false; error: string };

/** The editable settings in the stock town file (`setting` rows whose key the rules allow), with their values. */
export function stockTownSettings(townCsv: string): Array<{ key: string; value: string }> {
  const [head, ...lines] = townCsv.split(/\r?\n/).filter(l => l.trim() !== '');
  const cols = (head ?? '').split(',');
  const valueAt = cols.indexOf('value');
  if (valueAt < 0) return [];
  return lines.map(l => l.split(',')).filter(c => c[0] === 'setting' && TOWN_SETTING_KEY.test(c[1] ?? '')).map(c => ({ key: c[1], value: (c[valueAt] ?? '').trim() }));
}

/** Every editable town setting with its stock value and this classroom's own. Null if either cannot be read. */
export async function fetchTownSettings(instanceId: string, deps: TownSettingsDeps = {}): Promise<TownSettingRow[] | null> {
  const fetchFn = deps.fetch ?? fetch;
  const base = (deps.getBackendURL ?? getBackendURL)();
  try {
    const [stockRes, classRes] = await Promise.all([
      fetchFn(deps.stockTownUrl ?? `/data/CLEAN_FILES/TOWN.csv?_=${Date.now()}`),
      fetchFn(`${base}/api/instances/${encodeURIComponent(instanceId)}`),
    ]);
    if (!stockRes.ok || !classRes.ok) return null;
    const stock = stockTownSettings(await stockRes.text());
    const mine: Record<string, unknown> = (await classRes.json())?.townSettings ?? {};
    return stock.map(s => ({ key: s.key, stock: s.value, mine: typeof mine[s.key] === 'string' ? (mine[s.key] as string) : null }));
  } catch {
    return null;
  }
}

/** Save one setting for this classroom; an empty value goes back to the stock value. */
export async function saveTownSetting(instanceId: string, key: string, value: string, deps: TownSettingsDeps = {}): Promise<TownSettingResult> {
  if (!TOWN_SETTING_KEY.test(key)) return { success: false, error: 'That setting cannot be changed here.' };
  if (!TOWN_SETTING_VALUE.test(value)) return { success: false, error: 'A setting cannot hold commas, quotes or line breaks.' };
  const fetchFn = deps.fetch ?? fetch;
  const password = (deps.getAdminPassword ?? getAdminPassword)();
  const session = (deps.getTeacherSession ?? getTeacherSession)();
  if (!password && !session) return { success: false, error: 'Not signed in. Log in as the classroom owner or admin.' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (password) headers['x-admin-password'] = password;
  if (session) headers['x-teacher-session'] = session;
  try {
    const response = await fetchFn(`${(deps.getBackendURL ?? getBackendURL)()}/api/instances/${encodeURIComponent(instanceId)}/town-settings`, {
      method: 'PUT', headers, body: JSON.stringify({ key, value: value.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) return { success: false, error: data?.error || `Could not save the setting (HTTP ${response.status})` };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
