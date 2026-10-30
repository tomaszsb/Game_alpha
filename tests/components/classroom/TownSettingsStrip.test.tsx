/* @vitest-pool forks */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TownSettingsStrip } from '../../../src/components/classroom/TownSettingsStrip';
import * as api from '../../../src/components/classroom/townSettingsApi';

describe('TownSettingsStrip (teacher backroom: the round town settings, editable and resettable)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => cleanup());

  it('is folded away until opened, so the classroom row does not grow', () => {
    const spy = vi.spyOn(api, 'fetchTownSettings');
    render(<TownSettingsStrip instanceId="room-1" />);
    expect(screen.queryByLabelText('round_town')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows each setting with the class value or the stock one, saves a change and resets one', async () => {
    vi.spyOn(api, 'fetchTownSettings').mockResolvedValue([
      { key: 'round_town', stock: 'off', mine: null },
      { key: 'pulse_ms', stock: '1800', mine: '2400' },
    ]);
    const save = vi.spyOn(api, 'saveTownSetting').mockResolvedValue({ success: true });
    render(<TownSettingsStrip instanceId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Town settings/ }));
    const town = await screen.findByLabelText('round_town') as HTMLInputElement;
    expect(town.value).toBe('off');
    expect((screen.getByLabelText('pulse_ms') as HTMLInputElement).value).toBe('2400');
    fireEvent.change(town, { target: { value: 'on' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitFor(() => expect(save).toHaveBeenCalledWith('room-1', 'round_town', 'on', undefined));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[1]);
    await waitFor(() => expect(save).toHaveBeenCalledWith('room-1', 'pulse_ms', '', undefined));
    expect(await screen.findByRole('status')).toHaveTextContent('pulse_ms is back to 1800.');
  });
});
