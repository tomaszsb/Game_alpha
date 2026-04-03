import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TooltipService, getTooltipService, initializeTooltipService } from '../../src/services/TooltipService';

// Mock CSV data for tooltips
const mockTooltipsCsv = `action_type,action_value,button_label,tooltip_why,tooltip_context
cards,draw_W,Draw W Cards,Your project scope is defined by Work cards.,Scope determines project value.
cards,draw_B,Draw B Cards,Banks provide quick funding at lower rates.,Bank loans are faster but capped.
cards,draw_E,Draw E Cards,Expeditors are your secret weapon.,E cards can be played strategically.
cards,replace_E,Replace E Card,Trading one expeditor for another.,Sometimes the E card you have does not fit.
cards,return_E,Return E Card,Returning an expeditor means losing that ability.,You may be forced to give up help.
dice,dice_outcome_W,Roll for W Cards,The dice determine how many scope items you receive.,Owner's initial vision varies.
dice,dice_outcome_fee,Roll for Design Fee,Design professionals charge based on complexity.,Architect fees range 8-12% initially.
movement,end_turn,End Turn,You have completed all required actions.,All mandatory effects have been resolved.
negotiation,negotiate,Negotiate,Unhappy with your outcome? Negotiate to try again.,Some spaces allow negotiation.
choice,ARCH-INITIATION,Go to Architect,Begin or continue architectural design phase.,Required before engineering.
choice,FINISH,Finish Project,Congratulations! Your project is complete.,All approvals obtained.`;

// Setup fetch mock
global.fetch = vi.fn();

describe('TooltipService', () => {
  let tooltipService: TooltipService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to return tooltip CSV
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('ACTION_TOOLTIPS.csv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockTooltipsCsv),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      });
    });
    tooltipService = new TooltipService();
  });

  describe('loadTooltips', () => {
    it('should load tooltips from CSV successfully', async () => {
      await tooltipService.loadTooltips();
      expect(tooltipService.isLoaded()).toBe(true);
    });

    it('should not reload tooltips if already loaded', async () => {
      await tooltipService.loadTooltips();
      await tooltipService.loadTooltips();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      await tooltipService.loadTooltips();
      expect(tooltipService.isLoaded()).toBe(false);
    });
  });

  describe('getTooltip', () => {
    beforeEach(async () => {
      await tooltipService.loadTooltips();
    });

    it('should return tooltip for card draw action', () => {
      const tooltip = tooltipService.getTooltip('cards', 'draw_W');
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('project scope');
      expect(tooltip?.button_label).toBe('Draw W Cards');
    });

    it('should return tooltip for dice outcome', () => {
      const tooltip = tooltipService.getTooltip('dice', 'dice_outcome_fee');
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('Design professionals');
    });

    it('should return tooltip for movement choice', () => {
      const tooltip = tooltipService.getTooltip('choice', 'ARCH-INITIATION');
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('architectural design');
    });

    it('should return undefined for non-existent tooltip', () => {
      const tooltip = tooltipService.getTooltip('unknown', 'action');
      expect(tooltip).toBeUndefined();
    });

    it('should be case-insensitive for lookups', () => {
      const tooltip1 = tooltipService.getTooltip('CARDS', 'DRAW_W');
      const tooltip2 = tooltipService.getTooltip('cards', 'draw_w');
      expect(tooltip1).toEqual(tooltip2);
    });
  });

  describe('getCardTooltip', () => {
    beforeEach(async () => {
      await tooltipService.loadTooltips();
    });

    it('should return tooltip for draw_E action', () => {
      const tooltip = tooltipService.getCardTooltip('draw', 'E');
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('Expeditors');
    });

    it('should return tooltip for replace_E action', () => {
      const tooltip = tooltipService.getCardTooltip('replace', 'E');
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('Trading');
    });
  });

  describe('getMovementTooltip', () => {
    beforeEach(async () => {
      await tooltipService.loadTooltips();
    });

    it('should return tooltip for destination space', () => {
      const tooltip = tooltipService.getMovementTooltip('FINISH');
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('complete');
    });
  });

  describe('getTooltipText', () => {
    beforeEach(async () => {
      await tooltipService.loadTooltips();
    });

    it('should return just the tooltip_why text', () => {
      const text = tooltipService.getTooltipText('movement', 'end_turn');
      expect(text).toContain('completed all required actions');
    });

    it('should return empty string for non-existent tooltip', () => {
      const text = tooltipService.getTooltipText('unknown', 'action');
      expect(text).toBe('');
    });
  });

  describe('getFullTooltipText', () => {
    beforeEach(async () => {
      await tooltipService.loadTooltips();
    });

    it('should return both why and context text', () => {
      const text = tooltipService.getFullTooltipText('negotiation', 'negotiate');
      expect(text).toContain('Unhappy with your outcome');
      expect(text).toContain('Some spaces allow');
    });
  });

  describe('getNegotiationTooltip', () => {
    beforeEach(async () => {
      await tooltipService.loadTooltips();
    });

    it('should return negotiate tooltip', () => {
      const tooltip = tooltipService.getNegotiationTooltip();
      expect(tooltip).toBeDefined();
      expect(tooltip?.tooltip_why).toContain('Negotiate');
    });
  });
});

describe('Singleton functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockTooltipsCsv),
    });
  });

  it('getTooltipService should return the same instance', () => {
    const service1 = getTooltipService();
    const service2 = getTooltipService();
    expect(service1).toBe(service2);
  });

  it('initializeTooltipService should create a new instance', () => {
    const service1 = getTooltipService();
    const service2 = initializeTooltipService();
    // After initialization, getTooltipService returns the new one
    const service3 = getTooltipService();
    expect(service2).toBe(service3);
  });
});
