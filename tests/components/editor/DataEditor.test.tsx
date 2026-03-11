import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataEditor } from '../../../src/components/editor/DataEditor';
import { GameContext } from '../../../src/context/GameContext';

// Mock admin auth to always be authenticated in tests
vi.mock('../../../src/utils/adminAuth', () => ({
  isAdminAuthenticated: () => true,
  verifyAdminPassword: vi.fn().mockResolvedValue(true),
  clearAdminAuth: vi.fn()
}));

// Mock fetch for loading CSV files
const mockSpacesCSV = `space_name,phase,visit_type,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls
TEST-SPACE-1,SETUP,First,Test event 1,Test action 1,Test outcome 1,Draw 1,,,,,5 days,,TEST-SPACE-2,,,,,YES,Yes,Main,1
TEST-SPACE-1,SETUP,Subsequent,Test event 1 sub,Test action 1 sub,Test outcome 1 sub,Draw 2,,,,,3 days,,TEST-SPACE-2,,,,,NO,No,Main,
TEST-SPACE-2,OWNER,First,Test event 2,Test action 2,Test outcome 2,,Draw 1,,,,10 days,5%,TEST-SPACE-1,,,,,YES,Yes,Main,1
TEST-SPACE-2,OWNER,Subsequent,Test event 2 sub,Test action 2 sub,Test outcome 2 sub,,Draw 2,,,,5 days,3%,TEST-SPACE-1,,,,,NO,No,Main,`;

const mockDiceRollCSV = `space_name,die_roll,visit_type,1,2,3,4,5,6
TEST-SPACE-1,W Cards,First,Draw 1,Draw 1,Draw 2,Draw 2,Draw 3,Draw 3
TEST-SPACE-1,W Cards,Subsequent,Draw 1,Draw 2,Draw 2,Draw 3,Draw 3,Draw 4
TEST-SPACE-2,Next Step,First,TEST-SPACE-1,TEST-SPACE-1,TEST-SPACE-1,TEST-SPACE-2,TEST-SPACE-2,TEST-SPACE-2`;

// Mock dataService
const mockDataService = {
  getAllSpaces: vi.fn(() => []),
  loadData: vi.fn(),
  isLoaded: vi.fn(() => true),
};

// Mock GameContext value
const mockGameContext = {
  dataService: mockDataService,
  stateManager: {} as any,
  turnService: {} as any,
  cardService: {} as any,
  movementService: {} as any,
  effectEngine: {} as any,
  negotiationService: {} as any,
  loggingService: {} as any,
  gameState: null,
  setGameState: vi.fn(),
  currentPlayer: null,
  isLoading: false,
};

describe('DataEditor', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch
    global.fetch = vi.fn((url: string) => {
      if (url.includes('Spaces.csv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockSpacesCSV),
        } as Response);
      }
      if (url.includes('DiceRoll')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockDiceRollCSV),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  const renderEditor = () => {
    return render(
      <GameContext.Provider value={mockGameContext}>
        <DataEditor onClose={mockOnClose} />
      </GameContext.Provider>
    );
  };

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      renderEditor();
      expect(screen.getByText('Loading source files...')).toBeInTheDocument();
    });

    it('loads and displays spaces after fetch completes', async () => {
      renderEditor();

      await waitFor(() => {
        // After loading, the split panel renders with space names in the browser
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
        expect(screen.getByText('TEST-SPACE-2')).toBeInTheDocument();
      });
    });

    it('loads and shows editor placeholder after fetch completes', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('Select a space to edit')).toBeInTheDocument();
      });
    });
  });

  describe('Space Browser', () => {
    it('displays spaces grouped by phase', async () => {
      renderEditor();

      await waitFor(() => {
        // Phase headers are displayed within the space browser
        const setupHeaders = screen.getAllByText('SETUP');
        const ownerHeaders = screen.getAllByText('OWNER');
        expect(setupHeaders.length).toBeGreaterThan(0);
        expect(ownerHeaders.length).toBeGreaterThan(0);
      });
    });

    it('displays space names in the browser', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
        expect(screen.getByText('TEST-SPACE-2')).toBeInTheDocument();
      });
    });

    it('filters spaces by search term', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search spaces...');
      fireEvent.change(searchInput, { target: { value: 'SPACE-2' } });

      expect(screen.queryByText('TEST-SPACE-1')).not.toBeInTheDocument();
      expect(screen.getByText('TEST-SPACE-2')).toBeInTheDocument();
    });

    it('filters spaces by phase', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      const phaseSelect = screen.getByDisplayValue('All Phases');
      fireEvent.change(phaseSelect, { target: { value: 'OWNER' } });

      expect(screen.queryByText('TEST-SPACE-1')).not.toBeInTheDocument();
      expect(screen.getByText('TEST-SPACE-2')).toBeInTheDocument();
    });
  });

  describe('Space Editor', () => {
    it('shows placeholder when no space is selected', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('Select a space to edit')).toBeInTheDocument();
      });
    });

    it('displays space details when a space is selected', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('TEST-SPACE-1'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test action 1')).toBeInTheDocument();
      });
    });

    it('toggles between First and Subsequent visit types', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('TEST-SPACE-1'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1')).toBeInTheDocument();
      });

      // Click Subsequent button (labelled "Sub" in UI)
      fireEvent.click(screen.getByText('Sub'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1 sub')).toBeInTheDocument();
      });
    });

    it('marks changes as unsaved when editing', async () => {
      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('TEST-SPACE-1'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1')).toBeInTheDocument();
      });

      // Edit a field
      const eventInput = screen.getByDisplayValue('Test event 1');
      fireEvent.change(eventInput, { target: { value: 'Modified event' } });

      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('closes without warning when no changes made', async () => {
      renderEditor();

      await waitFor(() => {
        // Wait for loading to complete
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('×'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('warns before closing with unsaved changes', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderEditor();

      await waitFor(() => {
        expect(screen.getByText('TEST-SPACE-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('TEST-SPACE-1'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1')).toBeInTheDocument();
      });

      // Make a change
      const eventInput = screen.getByDisplayValue('Test event 1');
      fireEvent.change(eventInput, { target: { value: 'Modified' } });

      // Try to close
      fireEvent.click(screen.getByText('×'));

      expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Discard and close?');
      expect(mockOnClose).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('shows error when source files fail to load', async () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response));

      renderEditor();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load source files/)).toBeInTheDocument();
      });
    });
  });
});
