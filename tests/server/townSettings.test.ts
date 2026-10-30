// A classroom's town settings (round town, stage 1a): its board copy gets the stock town file with the round town OFF,
// and a teacher's own value (Teacher backroom, Tom 10-18: editable and resettable) lands in that copy.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { applyTownSettingsToCsv, bakeInstance, computeStockVersion, resolvedDir, TOWN_SETTING_KEY } from '../../server/instanceResolver.js';
import { createInstance } from '../../server/instanceStore.js';
import { newGameTownShape } from '../../src/utils/townRound';
import { stockTownSettings } from '../../src/components/classroom/townSettingsApi';

const STOCK_TOWN = fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES/TOWN.csv'), 'utf-8');
const rowsOf = (csv: string) => {
  const [head, ...lines] = csv.split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map(l => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ''])); }) as Array<{ kind: string; id: string; value: string }>;
};
const setting = (csv: string, key: string) => rowsOf(csv).find(r => r.kind === 'setting' && r.id === key)?.value;

describe('applyTownSettingsToCsv', () => {
  it('puts the classroom value in the setting row and keeps every other row as it was', () => {
    const out = applyTownSettingsToCsv(STOCK_TOWN, { round_town: 'on', pulse_ms: '2400' });
    expect(setting(out, 'round_town')).toBe('on');
    expect(setting(out, 'pulse_ms')).toBe('2400');
    const before = STOCK_TOWN.split('\n').filter(l => !/^setting,(round_town|pulse_ms),/.test(l));
    const after = out.split('\n').filter(l => !/^setting,(round_town|pulse_ms),/.test(l));
    expect(after).toEqual(before);
  });

  it('adds a setting the stock file lacks, and skips anything outside the rules', () => {
    const out = applyTownSettingsToCsv(STOCK_TOWN, { round_new_thing: '3', walk_ms: '1', 'round_x,y': '1', pulse_glow: 'a,b', round_side: '' });
    expect(setting(out, 'round_new_thing')).toBe('3');
    expect(setting(out, 'walk_ms')).toBe('1500');
    expect(setting(out, 'pulse_glow')).toBe('0.9');
    expect(setting(out, 'round_side')).toBe('site owner office site_new');
    expect(applyTownSettingsToCsv(STOCK_TOWN, {})).toBe(STOCK_TOWN);
  });

  it('the teacher strip lists exactly the settings the server lets a teacher change', () => {
    const keys = stockTownSettings(STOCK_TOWN).map(s => s.key);
    expect(keys).toContain('round_town');
    expect(keys).toContain('pulse_rest_glow');
    expect(keys.every(k => TOWN_SETTING_KEY.test(k))).toBe(true);
    expect(keys).not.toContain('walk_ms');
  });
});

describe("a classroom's board copy", () => {
  let tmp: string, stockDir: string, instancesRoot: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'town-settings-'));
    stockDir = path.join(tmp, 'stock');
    instancesRoot = path.join(tmp, 'instances');
    fs.mkdirSync(path.join(stockDir, 'SOURCE_FILES'), { recursive: true });
    fs.mkdirSync(path.join(stockDir, 'CLEAN_FILES'), { recursive: true });
    fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'Spaces.csv'), [
      'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,pos_x,pos_y',
      'START-SPACE,SETUP,First,Start,You begin.,Do a thing,Done,,,,,,1,0,FINISH,,,,,NO,NO,Main,100,200',
      'FINISH,END,First,Finish,Done.,Nothing,Done,,,,,,0,0,,,,,,NO,NO,Main,300,400',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(stockDir, 'SOURCE_FILES', 'DiceRoll Info.csv'), 'space_name,visit_type,die_roll,1,2,3,4,5,6\n');
    fs.writeFileSync(path.join(stockDir, 'CLEAN_FILES', 'TOWN.csv'), STOCK_TOWN);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  const bakedTown = (config: ReturnType<typeof createInstance>) => {
    bakeInstance({ stockDataDir: stockDir, instancesRoot, config, stockVersion: computeStockVersion(stockDir) });
    return fs.readFileSync(path.join(resolvedDir(instancesRoot, config.meta.id), 'CLEAN_FILES', 'TOWN.csv'), 'utf-8');
  };

  it('gets the round town switch with the default OFF', () => {
    const town = bakedTown(createInstance(instancesRoot, { id: 'classroom-2' }));
    expect(setting(town, 'round_town')).toBe('off');
    expect(newGameTownShape(rowsOf(town), '')).toBeUndefined();
  });

  it("gets the teacher's own value: round_town on makes every new game in the class round", () => {
    const config = createInstance(instancesRoot, { id: 'classroom-3' });
    (config as unknown as { townSettings: Record<string, string> }).townSettings = { round_town: 'on' };
    const town = bakedTown(config);
    expect(setting(town, 'round_town')).toBe('on');
    expect(newGameTownShape(rowsOf(town), '')).toBe('round');
  });
});
