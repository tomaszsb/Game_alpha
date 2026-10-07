// The three-trophy win rule as it plays: a finish no longer ends the game, money trouble takes one
// player out, and the trophies pick the winner once everyone is finished or out.
import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrapHeadlessServices, HeadlessServices } from '../ghost/bootstrapServices';
import { configureTrophyRules } from '../../src/utils/trophyRules';

let s: HeadlessServices;

async function newGame(names: string[]): Promise<string[]> {
  s = await bootstrapHeadlessServices();
  configureTrophyRules(s.dataService.getTrophyRuleRows());
  names.forEach(n => s.stateService.addPlayer(n));
  const ids = s.stateService.getAllPlayers().map(p => p.id);
  // Off the scope-gated start space, so a turn can end without work packages.
  ids.forEach(id => s.stateService.updatePlayer({ id, currentSpace: 'PM-DECISION-CHECK', visitType: 'Subsequent' }));
  s.stateService.setCurrentPlayer(ids[0]);
  s.stateService.startGame();
  await s.turnService.startTurn(ids[0]);
  return ids;
}

const current = () => s.stateService.getGameState().currentPlayerId;
const player = (id: string) => s.stateService.getPlayer(id)!;

describe('three-trophy flow', () => {
  beforeEach(() => configureTrophyRules([]));

  it('the first player to finish stops taking turns but the game goes on', async () => {
    const [a, b] = await newGame(['Ann', 'Bo']);
    s.stateService.updatePlayer({ id: a, currentSpace: 'FINISH' });
    await s.turnService.endTurnWithMovement(true);

    expect(player(a).finishedAtTurn).toBeDefined();
    expect(s.stateService.getGameState().isGameOver).toBe(false);
    expect(current()).toBe(b);

    // Bo's turn ends -> Ann is skipped, it is Bo again.
    await s.turnService.endTurnWithMovement(true);
    expect(current()).toBe(b);
    expect(s.stateService.getGameState().isGameOver).toBe(false);
  });

  it('when the last player finishes, the trophies pick the winner and the board is on the game state', async () => {
    const [a, b] = await newGame(['Ann', 'Bo']);
    s.stateService.updatePlayer({ id: a, currentSpace: 'FINISH' });
    s.stateService.updateTempState(a, { timeSpent: 400 });
    await s.turnService.endTurnWithMovement(true);
    s.stateService.updatePlayer({ id: b, currentSpace: 'FINISH' });
    s.stateService.updateTempState(b, { timeSpent: 100 });
    await s.turnService.endTurnWithMovement(true);

    const g = s.stateService.getGameState();
    expect(g.isGameOver).toBe(true);
    expect(g.winner, JSON.stringify(g.standings)).toBe(b); // fewer days against the same plan
    expect(g.standings?.rows.length).toBe(2);
    expect(g.standings?.rows.find(r => r.playerId === b)?.trophies).toContain('time');
  });

  it('going broke takes only that player out; the others play on and the one out holds no trophy', async () => {
    const [a, b] = await newGame(['Ann', 'Bo']);
    s.stateService.updatePlayer({ id: a, money: -5 });
    await s.turnService.endTurnWithMovement(true);

    expect(player(a).outReason).toBe('bankruptcy');
    expect(s.stateService.getGameState().isGameOver).toBe(false);
    expect(current()).toBe(b);

    s.stateService.updatePlayer({ id: b, currentSpace: 'FINISH' });
    await s.turnService.endTurnWithMovement(true);

    const g = s.stateService.getGameState();
    expect(g.isGameOver).toBe(true);
    expect(g.winner).toBe(b);
    expect(g.standings?.rows.find(r => r.playerId === a)?.trophies).toEqual([]);
    expect(g.standings?.rows.find(r => r.playerId === a)?.status).toBe('out');
  });

  it('a solo player who goes broke still gets the loss screen (no winner, a reason)', async () => {
    const [a] = await newGame(['Ann']);
    s.stateService.updatePlayer({ id: a, money: -5 });
    await s.turnService.endTurnWithMovement(true);

    const g = s.stateService.getGameState();
    expect(g.isGameOver).toBe(true);
    expect(g.winner).toBeUndefined();
    expect(g.gameEndReason).toEqual({ type: 'bankruptcy', playerId: a });
  });

  it('a solo player who finishes wins', async () => {
    const [a] = await newGame(['Ann']);
    s.stateService.updatePlayer({ id: a, currentSpace: 'FINISH' });
    await s.turnService.endTurnWithMovement(true);
    const g = s.stateService.getGameState();
    expect(g.isGameOver).toBe(true);
    expect(g.winner).toBe(a);
    expect(g.gameEndReason).toBeUndefined();
  });

  it('quality events land in the ledger, and a Try Again takes them back', async () => {
    const [a] = await newGame(['Ann']);
    const emit = (eventId: string) => s.stateService.emitGameEvent({
      type: 'quality_event', playerId: a, playerName: 'Ann', eventId, spaceName: player(a).currentSpace,
    });
    emit('review_passed');
    emit('review_sent_back');
    emit('cut_corner');
    expect(player(a).trophyRecord).toMatchObject({ reviews: 2, problemPoints: 3 });

    s.stateService.discardTempState(a);
    expect(player(a).trophyRecord?.problemPoints ?? 0).toBe(0);
    expect(player(a).trophyRecord?.reviews ?? 0).toBe(0);
  });

  it('a finished player is skipped even when others have turns to skip', async () => {
    const [a, b, c] = await newGame(['Ann', 'Bo', 'Cy']);
    s.stateService.updatePlayer({ id: a, currentSpace: 'FINISH' });
    await s.turnService.endTurnWithMovement(true);
    expect(current()).toBe(b);
    await s.turnService.endTurnWithMovement(true);
    expect(current()).toBe(c);
    await s.turnService.endTurnWithMovement(true);
    expect(current()).toBe(b); // wraps past Ann
  });
});

describe('live trophy board from the real services', () => {
  it('shows everyone mid-game, ranks the one with fewer days first, and leaves out the player who is out', async () => {
    const [a, b, c] = await newGame(['Ann', 'Bo', 'Cy']);
    s.stateService.updateTempState(a, { timeSpent: 40 });
    s.stateService.updateTempState(b, { timeSpent: 90 });
    s.stateService.updatePlayer({ id: c, outReason: 'bankruptcy' });

    const board = s.gameRulesService.computeLiveBoard();
    const row = (id: string) => board.rows.find(r => r.playerId === id)!;
    expect(row(a).races.time).toMatchObject({ place: 1, of: 2 });
    expect(row(b).races.time.place).toBe(2);
    expect(row(c).status).toBe('out');
    expect(row(a).solid).toBe(true);
    expect(row(b).solid).toBe(false);
  });
});
