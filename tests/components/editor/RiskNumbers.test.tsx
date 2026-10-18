import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RiskNumbers, groupRiskCells, isPriceDiceRow } from '../../../src/components/editor/RiskNumbers';

// Tom, 2026-10-18 ("Close the gap"): a teacher sets the days and money behind a
// chance outcome in plain lines; the odds (how many of the six cells) never change.
const row = (die_roll: string, cells: string[], visit: 'First' | 'Subsequent' = 'First') => ({
  space_name: 'CON-STEER', die_roll, visit_type: visit,
  roll_1: cells[0], roll_2: cells[1], roll_3: cells[2], roll_4: cells[3], roll_5: cells[4], roll_6: cells[5],
  button_label: '', roll_group: '',
}) as any;
const rows = [
  row('Time outcomes', ['0 days', '0 days', '0 days', '0 days', '30 days', '30 days']),
  row('Fees Paid', ['0', '0', '0', '0', '-25000', '-25000']),
  row('Next Step', ['REG-DOB-FINAL-REVIEW', 'REG-DOB-FINAL-REVIEW', 'REG-DOB-FINAL-REVIEW', 'REG-DOB-FINAL-REVIEW', 'CON-ISSUES', 'CON-ISSUES']),
];

describe('RiskNumbers', () => {
  it('shows one plain line per result, with the odds as "N in 6 times"', () => {
    render(<RiskNumbers diceRolls={rows} spaceName="CON-STEER" visitType="First" onUpdateDiceRoll={() => {}} />);
    expect(screen.getAllByTestId('risk-line-days')).toHaveLength(2);
    expect(screen.getAllByTestId('risk-line-money')).toHaveLength(2);
    expect((screen.getByLabelText('2 in 6 times, days') as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText('2 in 6 times, dollars') as HTMLInputElement).value).toBe('25000');
    // The route row is never offered.
    expect(screen.queryByText(/CON-ISSUES/)).toBeNull();
  });

  it('changing a line writes every cell it stands for, in the form the game reads', () => {
    const onUpdate = vi.fn();
    render(<RiskNumbers diceRolls={rows} spaceName="CON-STEER" visitType="First" onUpdateDiceRoll={onUpdate} />);
    fireEvent.change(screen.getByLabelText('2 in 6 times, days'), { target: { value: '10' } });
    expect(onUpdate).toHaveBeenCalledWith(0, 'roll_5', '10 days');
    expect(onUpdate).toHaveBeenCalledWith(0, 'roll_6', '10 days');
    fireEvent.change(screen.getByLabelText('2 in 6 times, dollars'), { target: { value: '5000' } });
    expect(onUpdate).toHaveBeenCalledWith(1, 'roll_5', '-5000');
    fireEvent.change(screen.getByLabelText('2 in 6 times, days'), { target: { value: '9999' } });
    expect(onUpdate).toHaveBeenLastCalledWith(0, 'roll_6', '365 days'); // capped like the server
  });

  it('rows whose cells are places stay hidden; nothing to show renders nothing', () => {
    expect(isPriceDiceRow(row('Time outcomes', ['REG-DOB-FINAL-REVIEW', 'x', 'x', 'x', 'x', 'x']))).toBe(false);
    const { container } = render(<RiskNumbers diceRolls={[rows[2]]} spaceName="CON-STEER" visitType="First" onUpdateDiceRoll={() => {}} />);
    expect(container.innerHTML).toBe('');
    expect(groupRiskCells('Time outcomes', rows[0]).map((g) => [g.value, g.cells.length])).toEqual([[0, 4], [30, 2]]);
  });
});
