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

const urlMap: { [key: string]: string } = {
  '/data/CLEAN_FILES/GAME_CONFIG.csv': mockGameConfigCsv,
  '/data/CLEAN_FILES/MOVEMENT.csv': mockMovementCsv,
  '/data/CLEAN_FILES/DICE_OUTCOMES.csv': mockDiceOutcomesCsv,
  '/data/CLEAN_FILES/SPACE_EFFECTS.csv': mockSpaceEffectsCsv,
  '/data/CLEAN_FILES/DICE_EFFECTS.csv': mockDiceEffectsCsv,
  '/data/CLEAN_FILES/SPACE_CONTENT.csv': mockSpaceContentCsv,
  '/data/CLEAN_FILES/CARDS_EXPANDED.csv': mockCardsExpandedCsv,
  '/data/SOURCE_FILES/ModalConfig.csv': mockModalConfigCsv,
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
    // 10 CLEAN_FILES CSVs (incl. LOGIC_QUESTIONS.csv + PATH_CHOICE_RULES.csv added in
    // v2.57.0, CARD_TYPES.csv added 2026-07-16 for the CSV-portability lift)
    // + 1 SOURCE_FILES/ModalConfig.csv = 11 fetches.
    expect(global.fetch).toHaveBeenCalledTimes(11);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/CARDS_EXPANDED\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/SOURCE_FILES\/ModalConfig\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/PATH_CHOICE_RULES\.csv/));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/CLEAN_FILES\/CARD_TYPES\.csv/));
    expect(dataService.isLoaded()).toBe(true);
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
});