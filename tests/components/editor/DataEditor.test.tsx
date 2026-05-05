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

// Mock fetch for loading CSV files — must match actual Spaces.csv column order (30 columns):
// space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls,end_turn_label,try_again_label,w_card_label,b_card_label,i_card_label,l_card_label,e_card_label
const mockSpacesCSV = `space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls,end_turn_label,try_again_label,w_card_label,b_card_label,i_card_label,l_card_label,e_card_label
TEST-SPACE-1,SETUP,First,Test Space One,Test event 1,Test action 1,Test outcome 1,Draw 1,,,,,5 days,,TEST-SPACE-2,,,,,YES,Yes,Main,1,Proceed,Retry,Add Work Package,,,,
TEST-SPACE-1,SETUP,Subsequent,Test Space One,Test event 1 sub,Test action 1 sub,Test outcome 1 sub,Draw 2,,,,,3 days,,TEST-SPACE-2,,,,,NO,No,Main,,,,,,,,
TEST-SPACE-2,OWNER,First,Test Space Two,Test event 2,Test action 2,Test outcome 2,,Draw 1,,,,10 days,5%,TEST-SPACE-1,,,,,YES,Yes,Main,1,Accept,Renegotiate,,Get Bank Loan,,,
TEST-SPACE-2,OWNER,Subsequent,Test Space Two,Test event 2 sub,Test action 2 sub,Test outcome 2 sub,,Draw 2,,,,5 days,3%,TEST-SPACE-1,,,,,NO,No,Main,,,,,,,,
TEST-LOGIC-SPACE,DESIGN,First,Logic Test,Logic event,Logic action,Logic outcome,,,,,,,,"Scope4M YES - TEST-SPACE-1 - NO - TEST-SPACE-2",,,,,,No,LOGIC,,,,,,,,`;

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
      if (url.includes('ModalConfig')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('space_name,visit_type,effect_action,modal_title,modal_description,modal_button_label,modal_summary\n'),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    }) as any;
  });

  const renderEditor = () => {
    return render(
      <GameContext.Provider value={mockGameContext as any}>
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

      // Try to close — use the header close button (the large one with bold style)
      const closeButtons = screen.getAllByText('×');
      const headerClose = closeButtons.find(btn =>
        btn.style.fontSize === '20px' || btn.closest('div')?.style.borderBottom
      ) || closeButtons[0];
      fireEvent.click(headerClose);

      expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Discard and close?');
      expect(mockOnClose).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Field Regression - all editor sections render', () => {
    async function selectSpace(spaceName: string) {
      renderEditor();
      await waitFor(() => {
        expect(screen.getByText(spaceName)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(spaceName));
    }

    it('renders Identity & Config section with all fields', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        // Space name (read-only)
        expect(screen.getByDisplayValue('TEST-SPACE-1')).toBeInTheDocument();
        // Phase dropdown
        expect(screen.getByDisplayValue('SETUP')).toBeInTheDocument();
        // Title field (in header, inline with space name)
        expect(screen.getByDisplayValue('Test Space One')).toBeInTheDocument();
      });

      // Verify labels exist (use getAllByText for labels that may appear in multiple places)
      expect(screen.getByText('Space Name')).toBeInTheDocument();
      expect(screen.getByText('Visit Type')).toBeInTheDocument();
      expect(screen.getByText('Phase')).toBeInTheDocument();
      expect(screen.getByText('Dice Roll?')).toBeInTheDocument();
      expect(screen.getByText('Rolls')).toBeInTheDocument();
      expect(screen.getAllByText('Negotiate').length).toBeGreaterThan(0);
    });

    it('renders Path Type dropdown in Movement section', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Main')).toBeInTheDocument();
      });

      expect(screen.getByText('Path Type')).toBeInTheDocument();
    });

    it('renders Button Labels section with end_turn_label and try_again_label', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        // Button label values from CSV
        expect(screen.getByDisplayValue('Proceed')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Retry')).toBeInTheDocument();
      });

      // Section and field labels
      expect(screen.getByText('End Turn Label')).toBeInTheDocument();
      expect(screen.getByText('Try Again Label')).toBeInTheDocument();
      // Preview section shows the labels as button previews
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('renders Story & Narrative section with Event, Action, Outcome', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test action 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test outcome 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Event (Story)')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Outcome')).toBeInTheDocument();
    });

    it('renders Cards section with all 5 card types plus Time and Fee', async () => {
      await selectSpace('TEST-SPACE-2');

      await waitFor(() => {
        // TEST-SPACE-2 has b_card=Draw 1 and fee=5%
        expect(screen.getByDisplayValue('Draw 1')).toBeInTheDocument();
      });

      // Card type badge labels (emoji + letter in styled spans)
      // Use exact text matching for the card badge content
      const badges = document.querySelectorAll('span');
      const badgeTexts = Array.from(badges).map(b => b.textContent?.trim());
      expect(badgeTexts).toEqual(expect.arrayContaining([
        expect.stringContaining('W'),
        expect.stringContaining('B'),
        expect.stringContaining('I'),
        expect.stringContaining('L'),
        expect.stringContaining('E'),
      ]));
    });

    it('renders card button label inputs', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        // TEST-SPACE-1 has w_card_label="Add Work Package"
        expect(screen.getByDisplayValue('Add Work Package')).toBeInTheDocument();
      });

      // Button label placeholder should be present for cards without labels
      const labelInputs = screen.getAllByPlaceholderText('Button label...');
      expect(labelInputs.length).toBe(5); // one per card type
    });

    it('renders Movement Destinations section with space dropdowns', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        // TEST-SPACE-1 has space_1=TEST-SPACE-2
        expect(screen.getByDisplayValue('TEST-SPACE-2')).toBeInTheDocument();
      });
    });

    it('renders LOGIC movement builder when path is LOGIC', async () => {
      await selectSpace('TEST-LOGIC-SPACE');

      await waitFor(() => {
        // Verify the path dropdown shows LOGIC
        expect(screen.getByDisplayValue('LOGIC')).toBeInTheDocument();
      });

      // LOGIC builder should render Q/Y→/N→ labels for the LOGIC condition
      await waitFor(() => {
        expect(screen.getByText('Q')).toBeInTheDocument();
        expect(screen.getByText('Y→')).toBeInTheDocument();
        expect(screen.getByText('N→')).toBeInTheDocument();
      });
    });

    it('renders YOUR ACTIONS section with dice buttons when requires_dice_roll is Yes', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        // YOUR ACTIONS section should appear with dice + card actions
        expect(screen.getByText(/YOUR ACTIONS/)).toBeInTheDocument();
      });
    });

    it('edits Title field and marks unsaved', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Space One')).toBeInTheDocument();
      });

      const titleInput = screen.getByDisplayValue('Test Space One');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });

    it('edits end_turn_label field and marks unsaved', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Proceed')).toBeInTheDocument();
      });

      const labelInput = screen.getByDisplayValue('Proceed');
      fireEvent.change(labelInput, { target: { value: 'Continue' } });

      expect(screen.getByDisplayValue('Continue')).toBeInTheDocument();
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });

    it('edits try_again_label field and marks unsaved', async () => {
      await selectSpace('TEST-SPACE-2');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Renegotiate')).toBeInTheDocument();
      });

      const labelInput = screen.getByDisplayValue('Renegotiate');
      fireEvent.change(labelInput, { target: { value: 'Try Harder' } });

      expect(screen.getByDisplayValue('Try Harder')).toBeInTheDocument();
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });

    it('all fieldset sections are present', async () => {
      await selectSpace('TEST-SPACE-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test event 1')).toBeInTheDocument();
      });

      // All section legends (include emoji prefix in search to be specific)
      const legends = document.querySelectorAll('legend');
      const legendTexts = Array.from(legends).map(l => l.textContent);
      expect(legendTexts).toEqual(expect.arrayContaining([
        expect.stringContaining('Identity & Config'),
        expect.stringContaining('Button Labels'),
        expect.stringContaining('Story & Narrative'),
        expect.stringContaining('(C) Actions'),
        expect.stringContaining('Movement Destinations'),
      ]));
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
