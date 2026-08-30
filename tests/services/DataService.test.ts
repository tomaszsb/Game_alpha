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

  // ---------------------------------------------------------------------
  // The sibling parsers, converted 2026-08-30.
  //
  // v3.2.39 fixed parseSpaceEffectsCsv to index by header name and left its
  // dozen siblings reading by fixed column NUMBER, with the same latent bug:
  // insert a column anywhere but the end and every field after it shifts one
  // slot, silently. The property each test below pins is the one that
  // actually matters and is easy to state: INSERTING A COLUMN CHANGES
  // NOTHING. Each case parses a canonical header, then parses the same rows
  // with a junk column spliced into the middle, and requires the two results
  // to be deep-equal — plus one explicit value assertion so a parser that
  // returned garbage both times could not pass by matching itself.
  //
  // Not covered here: parseCardsCsv. It is positional too, but it validates
  // its header against expectedColumns and throws a named error on drift, so
  // it fails loudly rather than silently. Deliberately left alone.
  // ---------------------------------------------------------------------
  describe('sibling CSV parsers (header-name indexing)', () => {
    /** Load a DataService with specific CSV URLs overridden. */
    const loadWith = async (overrides: Record<string, string>) => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        const cleanUrl = url.split('?')[0];
        const csvData = overrides[cleanUrl] ?? urlMap[cleanUrl];
        if (!csvData) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csvData) });
      });
      const svc = new DataService();
      await svc.loadData();
      return svc;
    };

    /**
     * Splice a junk column into the middle of a CSV's header and into the
     * same position of every data row. Under positional parsing this shifts
     * every later field by one; under name lookup it must change nothing.
     */
    const insertMidColumn = (csv: string): string => {
      const lines = csv.trim().split('\n');
      const at = Math.max(1, Math.floor(lines[0].split(',').length / 2));
      return lines
        .map((line, i) => {
          const cells = line.split(',');
          cells.splice(at, 0, i === 0 ? 'inserted_mid_column' : 'IGNORE_ME');
          return cells.join(',');
        })
        .join('\n');
    };

    // [ name, csv url, canonical csv, how to read the parsed result back ]
    const cases: Array<[string, string, string, (svc: DataService) => unknown]> = [
      [
        'parseMovementCsv',
        '/data/CLEAN_FILES/MOVEMENT.csv',
        `space_name,visit_type,movement_type,destination_1,destination_2,destination_3,destination_4,destination_5,condition_1,condition_2,condition_3,condition_4,condition_5
START,First,choice,DEST_A,DEST_B,,,,cond_a,cond_b,,,`,
        (svc) => svc.getAllMovements(),
      ],
      [
        'parseDiceOutcomesCsv',
        '/data/CLEAN_FILES/DICE_OUTCOMES.csv',
        `space_name,visit_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6
START,First,R1,R2,R3,R4,R5,R6`,
        (svc) => svc.getAllDiceOutcomes(),
      ],
      [
        'parseDiceEffectsCsv',
        '/data/CLEAN_FILES/DICE_EFFECTS.csv',
        `space_name,visit_type,effect_type,card_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6,roll_group,roll_action,roll_is_percentage,roll_numeric_only,fee_category
START,First,cards,W,Draw 1,Draw 2,Draw 3,Draw 4,Draw 5,Draw 6,groupA,act,true,true,filing`,
        (svc) => svc.getAllDiceEffects(),
      ],
      [
        'parseSpaceContentCsv',
        '/data/CLEAN_FILES/SPACE_CONTENT.csv',
        `space_name,visit_type,title,story,action_description,outcome_description,can_negotiate,end_turn_label,try_again_label,shake_on,tts_field
START,First,Welcome,You have arrived.,Begin.,You moved on.,YES,Done,Retry,shake,tts`,
        (svc) => svc.getAllSpaceContent(),
      ],
      [
        'parseGameConfigCsv',
        '/data/CLEAN_FILES/GAME_CONFIG.csv',
        `space_name,phase,path_type,is_starting_space,is_ending_space,min_players,max_players,requires_dice_roll,is_resume_hub,is_point_of_no_return,min_w_cards_to_leave,fee_calculation_method,fee_label,auto_apply_funding,auto_trigger_card_types,path_choice_memory_key,is_path_choice_lock_point,display_label_override,review_loop_message,pos_x,pos_y,funding_source,has_final_review_gate,approval_role,npc_speaker
START,SETUP,Main,Yes,No,1,4,Yes,Yes,No,2,percentage_of_scope,Filing Fee,Yes,"W,B",funding_choice,Yes,Kickoff,Loop msg,12.5,34.5,bank,Yes,dob_exam,Owner`,
        (svc) => svc.getGameConfig(),
      ],
      [
        'parseLogicQuestionsCsv',
        '/data/CLEAN_FILES/LOGIC_QUESTIONS.csv',
        `space_name,visit_type,question_id,question_text,yes_target,no_target,auto_answer_from,yes_reason,no_reason
START,First,Q1,Is the scope locked?,Q2,DEST_B,scope_locked,Because locked,Because open`,
        (svc) => svc.getAllLogicQuestions(),
      ],
      [
        'parseModalConfigCsv',
        '/data/SOURCE_FILES/ModalConfig.csv',
        `space_name,visit_type,effect_action,modal_title,modal_description,modal_button_label,modal_summary,dice_value
START,First,dice,Rolled a Six!,Lucky!,Celebrate,A summary,6`,
        (svc) => svc.getModalConfig('START', 'First', 'dice', 6),
      ],
      [
        'parseCharactersCsv',
        '/data/CLEAN_FILES/CHARACTERS.csv',
        `id,emoji,name,phase,color,image_roles,short_label
OWNER,👔,The Owner,Initiation,#2196F3,owner,Owner`,
        (svc) => svc.getCharacterRows(),
      ],
      [
        'parseViolationRulesCsv',
        '/data/CLEAN_FILES/VIOLATION_RULES.csv',
        `tier,threshold,deadline_days,fee_rate_ontime,fee_rate_late,daily_rate
small,500000,180,0.04,0.08,500`,
        (svc) => svc.getViolationRuleRows(),
      ],
      [
        'parseUIStringsCsv',
        '/data/CLEAN_FILES/UI_STRINGS.csv',
        `key,template
DICE_BUTTON.WORK,Get Work Packages`,
        (svc) => svc.getUIStringRows(),
      ],
      [
        'parseCardTypeLabelsCsv',
        '/data/CLEAN_FILES/CARD_TYPES.csv',
        `card_type,label
W,Work Packages`,
        (svc) => svc.getCardTypeLabels(),
      ],
      [
        'parsePathChoiceRulesCsv',
        '/data/CLEAN_FILES/PATH_CHOICE_RULES.csv',
        `affected_space,memory_key,chosen_value,excluded_destination
START,funding_choice,bank,INVESTOR-REVIEW`,
        (svc) => svc.getPathChoiceExclusions('START', { funding_choice: 'bank' }),
      ],
    ];

    it.each(cases)('%s: a column inserted mid-header changes nothing', async (_name, url, csv, read) => {
      const canonical = read(await loadWith({ [url]: csv }));
      const shifted = read(await loadWith({ [url]: insertMidColumn(csv) }));

      // The parsed result must be identical either way...
      expect(shifted).toEqual(canonical);
      // ...and must be real data, so a parser returning nothing both times
      // cannot pass this test by matching its own emptiness.
      expect(JSON.stringify(canonical)).not.toBe(JSON.stringify(Array.isArray(canonical) ? [] : undefined));
    });

    it('parseMovementCsv: pins the actual field values, not just their stability', async () => {
      const svc = await loadWith({
        '/data/CLEAN_FILES/MOVEMENT.csv': insertMidColumn(
          `space_name,visit_type,movement_type,destination_1,destination_2,destination_3,destination_4,destination_5,condition_1,condition_2,condition_3,condition_4,condition_5
START,First,choice,DEST_A,DEST_B,,,,cond_a,cond_b,,,`,
        ),
      });
      const move = svc.getMovement('START', 'First');
      expect(move).toBeDefined();
      expect(move!.movement_type).toBe('choice');
      expect(move!.destination_1).toBe('DEST_A');
      expect(move!.destination_2).toBe('DEST_B');
      expect(move!.destination_3).toBeUndefined();
      expect(move!.condition_1).toBe('cond_a');
      expect(move!.condition_2).toBe('cond_b');
      // The junk column must not have leaked into any real field.
      expect(JSON.stringify(move)).not.toContain('IGNORE_ME');
    });

    it('parseGameConfigCsv: typed fields survive a mid-header insert', async () => {
      const csv = `space_name,phase,path_type,is_starting_space,is_ending_space,min_players,max_players,requires_dice_roll,is_resume_hub,is_point_of_no_return,min_w_cards_to_leave,fee_calculation_method,fee_label,auto_apply_funding,auto_trigger_card_types,path_choice_memory_key,is_path_choice_lock_point,display_label_override,review_loop_message,pos_x,pos_y,funding_source,has_final_review_gate,approval_role,npc_speaker
START,SETUP,Main,Yes,No,1,4,Yes,Yes,No,2,percentage_of_scope,Filing Fee,Yes,"W,B",funding_choice,Yes,Kickoff,Loop msg,12.5,34.5,bank,Yes,dob_exam,Owner`;
      const svc = await loadWith({ '/data/CLEAN_FILES/GAME_CONFIG.csv': insertMidColumn(csv) });
      const cfg = svc.getGameConfigBySpace('START');

      expect(cfg).toBeDefined();
      // Numbers stay numbers rather than becoming NaN off a shifted cell.
      expect(cfg!.min_players).toBe(1);
      expect(cfg!.max_players).toBe(4);
      expect(cfg!.min_w_cards_to_leave).toBe(2);
      expect(svc.getPosition('START')).toEqual({ x: 12.5, y: 34.5 });
      // Enums stay inside their allowed set rather than falling back to ''.
      expect(cfg!.funding_source).toBe('bank');
      expect(cfg!.approval_role).toBe('dob_exam');
      expect(cfg!.fee_calculation_method).toBe('percentage_of_scope');
      // 'Yes'/'No' booleans land on the right fields.
      expect(cfg!.is_starting_space).toBe(true);
      expect(cfg!.is_ending_space).toBe(false);
      expect(cfg!.has_final_review_gate).toBe(true);
      expect(cfg!.npc_speaker).toBe('Owner');
    });

    it('parseSpaceContentCsv: a missing can_negotiate column yields false instead of throwing', async () => {
      // Positional code read values[6].toUpperCase() with no guard, so a row
      // shorter than 7 cells threw. Name lookup can legitimately return
      // undefined for a column the file does not have.
      const svc = await loadWith({
        '/data/CLEAN_FILES/SPACE_CONTENT.csv': `space_name,visit_type,title,story,action_description,outcome_description
START,First,Welcome,You have arrived.,Begin.,You moved on.`,
      });
      const content = svc.getSpaceContent('START', 'First');
      expect(content).toBeDefined();
      expect(content!.can_negotiate).toBe(false);
      expect(content!.title).toBe('Welcome');
      // Defaults still apply for the absent optional columns.
      expect(content!.end_turn_label).toBe('End Turn');
      expect(content!.try_again_label).toBe('Try Again');
    });
  });
});