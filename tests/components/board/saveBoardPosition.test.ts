import { describe, it, expect, vi } from 'vitest';
import { saveBoardPosition } from '../../../src/components/board/saveBoardPosition';

// Minimal Spaces.csv with two visit_type rows for one space, plus a second
// space so we can prove the mutation only touches the target. Includes
// pos_x and pos_y in the trailing _extraColumns position so the round-trip
// covers the opaque-pass-through path that v2.65.7 introduced.
const SPACES_CSV =
  'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls,end_turn_label,try_again_label,w_card_label,b_card_label,i_card_label,l_card_label,e_card_label,shake_on,tts_field,w_card_narrative,b_card_narrative,i_card_narrative,l_card_narrative,e_card_narrative,pos_x,pos_y\n'
  + 'TARGET,SETUP,First,T,E,A,O,,,,,,,,n2,,,,,,,Main,,End,Try,,,,,,,,,,,,,100,200\n'
  + 'TARGET,SETUP,Subsequent,T,E,A,O,,,,,,,,n2,,,,,,,Main,,End,Try,,,,,,,,,,,,,100,200\n'
  + 'OTHER,SETUP,First,T,E,A,O,,,,,,,,n3,,,,,,,Main,,End,Try,,,,,,,,,,,,,500,600\n';

const DICE_CSV =
  'space_name,die_roll,visit_type,1,2,3,4,5,6,button_label,roll_group\n'
  + 'TARGET,Next Step,First,a,b,c,d,e,f,Roll,\n';

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  } as unknown as Response;
}

function makeTextResponse(text: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    text: async () => text
  } as unknown as Response;
}

describe('saveBoardPosition', () => {
  it('happy path: mutates both visit_type rows of the target and POSTs', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/data/SOURCE_FILES/Spaces.csv')) return makeTextResponse(SPACES_CSV);
      if (url.startsWith('/data/SOURCE_FILES/DiceRoll Info.csv')) return makeTextResponse(DICE_CSV);
      if (url.endsWith('/api/admin/save-source-files') || url === '/api/admin/save-source-files') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        // capture for outer assertions via closure
        fetchMock.mostRecentSaveBody = body;
        return makeOkResponse({ success: true, files: [] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & { mostRecentSaveBody?: { spacesCSV: string; diceRollCSV: string; password: string } };

    const result = await saveBoardPosition('TARGET', 250, 350, {
      fetch: fetchMock,
      getAdminPassword: () => 'hunter2',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.spaceName).toBe('TARGET');
    expect(result.x).toBe(250);
    expect(result.y).toBe(350);

    const body = fetchMock.mostRecentSaveBody;
    expect(body).toBeDefined();
    expect(body!.password).toBe('hunter2');
    expect(body!.diceRollCSV).toBe(DICE_CSV);

    // Both TARGET rows should carry the new coords; OTHER row is untouched.
    const lines = body!.spacesCSV.trim().split('\n');
    const targetLines = lines.filter(l => l.startsWith('TARGET,'));
    expect(targetLines.length).toBe(2);
    for (const line of targetLines) {
      expect(line.endsWith(',250,350')).toBe(true);
    }
    const otherLine = lines.find(l => l.startsWith('OTHER,'));
    expect(otherLine).toBeDefined();
    expect(otherLine!.endsWith(',500,600')).toBe(true);
  });

  it('returns step=auth when no admin password is in session', async () => {
    const fetchMock = vi.fn();
    const result = await saveBoardPosition('TARGET', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => null,
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('auth');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces fetch_spaces step when Spaces.csv returns non-200', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/data/SOURCE_FILES/Spaces.csv')) return makeTextResponse('', 500);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await saveBoardPosition('TARGET', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('fetch_spaces');
    expect(result.detail).toContain('500');
  });

  it('forwards server step+detail when the save endpoint returns an error', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/data/SOURCE_FILES/Spaces.csv')) return makeTextResponse(SPACES_CSV);
      if (url.startsWith('/data/SOURCE_FILES/DiceRoll Info.csv')) return makeTextResponse(DICE_CSV);
      if (url.endsWith('/api/admin/save-source-files')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ success: false, step: 'write_spaces', detail: 'EACCES' }),
          text: async () => ''
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await saveBoardPosition('TARGET', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('write_spaces');
    expect(result.detail).toBe('EACCES');
  });

  it('returns step=parse with the missing space name when not found in CSV', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/data/SOURCE_FILES/Spaces.csv')) return makeTextResponse(SPACES_CSV);
      if (url.startsWith('/data/SOURCE_FILES/DiceRoll Info.csv')) return makeTextResponse(DICE_CSV);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await saveBoardPosition('NONEXISTENT', 1, 2, {
      fetch: fetchMock as unknown as typeof fetch,
      getAdminPassword: () => 'pw',
      getBackendURL: () => ''
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.step).toBe('parse');
    expect(result.detail).toContain('NONEXISTENT');
  });
});
