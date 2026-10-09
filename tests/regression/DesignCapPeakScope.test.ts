// tests/regression/DesignCapPeakScope.test.ts
//
// Tom, 2026-10-09: fix the work-package "Remove 1 / Replace 1" rolls AND measure the 20% design-fee cap against
// the BIGGEST scope the player ever had, so dropping work cannot by itself push design fees over the limit.
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

async function game() {
  const s: any = await bootstrapHeadlessServices();
  const { stateService } = s;
  stateService.addPlayer('T');
  const id = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(id);
  stateService.startGame();
  const cap = () => (s.turnService as any).effectEngineService.checkDesignFeeCap(id);
  const me = () => stateService.getPlayer(id);
  const setScope = (hand: string[]) => stateService.updatePlayer({ id, hand } as any);
  const setDesignFees = (design: number) => stateService.updatePlayer({ id, expenditures: { ...me().expenditures, design } } as any);
  return { ...s, id, cap, me, setScope, setDesignFees };
}

describe('the design-fee cap measures against the biggest scope ever', () => {
  it('remembers the biggest scope at each turn commit', async () => {
    const g = await game();
    g.setScope(['W001', 'W003']); // $350K
    g.cap();
    expect(g.me().peakScope).toBe(350_000);
    g.setScope(['W002']); // down to $80K
    g.cap();
    expect(g.me().peakScope).toBe(350_000);
  });

  it('dropping work does not by itself put fees over 20%', async () => {
    const g = await game();
    g.setScope(['W001', 'W003']);
    g.setDesignFees(60_000); // 17% of $350K
    g.cap();
    expect(g.me().outReason).toBeUndefined();
    g.setScope(['W002']); // $80K: 60K would be 75% of the SMALL plan
    g.cap();
    expect(g.me().outReason).toBeUndefined();
  });

  it('more fees past 20% of the biggest plan still end it', async () => {
    const g = await game();
    g.setScope(['W001', 'W003']);
    g.setDesignFees(60_000);
    g.cap();
    g.setScope(['W002']);
    g.setDesignFees(75_000); // 21% of $350K
    g.cap();
    expect(g.me().outReason).toBe('design_fee_cap');
  });

  it('a plan that only ever grew behaves exactly as before', async () => {
    const g = await game();
    g.setScope(['W001']); // $150K
    g.setDesignFees(31_000); // 20.7%
    g.cap();
    expect(g.me().outReason).toBe('design_fee_cap');
  });
});

describe('the remembered size survives the turn machinery', () => {
  it('a push-back (turn state thrown away) does not make the player forget their biggest scope', async () => {
    const g = await game();
    g.stateService.updatePlayer({ id: g.id, currentSpace: 'ENG-SCOPE-CHECK', visitType: 'First', visitedSpaces: ['ENG-SCOPE-CHECK'] } as any);
    await g.turnService.startTurn(g.id);
    g.setScope(['W001', 'W003']);
    g.cap();
    expect(g.me().peakScope).toBe(350_000);
    await g.turnService.tryAgainOnSpace(g.id);
    expect(g.me().peakScope).toBe(350_000);
  });

  it('a normal turn commit keeps it too', async () => {
    const g = await game();
    g.stateService.updatePlayer({ id: g.id, currentSpace: 'ENG-SCOPE-CHECK', visitType: 'First', visitedSpaces: ['ENG-SCOPE-CHECK'], money: 9e6 } as any);
    await g.turnService.startTurn(g.id);
    g.setScope(['W001', 'W003']);
    g.stateService.setPlayerMoveIntent(g.id, 'PM-DECISION-CHECK');
    await g.turnService.endTurnWithMovement(true);
    expect(g.me().peakScope).toBe(350_000);
  });
});
