/**
 * The setup screen's "Board" choice (Town = street view, the default; Classic).
 * Offered only when the data has a town. The game's other settings ride along unchanged.
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameSettingsPanel } from '../../../src/components/setup/GameSettingsPanel';
import { setTownAvailable } from '../../../src/utils/boardStyle';

const base = { maxPlayers: 4, winCondition: 'FIRST_TO_FINISH', difficulty: 'normal', boardStyle: 'town' as const };

describe('GameSettingsPanel board choice', () => {
  afterEach(() => { cleanup(); setTownAvailable(false); });

  it('is hidden when the board has no town', () => {
    setTownAvailable(false);
    render(<GameSettingsPanel gameSettings={base} onChangeGameSettings={vi.fn()} onOpenCardSelection={vi.fn()} />);
    expect(screen.queryByTestId('setup-board-style')).toBeNull();
  });

  it('shows Street view selected, and passes Classic up when chosen', () => {
    setTownAvailable(true);
    const onChange = vi.fn();
    render(<GameSettingsPanel gameSettings={base} onChangeGameSettings={onChange} onOpenCardSelection={vi.fn()} />);
    const select = screen.getByLabelText('Board every screen starts on') as HTMLSelectElement;
    expect(select.value).toBe('town');
    fireEvent.change(select, { target: { value: 'classic' } });
    expect(onChange).toHaveBeenCalledWith({ ...base, boardStyle: 'classic' });
  });
});
