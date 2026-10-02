// tests/regression/ScopeWording.test.ts
//
// Tom, 2026-10-02 (fb:612fbdc4): a player's scope read like a school + an airport + a
// brewery. Now chance hands each player ONE kind of project the first time they draw
// work packages, and every work package carries a {project} blank filled with it.
// Data-driven (SCOPE_WORDING.csv) so a reskin brings its own words.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { fillProjectBlank, getCardWordedFor, newestScopeBaseIds, withIndefiniteArticle } from '../../src/utils/scopeWording';

async function startedPlayer() {
  const s: any = await bootstrapHeadlessServices();
  s.stateService.addPlayer('Test');
  const playerId = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(playerId);
  s.stateService.startGame();
  s.stateService.updatePlayer({ id: playerId, currentSpace: 'OWNER-SCOPE-INITIATION', visitType: 'First', visitedSpaces: ['OWNER-SCOPE-INITIATION'], money: 0, loans: [] } as any);
  await s.turnService.startTurn(playerId);
  return { ...s, playerId, player: () => s.stateService.getPlayer(playerId)! };
}

describe('SCOPE_WORDING.csv (the shipped data)', () => {
  it('lists the kinds of project, and every work package has a {project} blank', async () => {
    const { dataService } = await startedPlayer();
    const types: string[] = dataService.getScopeProjectTypes();
    expect(types.length).toBeGreaterThanOrEqual(2);
    expect(new Set(types).size).toBe(types.length);
    const workPackages = dataService.getCards().filter((c: any) => c.card_type === 'W');
    expect(workPackages.length).toBe(176);
    for (const c of workPackages) {
      const t = dataService.getCardScopeTemplate(c.card_id);
      expect(t, `${c.card_id} has a template`).toBeTruthy();
      expect(t, `${c.card_id} has the blank`).toContain('{project}');
    }
  });

  it('every template reads as a sentence for every kind of project (no stray braces)', async () => {
    const { dataService } = await startedPlayer();
    for (const type of dataService.getScopeProjectTypes()) {
      for (const c of dataService.getCards().filter((x: any) => x.card_type === 'W')) {
        const text = fillProjectBlank(dataService.getCardScopeTemplate(c.card_id)!, type);
        expect(text).not.toMatch(/[{}]/);
        expect(text).toContain(type);
      }
    }
  });
});

describe('the pick', () => {
  it('first draw of work packages hands the player a kind of project; it then stays put', async () => {
    const s = await startedPlayer();
    expect(s.player().projectType).toBeUndefined();
    s.cardService.drawCards(s.playerId, 'W', 2);
    const first = s.player().projectType;
    expect(s.dataService.getScopeProjectTypes()).toContain(first);
    for (let i = 0; i < 5; i++) s.cardService.drawCards(s.playerId, 'W', 1);
    expect(s.player().projectType).toBe(first);
  });

  it('drawing other kinds of card does not pick one', async () => {
    const s = await startedPlayer();
    s.cardService.drawCards(s.playerId, 'E', 1);
    expect(s.player().projectType).toBeUndefined();
  });

  it('a push-back throws the pick away with the work packages it dealt', async () => {
    const s = await startedPlayer();
    s.cardService.drawCards(s.playerId, 'W', 2);
    expect(s.player().projectType).toBeTruthy();
    const r = await s.turnService.tryAgainOnSpace(s.playerId);
    expect(r.success).toBe(true);
    expect(s.player().projectType).toBeUndefined();
  });

  it('no kinds listed = feature off: nothing is picked', async () => {
    const s = await startedPlayer();
    (s.dataService as any).scopeProjectTypes = [];
    s.cardService.drawCards(s.playerId, 'W', 2);
    expect(s.player().projectType).toBeUndefined();
  });
});

describe('getCardWordedFor', () => {
  const source = (templates: Record<string, string>) => ({
    getCardById: (id: string) => (id.startsWith('W001')
      ? ({ card_id: 'W001', card_name: 'Lobby renovation for corporate headquarters', description: 'Lobby renovation for corporate headquarters', card_type: 'W' } as any)
      : undefined),
    getCardScopeTemplate: (id: string) => templates[id],
  });

  it('fills the blank with the player\'s kind of project', () => {
    const c = getCardWordedFor(source({ W001: 'Lobby renovation for the {project}' }), 'W001', 'school')!;
    expect(c.card_name).toBe('Lobby renovation for the school');
    expect(c.description).toBe('Lobby renovation for the school');
  });

  it('works on a drawn instance id (W001_<time>_<rand>_0)', () => {
    const c = getCardWordedFor(source({ W001: 'Lobby renovation for the {project}' }), 'W001_1756274803252_sezfko0rc_0', 'school')!;
    expect(c.card_name).toBe('Lobby renovation for the school');
  });

  it('not construction-only: a reskin brings its own words (castle)', () => {
    const c = getCardWordedFor(source({ W001: 'Moat repair for the {project}' }), 'W001', 'castle')!;
    expect(c.card_name).toBe('Moat repair for the castle');
  });

  it('no kind picked, or no template for the card: the card keeps its own wording', () => {
    expect(getCardWordedFor(source({ W001: 'x {project}' }), 'W001', undefined)!.card_name).toBe('Lobby renovation for corporate headquarters');
    expect(getCardWordedFor(source({}), 'W001', 'school')!.card_name).toBe('Lobby renovation for corporate headquarters');
    expect(getCardWordedFor(source({}), 'ZZZ', 'school')).toBeUndefined();
  });

  it('a/an for the story line', () => {
    expect(withIndefiniteArticle('school')).toBe('a school');
    expect(withIndefiniteArticle('airport terminal')).toBe('an airport terminal');
  });
});

describe('newestScopeBaseIds — which work was just added', () => {
  const isScope = (id: string) => id.startsWith('W');
  it('tags the last batch drawn, not the earlier ones', () => {
    const held = ['W001_1790000000000_aaa_0', 'W002_1790000000500_bbb_1', 'W003_1790009000000_ccc_0', 'W004_1790009000100_ddd_1', 'E001_1790009000200_eee_0'];
    expect([...newestScopeBaseIds(held, isScope)].sort()).toEqual(['W003', 'W004']);
  });
  it('a preset starting hand (no time in the id) never counts as new', () => {
    expect(newestScopeBaseIds(['W001', 'W002'], isScope).size).toBe(0);
  });
  it('nothing held, nothing new', () => {
    expect(newestScopeBaseIds([], isScope).size).toBe(0);
  });
});
