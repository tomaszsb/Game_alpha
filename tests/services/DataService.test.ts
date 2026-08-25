import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataService } from '../../src/services/DataService';

// Mock fetch globally for tests
global.fetch = vi.fn();

// Simple mock data that matches expectations
const mockCardsExpandedCsv = `card_id,card_name,card_type,description,effects_on_play,cost,phase_restriction,duration,duration_count,turn_effect,activation_timing,loan_amount,loan_rate,investment_amount,work_cost,money_effect,tick_modifier,draw_cards,discard_cards,target,scope,work_type_restriction
W001,Strategic Planning,W,A work card for strategic planning.,,100,Any,0,0,,Immediate,0,0,0,100,0,0,0,0,Self,0,
W002,Design Work,W,Design and development work.,,,Any,0,0,,Immediate,0,0,0,200,0,0,0,0,Self,0,`;

const mockGameConfigCsv = `space_name,phase,path_type,is_starting_space,is_ending_space,min_players,max_players,requires_dice_roll
START,SETUP,A,Yes,No,1,4,No`;

const mockMovementCsv = `space_name,visit_type,movement_type,destination_1,destination_2,destination_3,destination_4,destination_5
START,First,fixed,NEXT,,,,`;

const mockDiceOutcomesCsv = `space_name,visit_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6
START,First,DEST1,DEST2,DEST3,DEST4,DEST5,DEST6`;

const mockSpaceEffectsCsv = `space_name,visit_type,effect_type,effect_action,effect_value,condition,description,trigger_type
START,First,money,add,100,always,Get $100,auto`;

const mockDiceEffectsCsv = `space_name,visit_type,effect_type,card_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6,roll_group
START,First,cards,W,Draw 1,Draw 1,Draw 2,Draw 2,Draw 3,Draw 3,
START,First,time,,1 day,2 days,3 days,4 days,5 days,6 days,groupA`;

const mockSpaceContentCsv = `space_name,visit_type,title,story,action_description,outcome_description,can_negotiate
START,First,Welcome,You have arrived.,Begin your journey.,You moved on.,No`;

const mockModalConfigCsv = `space_name,visit_type,effect_action,modal_title,modal_description,modal_button_label,modal_summary,dice_value
START,First,choice,Decide {playerName},Weigh your options at {spaceName},Commit,,
START,First,dice,Generic Roll Title,Generic desc,OK,,
START,First,dice,Rolled a Six!,Lucky!,Celebrate,,6`;

const mockCharactersCsv = `id,emoji,name,phase,color,image_roles,short_label
OWNER,👔,The Owner,Initiation,#2196F3,owner,Owner`;

const mockViolationRulesCsv = `tier,threshold,deadline_days,fee_rate_ontime,fee_rate_late,daily_rate
small,500000,180,0.04,0.08,500
large,500000,180,0.10,0.20,2000`;

const mockUIStringsCsv = `key,template
DICE_BUTTON.WORK,Get Work Packages`;

const urlMap: { [key: string]: string } = {
  '/data/CLEAN_FILES/GAME_CONFIG.csv': mockGameConfigCsv,
  '/data/CLEAN_FILES/MOVEMENT.csv': mockMovementCsv,
  '/data/CLEAN_FILES/DICE_OUTCOMES.csv': mockDiceOutcomesCsv,
  '/data/CLEAN_FILES/SPACE_EFFECTS.csv': mockSpaceEffectsCsv,
  '/data/CLEAN_FILES/DICE_EFFECTS.csv': mockDiceEffectsCsv,
  '/data/CLEAN_FILES/SPACE_CONTENT.csv': mockSpaceContentCsv,
  '/data/CLEAN_FILES/CARDS_EXPANDED.csv': mockCardsExpandedCsv,
  '/data/SOURCE_FILES/ModalConfig.csv': mockModalConfigCsv,
  '/data/CLEAN_FILES/CHARACTERS.csv': mockCharactersCsv,
  '/data/CLEAN_FILES/VIOLATION_RULES.csv': mockViolationRulesCsv,
  '/data/CLEAN_FILES/UI_STRINGS.csv': mockUIStringsCsv,
};

global.fetch = vi.fn().mockImplementation((url: string) => {
  const cleanUrl = url.split('?')[0]; // Remove query parameters
  const csvData = urlMap[cleanUrl];
  if (!csvData) {
    console.error('No mock data found for URL:', cleanUrl);
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    });
  }
  return Promise.resolve({
    ok: true,
    text: () => Promise.resolve(csvData),
  });
});

describe('DataService', () => {
  let dataService: DataService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the fetch mock for each test
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const cleanUrl = url.split('?')[0]; // Remove query parameters
      const csvData = urlMap[cleanUrl];
      if (!csvData) {
        console.error('No mock data found for URL:', cleanUrl);
        return Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve(''),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(csvData),
      });
    });
    dataService = new DataService();
  });

  it('should fetch and parse all CSV files correctly', async () => {
    await dataService.loadData();
    // 13 CLEAN_FILES CSVs (incl. LOGIC_QUESTIONS.csv + PATH_CHOICE_RULES.csv
    // added in v2.57.0, CARD_TYPES.csv added 2026-07-16, CHARACTERS.csv added
    // 2026-08-09, VIOLATION_RULES.csv + UI_STRINGS.csv added 2026-08-14 for
    // the CSV-portability lift) + 1 SOURCE_FILES/ModalConfig.csv = 14 fetches.
    expect(global.fetch).toHaveBeenCalledTimes(14);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/CARDS_EXPANDED\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/SOURCE_FILES\/ModalConfig\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/PATH_CHOICE_RULES\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/CARD_TYPES\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/CHARACTERS\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/VIOLATION_RULES\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/UI_STRINGS\.csv/));
    expect(dataService.isLoaded()).toBe(true);
  });

  it('should parse CHARACTERS.csv rows via getCharacterRows', async () => {
    await dataService.loadData();
    const rows = dataService.getCharacterRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 'OWNER',
      emoji: '👔',
      name: 'The Owner',
      phase: 'Initiation',
      color: '#2196F3',
      image_roles: 'owner',
      short_label: 'Owner',
    });
  });

  it('should tolerate a missing CHARACTERS.csv', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const cleanUrl = url.split('?')[0];
      if (cleanUrl === '/data/CLEAN_FILES/CHARACTERS.csv') {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      }
      const csvData = urlMap[cleanUrl];
      if (!csvData) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
    });
    const svc = new DataService();
    await svc.loadData();
    expect(svc.isLoaded()).toBe(true);
    expect(svc.getCharacterRows()).toEqual([]);
  });

  it('should parse VIOLATION_RULES.csv rows via getViolationRuleRows', async () => {
    await dataService.loadData();
    const rows = dataService.getViolationRuleRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      tier: 'small',
      threshold: '500000',
      deadline_days: '180',
      fee_rate_ontime: '0.04',
      fee_rate_late: '0.08',
      daily_rate: '500',
    });
    expect(rows[1]).toEqual({
      tier: 'large',
      threshold: '500000',
      deadline_days: '180',
      fee_rate_ontime: '0.10',
      fee_rate_late: '0.20',
      daily_rate: '2000',
    });
  });

  it('should tolerate a missing VIOLATION_RULES.csv', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const cleanUrl = url.split('?')[0];
      if (cleanUrl === '/data/CLEAN_FILES/VIOLATION_RULES.csv') {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      }
      const csvData = urlMap[cleanUrl];
      if (!csvData) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
    });
    const svc = new DataService();
    await svc.loadData();
    expect(svc.isLoaded()).toBe(true);
    expect(svc.getViolationRuleRows()).toEqual([]);
  });

  it('should parse UI_STRINGS.csv rows via getUIStringRows', async () => {
    await dataService.loadData();
    const rows = dataService.getUIStringRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ key: 'DICE_BUTTON.WORK', template: 'Get Work Packages' });
  });

  it('should tolerate a missing UI_STRINGS.csv', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const cleanUrl = url.split('?')[0];
      if (cleanUrl === '/data/CLEAN_FILES/UI_STRINGS.csv') {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      }
      const csvData = urlMap[cleanUrl];
      if (!csvData) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
    });
    const svc = new DataService();
    await svc.loadData();
    expect(svc.isLoaded()).toBe(true);
    expect(svc.getUIStringRows()).toEqual([]);
  });

  it('should expose modal config overrides via getModalConfig', async () => {
    await dataService.loadData();
    const override = dataService.getModalConfig('START', 'First', 'choice');
    expect(override).toBeDefined();
    expect(override?.modal_title).toBe('Decide {playerName}');
    expect(override?.modal_description).toBe('Weigh your options at {spaceName}');
    expect(override?.modal_button_label).toBe('Commit');
    // Empty summary is dropped
    expect(override?.modal_summary).toBeUndefined();

    // Missing action returns undefined
    expect(dataService.getModalConfig('START', 'First', 'draw_W')).toBeUndefined();
  });

  it('should apply dice-specific modal config lookup precedence (Phase 4)', async () => {
    await dataService.loadData();

    // Specific dice value (6) wins over generic
    const specific = dataService.getModalConfig('START', 'First', 'dice', 6);
    expect(specific).toBeDefined();
    expect(specific?.modal_title).toBe('Rolled a Six!');
    expect(specific?.modal_button_label).toBe('Celebrate');

    // Dice value with no specific row falls back to generic
    const fallback = dataService.getModalConfig('START', 'First', 'dice', 3);
    expect(fallback).toBeDefined();
    expect(fallback?.modal_title).toBe('Generic Roll Title');
    expect(fallback?.modal_button_label).toBe('OK');

    // No diceValue passed => only generic row is considered
    const generic = dataService.getModalConfig('START', 'First', 'dice');
    expect(generic).toBeDefined();
    expect(generic?.modal_title).toBe('Generic Roll Title');
  });

  it('should tolerate a missing ModalConfig.csv', async () => {
    // Override fetch so ModalConfig.csv returns 404 but others succeed
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const cleanUrl = url.split('?')[0];
      if (cleanUrl === '/data/SOURCE_FILES/ModalConfig.csv') {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      }
      const csvData = urlMap[cleanUrl];
      if (!csvData) {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
    });
    const svc = new DataService();
    await svc.loadData();
    expect(svc.isLoaded()).toBe(true);
    expect(svc.getModalConfig('START', 'First', 'choice')).toBeUndefined();
  });

  it('should return cards correctly', async () => {
    await dataService.loadData();
    const cards = dataService.getCards();
    expect(cards).toHaveLength(2);
    
    const card = dataService.getCardById('W001');
    expect(card).toBeDefined();
    expect(card!.card_name).toBe('Strategic Planning');
  });

  it('should handle game config correctly', async () => {
    await dataService.loadData();
    const configs = dataService.getGameConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0].space_name).toBe('START');
  });

  it('should parse roll_group column from DICE_EFFECTS.csv', async () => {
    await dataService.loadData();
    const diceEffects = dataService.getDiceEffects('START', 'First');
    expect(diceEffects).toHaveLength(2);
    // First row has empty roll_group
    expect(diceEffects[0].roll_group).toBeUndefined();
    // Second row has roll_group = 'groupA'
    expect(diceEffects[1].roll_group).toBe('groupA');
  });

  // fb: 2026-08-08 — CON-INITIATION's subsequent-visit percentage fee is a
  // construction change-order cost, but EffectFactory used to guess its
  // category by checking if the space name contained "ARCH", so it silently
  // fell into 'engineering'. Fix: an explicit fee_category CSV column (15th
  // column, after roll_numeric_only) read directly instead of guessed.
  it('should parse fee_category column (15th column) from DICE_EFFECTS.csv', async () => {
    const diceEffectsWithFeeCategory = `space_name,visit_type,effect_type,card_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6,roll_group,roll_action,roll_is_percentage,roll_numeric_only,fee_category
ARCH-FEE-REVIEW,First,money,,8%,8%,10%,10%,12%,12%,,fee,true,false,architectural
ENG-FEE-REVIEW,First,money,,2%,2%,4%,4%,6%,6%,,fee,true,false,engineering
CON-INITIATION,Subsequent,money,,0%,2%,4%,6%,8%,10%,,fee,true,false,construction
START,First,time,,1 day,2 days,3 days,4 days,5 days,6 days,,time,false,false,`;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const cleanUrl = url.split('?')[0];
      if (cleanUrl === '/data/CLEAN_FILES/DICE_EFFECTS.csv') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(diceEffectsWithFeeCategory) });
      }
      const csvData = urlMap[cleanUrl];
      if (!csvData) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
    });

    const svc = new DataService();
    await svc.loadData();

    expect(svc.getDiceEffects('ARCH-FEE-REVIEW', 'First')[0].fee_category).toBe('architectural');
    expect(svc.getDiceEffects('ENG-FEE-REVIEW', 'First')[0].fee_category).toBe('engineering');
    expect(svc.getDiceEffects('CON-INITIATION', 'Subsequent')[0].fee_category).toBe('construction');
    // Rows without the column populated stay undefined (blank -> undefined).
    expect(svc.getDiceEffects('START', 'First')[0].fee_category).toBeUndefined();
  });

  // fb: 2026-08-25 — parseSpaceEffectsCsv used to read SPACE_EFFECTS.csv by
  // fixed column NUMBER, so inserting a column mid-header silently shifted
  // every field after it (18 tests went red proving it, see v3.2.33
  // CHANGELOG entry). Fixed to resolve every field by header NAME instead.
  // These tests load SPACE_EFFECTS.csv through the real loadData()/
  // getAllSpaceEffects() path (same as the fee_category test above) so they
  // exercise the actual parser, not a reimplementation of it.
  describe('parseSpaceEffectsCsv (header-name indexing)', () => {
    const loadWithSpaceEffects = async (csv: string) => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        const cleanUrl = url.split('?')[0];
        if (cleanUrl === '/data/CLEAN_FILES/SPACE_EFFECTS.csv') {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(csv) });
        }
        const csvData = urlMap[cleanUrl];
        if (!csvData) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
      });
      const svc = new DataService();
      await svc.loadData();
      return svc;
    };

    // Canonical CLEAN_FILES/SPACE_EFFECTS.csv column order.
    const CANONICAL_HEADER = 'space_name,visit_type,effect_type,effect_action,effect_value,condition,description,trigger_type,fee_type,narrative,modal_title,modal_description,modal_button_label,modal_summary,button_label';

    it('parses the current (canonical) header order, pinning a full row incl. optional fields', async () => {
      const csv = `${CANONICAL_HEADER}
OWNER-FUND-INITIATION,First,money,add,500,always,Get funding approved,auto,FIXED,Owner secures financing.,Funding Approved,You got the money.,Great!,Summary text,Approve Funding
CON-INITIATION,Subsequent,cards,draw,DRAW_CARD,scope_change,Draw a change-order card,,,,,,,,`;

      const svc = await loadWithSpaceEffects(csv);
      const effects = svc.getAllSpaceEffects();
      expect(effects).toHaveLength(2);

      // Full row: every field pinned, including the optional ones.
      expect(effects[0]).toEqual({
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 500, // numeric string -> Number()
        condition: 'always',
        description: 'Get funding approved',
        trigger_type: 'auto',
        fee_type: 'FIXED',
        narrative: 'Owner secures financing.',
        modal_title: 'Funding Approved',
        modal_description: 'You got the money.',
        modal_button_label: 'Great!',
        modal_summary: 'Summary text',
        button_label: 'Approve Funding',
      });

      // Row with a non-numeric effect_value and every optional column blank.
      expect(effects[1]).toEqual({
        space_name: 'CON-INITIATION',
        visit_type: 'Subsequent',
        effect_type: 'cards',
        effect_action: 'draw',
        effect_value: 'DRAW_CARD', // isNaN(Number(...)) -> stays a string
        condition: 'scope_change',
        description: 'Draw a change-order card',
        // All optional fields blank -> absent from the object entirely.
      });
    });

    it('still parses every field correctly when a column is inserted in the MIDDLE of the header', async () => {
      // A column inserted between `condition` and `description` — exactly
      // the shape of insert that used to shift description/trigger_type/
      // fee_type/etc. one slot to the right under positional parsing.
      const csv = `space_name,visit_type,effect_type,effect_action,effect_value,condition,inserted_mid_column,description,trigger_type,fee_type,narrative,modal_title,modal_description,modal_button_label,modal_summary,button_label
OWNER-FUND-INITIATION,First,money,add,500,always,ignore_me,Get funding approved,auto,FIXED,Owner secures financing.,Funding Approved,You got the money.,Great!,Summary text,Approve Funding`;

      const svc = await loadWithSpaceEffects(csv);
      const effects = svc.getAllSpaceEffects();
      expect(effects).toHaveLength(1);
      expect(effects[0]).toEqual({
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 500,
        condition: 'always',
        description: 'Get funding approved',
        trigger_type: 'auto',
        fee_type: 'FIXED',
        narrative: 'Owner secures financing.',
        modal_title: 'Funding Approved',
        modal_description: 'You got the money.',
        modal_button_label: 'Great!',
        modal_summary: 'Summary text',
        button_label: 'Approve Funding',
      });
    });

    it('still parses correctly when columns are reordered wholesale', async () => {
      const csv = `button_label,modal_summary,modal_button_label,modal_description,modal_title,narrative,fee_type,trigger_type,description,condition,effect_value,effect_action,effect_type,visit_type,space_name
Approve Funding,Summary text,Great!,You got the money.,Funding Approved,Owner secures financing.,FIXED,auto,Get funding approved,always,500,add,money,First,OWNER-FUND-INITIATION`;

      const svc = await loadWithSpaceEffects(csv);
      const effects = svc.getAllSpaceEffects();
      expect(effects).toHaveLength(1);
      expect(effects[0]).toEqual({
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 500,
        condition: 'always',
        description: 'Get funding approved',
        trigger_type: 'auto',
        fee_type: 'FIXED',
        narrative: 'Owner secures financing.',
        modal_title: 'Funding Approved',
        modal_description: 'You got the money.',
        modal_button_label: 'Great!',
        modal_summary: 'Summary text',
        button_label: 'Approve Funding',
      });
    });

    it('leaves an optional field undefined when its header column is missing entirely', async () => {
      // fee_type column is dropped from the header altogether (not just
      // blank) — the field must come out undefined, not throw, and every
      // other field (including button_label, which comes after it) must
      // still resolve correctly.
      const csv = `space_name,visit_type,effect_type,effect_action,effect_value,condition,description,trigger_type,narrative,modal_title,modal_description,modal_button_label,modal_summary,button_label
OWNER-FUND-INITIATION,First,money,add,500,always,Get funding approved,auto,Owner secures financing.,Funding Approved,You got the money.,Great!,Summary text,Approve Funding`;

      const svc = await loadWithSpaceEffects(csv);
      const effects = svc.getAllSpaceEffects();
      expect(effects).toHaveLength(1);
      expect(effects[0].fee_type).toBeUndefined();
      expect(effects[0].trigger_type).toBe('auto');
      expect(effects[0].button_label).toBe('Approve Funding');
      expect(effects[0].modal_summary).toBe('Summary text');
    });

    it('treats blank and whitespace-only optional values as undefined, not empty string', async () => {
      const csv = `${CANONICAL_HEADER}
OWNER-FUND-INITIATION,First,money,add,500,always,Get funding approved,,   ,Owner secures financing.,   ,You got the money.,Great!,,Approve Funding`;

      const svc = await loadWithSpaceEffects(csv);
      const effects = svc.getAllSpaceEffects();
      expect(effects).toHaveLength(1);
      const effect = effects[0];
      // Blank trigger_type -> undefined, not ''
      expect(effect.trigger_type).toBeUndefined();
      // Whitespace-only fee_type -> undefined, not '   '
      expect(effect.fee_type).toBeUndefined();
      // Whitespace-only modal_title -> undefined
      expect(effect.modal_title).toBeUndefined();
      // Blank modal_summary -> undefined
      expect(effect.modal_summary).toBeUndefined();
      // Fields that were actually populated are untouched.
      expect(effect.narrative).toBe('Owner secures financing.');
      expect(effect.modal_description).toBe('You got the money.');
      expect(effect.modal_button_label).toBe('Great!');
      expect(effect.button_label).toBe('Approve Funding');
    });
  });
});