// The trophy picture and place in the clipboard boxes (Tom, 2026-10-25): shown only when there is a race, in italics
// while the place can still change, with the picture from TROPHIES.csv and the emoji as the fallback.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { TrophyPlace, hasTrophyPlace } from '../../../src/components/player/TrophyPlace';
import { panelPalettes } from '../../../src/components/player/panelTheme';
import { buildLiveBoard } from '../../../src/utils/liveTrophies';
import type { MeasureInput } from '../../../src/utils/trophyScoring';
import { configureTrophyRules, getTrophyRules } from '../../../src/utils/trophyRules';

afterEach(() => { cleanup(); configureTrophyRules([]); });
const p = panelPalettes.light;
const inp = (id: string, over: Partial<MeasureInput> = {}): MeasureInput => ({
  playerId: id, name: id, finished: false, out: false, finishOrder: 99,
  daysUsed: 100, daysPlanned: 400, moneySpent: 100_000, moneyPlanned: 1_000_000, problemPoints: 0, reviews: 2, ...over,
});
const rowOf = (b: ReturnType<typeof buildLiveBoard>, id: string) => b.rows.find(r => r.playerId === id)!;

describe('TrophyPlace', () => {
  it('shows the picture and the place in a real race, italic while the place can still change', () => {
    const board = buildLiveBoard([inp('a', { daysUsed: 100 }), inp('b', { daysUsed: 200 })]);
    // a is ahead on time; b has not reached a's day yet is NOT the case here: b is past a's day, so a is solid.
    const a = rowOf(board, 'a');
    render(<TrophyPlace race="time" row={a} solo={false} palette={p} />);
    const chip = screen.getByTestId('trophy-place-time');
    expect(chip.textContent).toBe('1st');
    expect(chip.querySelector('img')!.getAttribute('src')).toBe('/images/trophies/time.png');
    expect(chip.getAttribute('title')).toMatch(/Fastest: 100 of 400 planned days, 1st of 2/);
    const behind = rowOf(buildLiveBoard([inp('a', { daysUsed: 300 }), inp('b', { daysUsed: 100 })]), 'a');
    cleanup();
    render(<TrophyPlace race="time" row={behind} solo={false} palette={p} />);
    expect(screen.getByTestId('trophy-place-time').textContent).toBe('2nd');
    expect(screen.getByTestId('trophy-place-time').getAttribute('data-provisional')).toBe('true');
    expect(screen.getByTestId('trophy-place-time').getAttribute('title')).toMatch(/for now/);
  });

  it('shows nothing for a solo player, a level race, or a player who is out', () => {
    const solo = rowOf(buildLiveBoard([inp('a')]), 'a');
    const level = rowOf(buildLiveBoard([inp('a'), inp('b')]), 'a');
    const out = rowOf(buildLiveBoard([inp('a', { out: true }), inp('b', { daysUsed: 50 })]), 'a');
    for (const [row, isSolo] of [[solo, true], [level, false], [out, false]] as const) {
      expect(hasTrophyPlace('time', row, isSolo)).toBe(false);
      const { container } = render(<TrophyPlace race="time" row={row} solo={isSolo} palette={p} />);
      expect(container.textContent).toBe('');
      cleanup();
    }
  });

  it('falls back to the emoji when the picture will not load, or the data names none', () => {
    const a = rowOf(buildLiveBoard([inp('a', { daysUsed: 100 }), inp('b', { daysUsed: 200 })]), 'a');
    render(<TrophyPlace race="time" row={a} solo={false} palette={p} />);
    fireEvent.error(screen.getByTestId('trophy-place-time').querySelector('img')!);
    expect(screen.getByTestId('trophy-place-time').textContent).toContain('📅');
    cleanup();
    configureTrophyRules([{ kind: 'trophy', key: 'time', value: '', text: 'Fastest' }]);
    render(<TrophyPlace race="time" row={a} solo={false} palette={p} />);
    expect(screen.getByTestId('trophy-place-time').querySelector('img')).toBeNull();
  });
});

describe('the trophy pictures are data', () => {
  it('TROPHIES.csv names a picture for each trophy and every file exists in public/images', () => {
    const csv = fs.readFileSync(path.join(__dirname, '../../../public/data/CLEAN_FILES/TROPHIES.csv'), 'utf-8');
    for (const id of ['time', 'money', 'quality']) {
      const line = csv.split(/\r?\n/).find(l => l.startsWith(`trophy,${id},`))!;
      const icon = line.split(',')[2];
      expect(icon).toBe(`trophies/${id}.png`);
      expect(fs.existsSync(path.join(__dirname, '../../../public/images', icon))).toBe(true);
    }
    expect(getTrophyRules().icons.money).toBe('trophies/money.png');
  });
});
