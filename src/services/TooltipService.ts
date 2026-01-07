// src/services/TooltipService.ts

import { DataService } from './DataService';

export interface ActionTooltip {
  action_type: string;
  action_value: string;
  button_label: string;
  tooltip_why: string;
  tooltip_context: string;
}

/**
 * TooltipService provides tooltip text for action buttons
 * Loads from ACTION_TOOLTIPS.csv for easy content updates
 */
export class TooltipService {
  private tooltips: Map<string, ActionTooltip> = new Map();
  private loaded: boolean = false;

  constructor(private dataService?: DataService) {}

  /**
   * Load tooltips from CSV data
   */
  async loadTooltips(): Promise<void> {
    if (this.loaded) return;

    try {
      const response = await fetch('/data/CLEAN_FILES/ACTION_TOOLTIPS.csv');
      const csvText = await response.text();
      this.parseCSV(csvText);
      this.loaded = true;
      console.log(`TooltipService: Loaded ${this.tooltips.size} tooltips`);
    } catch (error) {
      console.error('TooltipService: Failed to load tooltips', error);
    }
  }

  /**
   * Parse CSV text into tooltip map
   */
  private parseCSV(csvText: string): void {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles basic cases)
      const values = this.parseCSVLine(line);
      if (values.length >= 5) {
        const tooltip: ActionTooltip = {
          action_type: values[0],
          action_value: values[1],
          button_label: values[2],
          tooltip_why: values[3],
          tooltip_context: values[4]
        };

        // Create lookup key: action_type + action_value
        const key = this.makeKey(tooltip.action_type, tooltip.action_value);
        this.tooltips.set(key, tooltip);
      }
    }
  }

  /**
   * Parse a single CSV line handling commas in values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  /**
   * Create a lookup key from action type and value
   */
  private makeKey(actionType: string, actionValue: string): string {
    return `${actionType}:${actionValue}`.toLowerCase();
  }

  /**
   * Get tooltip for a card action (draw, replace, return, give)
   */
  getCardTooltip(action: string, cardType: string): ActionTooltip | undefined {
    const key = this.makeKey('cards', `${action}_${cardType}`);
    return this.tooltips.get(key);
  }

  /**
   * Get tooltip for a dice action
   */
  getDiceTooltip(diceType: string): ActionTooltip | undefined {
    const key = this.makeKey('dice', `dice_outcome_${diceType.toLowerCase()}`);
    return this.tooltips.get(key);
  }

  /**
   * Get tooltip for a movement choice (destination space)
   */
  getMovementTooltip(spaceName: string): ActionTooltip | undefined {
    const key = this.makeKey('choice', spaceName);
    return this.tooltips.get(key);
  }

  /**
   * Get tooltip for movement actions (roll to move, end turn)
   */
  getMovementActionTooltip(action: string): ActionTooltip | undefined {
    const key = this.makeKey('movement', action);
    return this.tooltips.get(key);
  }

  /**
   * Get tooltip for negotiation
   */
  getNegotiationTooltip(): ActionTooltip | undefined {
    const key = this.makeKey('negotiation', 'negotiate');
    return this.tooltips.get(key);
  }

  /**
   * Get tooltip by direct key lookup
   */
  getTooltip(actionType: string, actionValue: string): ActionTooltip | undefined {
    const key = this.makeKey(actionType, actionValue);
    return this.tooltips.get(key);
  }

  /**
   * Get formatted tooltip text combining why and context
   */
  getTooltipText(actionType: string, actionValue: string): string {
    const tooltip = this.getTooltip(actionType, actionValue);
    if (!tooltip) return '';
    return tooltip.tooltip_why;
  }

  /**
   * Get full tooltip with context
   */
  getFullTooltipText(actionType: string, actionValue: string): string {
    const tooltip = this.getTooltip(actionType, actionValue);
    if (!tooltip) return '';
    return `${tooltip.tooltip_why}\n\n${tooltip.tooltip_context}`;
  }

  /**
   * Check if tooltips are loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance for global access
let tooltipServiceInstance: TooltipService | null = null;

export function getTooltipService(): TooltipService {
  if (!tooltipServiceInstance) {
    tooltipServiceInstance = new TooltipService();
  }
  return tooltipServiceInstance;
}

export function initializeTooltipService(dataService?: DataService): TooltipService {
  tooltipServiceInstance = new TooltipService(dataService);
  return tooltipServiceInstance;
}
