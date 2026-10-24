import { describe, it, expect, vi } from 'vitest';
import {
  fetchSchoolBranding, uploadLogo, removeLogo, saveSchoolName, logoUrl, MAX_LOGO_BYTES,
} from '../../src/components/classroom/schoolBrandingApi';

const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const deps = (fetchFn: any, over: Record<string, unknown> = {}) => ({
  fetch: fetchFn, getAdminPassword: () => null, getTeacherSession: () => 'sess-1', getBackendURL: () => 'https://game.test', ...over,
});
const png = (bytes = 100, type = 'image/png') => new File([new Uint8Array(bytes)], 'logo.png', { type });

describe('schoolBrandingApi', () => {
  it('builds a full logo address, with the version so a new logo is not hidden by the browser copy', () => {
    expect(logoUrl('room-1', 77, 'https://game.test')).toBe('https://game.test/api/instances/room-1/logo?v=77');
    expect(logoUrl('room-1', null, 'https://game.test')).toBe('https://game.test/api/instances/room-1/logo');
  });

  it('reads the public school name and logo version', async () => {
    const f = vi.fn().mockResolvedValue(ok({ meta: { schoolName: '  Farmingdale  ' }, logoVersion: 5 }));
    expect(await fetchSchoolBranding('room-1', deps(f))).toEqual({ schoolName: 'Farmingdale', logoVersion: 5 });
    expect(f.mock.calls[0][0]).toBe('https://game.test/api/instances/room-1');
  });

  it('says null (not a crash) when the classroom cannot be read', async () => {
    expect(await fetchSchoolBranding('x', deps(vi.fn().mockResolvedValue(ok({}, 404))))).toBeNull();
    expect(await fetchSchoolBranding('x', deps(vi.fn().mockRejectedValue(new Error('down'))))).toBeNull();
  });

  it('uploads a picture as base64 JSON with the teacher session', async () => {
    const f = vi.fn().mockResolvedValue(ok({ success: true, logoVersion: 9 }));
    expect(await uploadLogo('room-1', png(), deps(f))).toEqual({ success: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://game.test/api/instances/room-1/logo');
    expect(init.method).toBe('PUT');
    expect(init.headers['x-teacher-session']).toBe('sess-1');
    expect(typeof JSON.parse(init.body).image).toBe('string');
  });

  it('sends the admin password when that is what is signed in', async () => {
    const f = vi.fn().mockResolvedValue(ok({ success: true }));
    await uploadLogo('room-1', png(), deps(f, { getTeacherSession: () => null, getAdminPassword: () => 'pw' }));
    expect(f.mock.calls[0][1].headers['x-admin-password']).toBe('pw');
  });

  it('refuses a file that is too big, or not a PNG/JPEG, without calling the server', async () => {
    const f = vi.fn();
    const big = await uploadLogo('room-1', png(MAX_LOGO_BYTES + 1), deps(f));
    expect(big).toEqual({ success: false, error: 'Use a PNG or JPEG under 1 MB.' });
    const svg = await uploadLogo('room-1', png(10, 'image/svg+xml'), deps(f));
    expect(svg.success).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("passes the server's plain-words refusal back", async () => {
    const f = vi.fn().mockResolvedValue(ok({ success: false, error: 'The picture must be at least 64 x 64 pixels' }, 400));
    expect(await uploadLogo('room-1', png(), deps(f))).toEqual({ success: false, error: 'The picture must be at least 64 x 64 pixels' });
  });

  it('will not write when nobody is signed in', async () => {
    const f = vi.fn();
    const r = await removeLogo('room-1', deps(f, { getTeacherSession: () => null }));
    expect(r.success).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('removes the logo and saves / clears the school name', async () => {
    const f = vi.fn().mockResolvedValue(ok({ success: true }));
    await removeLogo('room-1', deps(f));
    expect(f.mock.calls[0][1].method).toBe('DELETE');
    await saveSchoolName('room-1', 'Farmingdale', deps(f));
    expect(f.mock.calls[1][0]).toBe('https://game.test/api/instances/room-1/school-name');
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ schoolName: 'Farmingdale' });
  });
});
