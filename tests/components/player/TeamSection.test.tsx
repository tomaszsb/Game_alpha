// "Your team": all three people on offer are shown together (not one pop-up at a time), each one says what it is
// good or weak at, and a click hires that one person (Tom, 2026-10-25).
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamSection } from '../../../src/components/player/TeamSection';
import { panelPalettes } from '../../../src/components/player/panelTheme';
import { bootstrapHeadlessServices } from '../../ghost/bootstrapServices';
import { repStrengthLine } from '../../../src/utils/repRules';
import { getRepDef } from '../../../src/utils/repRules';

async function setup() {
  const s = await bootstrapHeadlessServices();
  s.stateService.addPlayer('Team Test');
  const pid = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(pid);
  s.stateService.startGame();
  return { s, pid };
}

describe('TeamSection hire list', () => {
  it('shows every choice at once, each saying what it is good or weak at', async () => {
    const { s, pid } = await setup();
    render(<TeamSection playerId={pid} repService={s.repService} palette={panelPalettes.light} canAct />);
    fireEvent.click(screen.getByTestId('team-hire'));
    const rows = screen.getByTestId('team-offers').querySelectorAll('[data-testid^="team-offer-"]:not([data-testid*="hire"]):not([data-testid*="done"])');
    expect(rows.length).toBe(3);
    for (const row of Array.from(rows)) {
      expect(row.textContent).toMatch(/(Good|Weak) at /);
      expect(row.textContent).toMatch(/days/);
    }
  });

  it('hires the one clicked and leaves the others on offer', async () => {
    const { s, pid } = await setup();
    render(<TeamSection playerId={pid} repService={s.repService} palette={panelPalettes.light} canAct />);
    fireEvent.click(screen.getByTestId('team-hire'));
    const hireButtons = screen.getAllByTestId(/^team-offer-hire-/);
    expect(hireButtons.length).toBe(3);
    const id = hireButtons[1].getAttribute('data-testid')!.replace('team-offer-hire-', '');
    fireEvent.click(hireButtons[1]);
    expect(s.repService.getReps(pid).map(r => r.id)).toEqual([id]);
    expect(screen.getAllByTestId(/^team-offer-hire-/).length).toBe(2);
    expect(screen.getByTestId(`team-rep-${id}`).textContent).toMatch(/(Good|Weak) at /);
  });
});

describe('repStrengthLine', () => {
  it('names the area and the days for a good rep and a bad rep', () => {
    expect(repStrengthLine(getRepDef('CODE-1')!)).toMatch(/^Good at design code: 3 days off/);
    expect(repStrengthLine(getRepDef('PERMITS-4')!)).toMatch(/^Weak at city and fire filing: 3 extra days/);
  });
});
