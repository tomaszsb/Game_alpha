import { IDataService } from '../types/ServiceContracts';
import {
  GameConfig,
  Movement,
  DiceOutcome,
  SpaceEffect,
  DiceEffect,
  SpaceContent,
  Space,
  VisitType,
  Card,
  CardType
} from '../types/DataTypes';

export class DataService implements IDataService {
  private gameConfigs: GameConfig[] = [];
  private movements: Movement[] = [];
  private diceOutcomes: DiceOutcome[] = [];
  private spaceEffects: SpaceEffect[] = [];
  private diceEffects: DiceEffect[] = [];
  private spaceContents: SpaceContent[] = [];
  private cards: Card[] = [];
  private spaces: Space[] = [];
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {}

  async loadData(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.loaded) return;

    this.loadingPromise = (async () => {
      try {
        await Promise.all([
          this.loadGameConfig(),
          this.loadMovements(),
          this.loadDiceOutcomes(),
          this.loadSpaceEffects(),
          this.loadDiceEffects(),
          this.loadSpaceContents(),
          this.loadCards()
        ]);

        this.buildSpaces();
        this.loaded = true;
      } catch (error) {
        console.error('Error loading CSV data:', error);
        this.loadingPromise = null; // Reset on error so it can be retried
        throw new Error('Failed to load game data');
      }
    })();

    return this.loadingPromise;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // Configuration methods
  getGameConfig(): GameConfig[] {
    return [...this.gameConfigs];
  }

  getGameConfigBySpace(spaceName: string): GameConfig | undefined {
    return this.gameConfigs.find(config => config.space_name === spaceName);
  }

  getPhaseOrder(): string[] {
    const phases: string[] = [];
    for (const config of this.gameConfigs) {
      if (config.phase && !phases.includes(config.phase)) {
        phases.push(config.phase);
      }
    }
    return phases;
  }

  // Space methods
  getAllSpaces(): Space[] {
    return [...this.spaces];
  }

  getSpaceByName(spaceName: string): Space | undefined {
    return this.spaces.find(space => space.name === spaceName);
  }

  // Movement methods
  getMovement(spaceName: string, visitType: VisitType): Movement | undefined {
    return this.movements.find(
      movement => movement.space_name === spaceName && movement.visit_type === visitType
    );
  }

  getAllMovements(): Movement[] {
    return [...this.movements];
  }

  // Dice outcome methods
  getDiceOutcome(spaceName: string, visitType: VisitType): DiceOutcome | undefined {
    return this.diceOutcomes.find(
      outcome => outcome.space_name === spaceName && outcome.visit_type === visitType
    );
  }

  getAllDiceOutcomes(): DiceOutcome[] {
    return [...this.diceOutcomes];
  }

  // Space effects methods
  getSpaceEffects(spaceName: string, visitType: VisitType): SpaceEffect[] {
    return this.spaceEffects.filter(
      effect => effect.space_name === spaceName && effect.visit_type === visitType
    );
  }

  getAllSpaceEffects(): SpaceEffect[] {
    return [...this.spaceEffects];
  }

  // Dice effects methods
  getDiceEffects(spaceName: string, visitType: VisitType): DiceEffect[] {
    return this.diceEffects.filter(
      effect => effect.space_name === spaceName && effect.visit_type === visitType
    );
  }

  getAllDiceEffects(): DiceEffect[] {
    return [...this.diceEffects];
  }

  // Content methods
  getSpaceContent(spaceName: string, visitType: VisitType): SpaceContent | undefined {
    return this.spaceContents.find(
      content => content.space_name === spaceName && content.visit_type === visitType
    );
  }

  getAllSpaceContent(): SpaceContent[] {
    return [...this.spaceContents];
  }

  // Private CSV loading methods
  private async loadGameConfig(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/GAME_CONFIG.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch GAME_CONFIG.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.gameConfigs = this.parseGameConfigCsv(csvText);
  }

  private async loadMovements(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/MOVEMENT.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch MOVEMENT.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.movements = this.parseMovementCsv(csvText);
  }

  private async loadDiceOutcomes(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/DICE_OUTCOMES.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch DICE_OUTCOMES.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.diceOutcomes = this.parseDiceOutcomesCsv(csvText);
  }

  private async loadSpaceEffects(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/SPACE_EFFECTS.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch SPACE_EFFECTS.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.spaceEffects = this.parseSpaceEffectsCsv(csvText);
  }

  private async loadDiceEffects(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/DICE_EFFECTS.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch DICE_EFFECTS.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.diceEffects = this.parseDiceEffectsCsv(csvText);
  }

  private async loadSpaceContents(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/SPACE_CONTENT.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch SPACE_CONTENT.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.spaceContents = this.parseSpaceContentCsv(csvText);
  }

  private async loadCards(): Promise<void> {
    const response = await fetch('/data/CLEAN_FILES/CARDS_EXPANDED.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch CARDS_EXPANDED.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.cards = this.parseCardsCsv(csvText);
  }

  // CSV parsing methods
  private parseGameConfigCsv(csvText: string): GameConfig[] {
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0],
        phase: values[1],
        path_type: values[2],
        is_starting_space: values[3] === 'Yes',
        is_ending_space: values[4] === 'Yes',
        min_players: parseInt(values[5]),
        max_players: parseInt(values[6]),
        requires_dice_roll: values[7] === 'Yes'
      };
    });
  }

  private parseMovementCsv(csvText: string): Movement[] {
    const lines = csvText.trim().split('\n');
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0],
        visit_type: values[1] as VisitType,
        movement_type: values[2] as 'fixed' | 'choice' | 'dice' | 'logic' | 'none',
        destination_1: values[3] || undefined,
        destination_2: values[4] || undefined,
        destination_3: values[5] || undefined,
        destination_4: values[6] || undefined,
        destination_5: values[7] || undefined,
        condition_1: values[8] || undefined,
        condition_2: values[9] || undefined,
        condition_3: values[10] || undefined,
        condition_4: values[11] || undefined,
        condition_5: values[12] || undefined
      };
    });
  }

  private parseDiceOutcomesCsv(csvText: string): DiceOutcome[] {
    const lines = csvText.trim().split('\n');
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0],
        visit_type: values[1] as VisitType,
        roll_1: values[2] || undefined,
        roll_2: values[3] || undefined,
        roll_3: values[4] || undefined,
        roll_4: values[5] || undefined,
        roll_5: values[6] || undefined,
        roll_6: values[7] || undefined
      };
    });
  }

  private parseSpaceEffectsCsv(csvText: string): SpaceEffect[] {
    const lines = csvText.trim().split('\n');
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      const spaceEffect: SpaceEffect = {
        space_name: values[0],
        visit_type: values[1] as VisitType,
        effect_type: values[2] as SpaceEffect['effect_type'],
        effect_action: values[3],
        effect_value: isNaN(Number(values[4])) ? values[4] : Number(values[4]),
        condition: values[5],
        description: values[6]
      };
      
      // Add trigger_type if it exists and is not empty
      if (values[7] && values[7].trim()) {
        spaceEffect.trigger_type = values[7].trim() as 'manual' | 'auto';
      }

      return spaceEffect;
    });
  }

  private parseDiceEffectsCsv(csvText: string): DiceEffect[] {
    const lines = csvText.trim().split('\n');
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0],
        visit_type: values[1] as VisitType,
        effect_type: values[2],
        card_type: values[3] || undefined,
        roll_1: values[4] || undefined,
        roll_2: values[5] || undefined,
        roll_3: values[6] || undefined,
        roll_4: values[7] || undefined,
        roll_5: values[8] || undefined,
        roll_6: values[9] || undefined
      };
    });
  }

  private parseSpaceContentCsv(csvText: string): SpaceContent[] {
    const lines = csvText.trim().split('\n');
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0],
        visit_type: values[1] as VisitType,
        title: values[2],
        story: values[3],
        action_description: values[4],
        outcome_description: values[5],
        can_negotiate: values[6].toUpperCase() === 'YES'
      };
    });
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private parseCardsCsv(csvText: string): Card[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CARDS_EXPANDED.csv must have at least a header row and one data row');
    }
    
    const header = this.parseCsvLine(lines[0]);
    const expectedColumns = [
      'card_id', 'card_name', 'card_type', 'description', 'effects_on_play', 'cost', 'phase_restriction',
      'duration', 'duration_count', 'turn_effect', 'activation_timing',
      'loan_amount', 'loan_rate', 'investment_amount', 'work_cost',
      'money_effect', 'tick_modifier',
      'draw_cards', 'discard_cards', 'target', 'scope', 'work_type_restriction'
    ];
    
    if (header.length !== expectedColumns.length) {
      throw new Error(`CARDS_EXPANDED.csv header must have exactly ${expectedColumns.length} columns. Found: ${header.length}`);
    }
    
    return lines.slice(1).map((line, index) => {
      const values = this.parseCsvLine(line);
      
      if (values.length !== expectedColumns.length) {
        throw new Error(`CARDS_EXPANDED.csv row ${index + 2} must have exactly ${expectedColumns.length} columns. Found: ${values.length}`);
      }
      
      const cardType = values[2] as CardType;
      if (!['W', 'B', 'E', 'L', 'I'].includes(cardType)) {
        throw new Error(`Invalid card_type '${cardType}' in CARDS_EXPANDED.csv row ${index + 2}. Must be one of: W, B, E, L, I`);
      }
      
      const cost = values[5] ? parseInt(values[5]) : undefined;
      if (values[5] && (isNaN(cost!) || cost! < 0)) {
        throw new Error(`Invalid cost '${values[5]}' in CARDS_EXPANDED.csv row ${index + 2}. Must be a non-negative number or empty`);
      }
      
      return {
        card_id: values[0],
        card_name: values[1],
        card_type: cardType,
        description: values[3],
        effects_on_play: values[4] || undefined,
        cost: cost,
        phase_restriction: values[6] || undefined,
        work_type_restriction: values[21] || undefined,  // Work type from code2026
        
        // Expanded mechanics
        duration: values[7] || undefined,
        duration_count: values[8] || undefined,
        turn_effect: values[9] || undefined,
        activation_timing: values[10] || undefined,
        
        // Financial mechanics
        loan_amount: values[11] || undefined,
        loan_rate: values[12] || undefined,
        investment_amount: values[13] || undefined,
        work_cost: values[14] || undefined,
        
        // Effect mechanics
        money_effect: values[15] || undefined,
        tick_modifier: values[16] || undefined,
        
        // Card interaction mechanics
        draw_cards: values[17] || undefined,
        discard_cards: values[18] || undefined,
        target: values[19] || undefined,
        scope: values[20] || undefined
      };
    });
  }

  private buildSpaces(): void {
    const spaceNames = [...new Set(this.gameConfigs.map(config => config.space_name))];
    
    this.spaces = spaceNames.map(spaceName => {
      const config = this.getGameConfigBySpace(spaceName)!;
      const content = this.spaceContents.filter(c => c.space_name === spaceName);
      const movement = this.movements.filter(m => m.space_name === spaceName);
      const spaceEffects = this.spaceEffects.filter(e => e.space_name === spaceName);
      const diceEffects = this.diceEffects.filter(e => e.space_name === spaceName);
      const diceOutcomes = this.diceOutcomes.filter(o => o.space_name === spaceName);
      
      return {
        name: spaceName,
        config,
        content,
        movement,
        spaceEffects,
        diceEffects,
        diceOutcomes
      };
    });
  }

  // Card management methods
  getCards(): Card[] {
    return [...this.cards];
  }

  getCardById(cardId: string): Card | undefined {
    return this.cards.find(card => card.card_id === cardId);
  }

  getCardsByType(cardType: CardType): Card[] {
    return this.cards.filter(card => card.card_type === cardType);
  }

  getAllCardTypes(): CardType[] {
    const types = new Set(this.cards.map(card => card.card_type));
    return Array.from(types) as CardType[];
  }
}