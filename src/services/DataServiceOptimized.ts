// src/services/DataServiceOptimized.ts

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
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

interface DataCache {
  gameConfigs?: GameConfig[];
  movements?: Movement[];
  diceOutcomes?: DiceOutcome[];
  spaceEffects?: SpaceEffect[];
  diceEffects?: DiceEffect[];
  spaceContents?: SpaceContent[];
  cards?: Card[];
  spaces?: Space[];
}

export class DataServiceOptimized implements IDataService {
  private cache: DataCache = {};
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  // Critical data that must be loaded immediately
  private criticalData = ['gameConfigs', 'movements', 'spaces'];

  // Non-critical data that can be loaded on-demand
  private deferredData = ['diceOutcomes', 'spaceEffects', 'diceEffects', 'spaceContents', 'cards'];

  constructor() {}

  async loadData(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.loaded) return;

    PerformanceMonitor.startMeasurement('data-service-load-critical');

    this.loadingPromise = (async () => {
      try {
        // Load only critical data immediately
        await Promise.all([
          this.loadGameConfig(),
          this.loadMovements()
        ]);

        // Build basic spaces from what we have
        this.buildBasicSpaces();

        PerformanceMonitor.endMeasurement('data-service-load-critical');

        // Start loading non-critical data in background
        this.loadDeferredDataInBackground();

        this.loaded = true;
      } catch (error) {
        console.error('Error loading critical CSV data:', error);
        this.loadingPromise = null;
        throw new Error('Failed to load game data');
      }
    })();

    return this.loadingPromise;
  }

  private loadDeferredDataInBackground(): void {
    // Load non-critical data without blocking the UI
    setTimeout(async () => {
      PerformanceMonitor.startMeasurement('data-service-load-deferred');

      try {
        await Promise.all([
          this.loadDiceOutcomes(),
          this.loadSpaceEffects(),
          this.loadDiceEffects(),
          this.loadSpaceContents(),
          this.loadCards()
        ]);

        // Rebuild spaces with full data
        this.buildSpaces();

        PerformanceMonitor.endMeasurement('data-service-load-deferred');
        console.log('✅ Background data loading completed');
      } catch (error) {
        console.error('Error loading deferred data:', error);
      }
    }, 0);
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  isFullyLoaded(): boolean {
    return this.loaded && this.cache.cards !== undefined;
  }

  // Configuration methods with lazy loading
  getGameConfig(): GameConfig[] {
    if (!this.cache.gameConfigs) {
      this.loadGameConfig();
      return [];
    }
    return [...this.cache.gameConfigs];
  }

  getGameConfigBySpace(spaceName: string): GameConfig | undefined {
    if (!this.cache.gameConfigs) {
      this.loadGameConfig();
      return undefined;
    }
    return this.cache.gameConfigs.find(config => config.space_name === spaceName);
  }

  getPhaseOrder(): string[] {
    const configs = this.getGameConfig();
    const phases: string[] = [];
    for (const config of configs) {
      if (config.phase && !phases.includes(config.phase)) {
        phases.push(config.phase);
      }
    }
    return phases;
  }

  // Space methods
  getAllSpaces(): Space[] {
    if (!this.cache.spaces) {
      return [];
    }
    return [...this.cache.spaces];
  }

  getSpaceByName(spaceName: string): Space | undefined {
    if (!this.cache.spaces) {
      return undefined;
    }
    return this.cache.spaces.find(space => space.name === spaceName);
  }

  // Movement methods
  getMovement(spaceName: string, visitType: VisitType): Movement | undefined {
    if (!this.cache.movements) {
      this.loadMovements();
      return undefined;
    }
    return this.cache.movements.find(
      movement => movement.space_name === spaceName && movement.visit_type === visitType
    );
  }

  getAllMovements(): Movement[] {
    if (!this.cache.movements) {
      this.loadMovements();
      return [];
    }
    return [...this.cache.movements];
  }

  // Card methods with lazy loading
  getAllCards(): Card[] {
    if (!this.cache.cards) {
      this.loadCards();
      return [];
    }
    return [...this.cache.cards];
  }

  getCardById(cardId: string): Card | undefined {
    if (!this.cache.cards) {
      this.loadCards();
      return undefined;
    }
    return this.cache.cards.find(card => card.card_id === cardId);
  }

  getCardsByType(cardType: CardType): Card[] {
    if (!this.cache.cards) {
      this.loadCards();
      return [];
    }
    return this.cache.cards.filter(card => card.card_type === cardType);
  }

  getCardsOfTypes(cardTypes: CardType[]): Card[] {
    if (!this.cache.cards) {
      this.loadCards();
      return [];
    }
    return this.cache.cards.filter(card => cardTypes.includes(card.card_type));
  }

  // Dice outcome methods
  getDiceOutcomes(): DiceOutcome[] {
    if (!this.cache.diceOutcomes) {
      this.loadDiceOutcomes();
      return [];
    }
    return [...this.cache.diceOutcomes];
  }

  getDiceOutcome(spaceName: string, diceValue: number): DiceOutcome | undefined {
    if (!this.cache.diceOutcomes) {
      this.loadDiceOutcomes();
      return undefined;
    }
    return this.cache.diceOutcomes.find(
      outcome => outcome.space_name === spaceName && outcome.dice_value === diceValue
    );
  }

  // Space effect methods
  getSpaceEffects(): SpaceEffect[] {
    if (!this.cache.spaceEffects) {
      this.loadSpaceEffects();
      return [];
    }
    return [...this.cache.spaceEffects];
  }

  getSpaceEffect(spaceName: string, visitType: VisitType): SpaceEffect | undefined {
    if (!this.cache.spaceEffects) {
      this.loadSpaceEffects();
      return undefined;
    }
    return this.cache.spaceEffects.find(
      effect => effect.space_name === spaceName && effect.visit_type === visitType
    );
  }

  // Dice effect methods
  getDiceEffects(): DiceEffect[] {
    if (!this.cache.diceEffects) {
      this.loadDiceEffects();
      return [];
    }
    return [...this.cache.diceEffects];
  }

  getDiceEffect(spaceName: string, diceValue: number): DiceEffect | undefined {
    if (!this.cache.diceEffects) {
      this.loadDiceEffects();
      return undefined;
    }
    return this.cache.diceEffects.find(
      effect => effect.space_name === spaceName && effect.dice_value === diceValue
    );
  }

  // Space content methods
  getSpaceContents(): SpaceContent[] {
    if (!this.cache.spaceContents) {
      this.loadSpaceContents();
      return [];
    }
    return [...this.cache.spaceContents];
  }

  getSpaceContent(spaceName: string): SpaceContent | undefined {
    if (!this.cache.spaceContents) {
      this.loadSpaceContents();
      return undefined;
    }
    return this.cache.spaceContents.find(content => content.space_name === spaceName);
  }

  // Private loading methods with caching
  private async loadGameConfig(): Promise<void> {
    const cacheKey = 'gameConfig';
    if (this.cache.gameConfigs || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv('/data/CLEAN_FILES/GAME_CONFIG.csv', this.parseGameConfigCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.gameConfigs = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async loadMovements(): Promise<void> {
    const cacheKey = 'movements';
    if (this.cache.movements || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv('/data/CLEAN_FILES/MOVEMENT.csv', this.parseMovementCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.movements = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async loadDiceOutcomes(): Promise<void> {
    const cacheKey = 'diceOutcomes';
    if (this.cache.diceOutcomes || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv('/data/CLEAN_FILES/DICE_OUTCOMES.csv', this.parseDiceOutcomesCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.diceOutcomes = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async loadSpaceEffects(): Promise<void> {
    const cacheKey = 'spaceEffects';
    if (this.cache.spaceEffects || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv('/data/CLEAN_FILES/SPACE_EFFECTS.csv', this.parseSpaceEffectsCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.spaceEffects = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async loadDiceEffects(): Promise<void> {
    const cacheKey = 'diceEffects';
    if (this.cache.diceEffects || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv('/data/CLEAN_FILES/DICE_EFFECTS.csv', this.parseDiceEffectsCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.diceEffects = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async loadSpaceContents(): Promise<void> {
    const cacheKey = 'spaceContents';
    if (this.cache.spaceContents || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv('/data/CLEAN_FILES/SPACE_CONTENT.csv', this.parseSpaceContentCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.spaceContents = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async loadCards(): Promise<void> {
    const cacheKey = 'cards';
    if (this.cache.cards || this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const promise = this.fetchAndParseCsv(`/data/CLEAN_FILES/CARDS_EXPANDED.csv?_=${Date.now()}`, this.parseCardsCsv.bind(this));
    this.loadingPromises.set(cacheKey, promise);

    this.cache.cards = await promise;
    this.loadingPromises.delete(cacheKey);
  }

  private async fetchAndParseCsv<T>(url: string, parser: (csvText: string) => T[]): Promise<T[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    return parser(csvText);
  }

  private buildBasicSpaces(): void {
    // Build minimal space data for immediate use
    if (!this.cache.gameConfigs || !this.cache.movements) return;

    const spaceNames = new Set<string>();
    this.cache.gameConfigs.forEach(config => spaceNames.add(config.space_name));
    this.cache.movements.forEach(movement => spaceNames.add(movement.space_name));

    this.cache.spaces = Array.from(spaceNames).map(name => ({
      name,
      gameConfig: this.cache.gameConfigs!.find(config => config.space_name === name),
      movements: this.cache.movements!.filter(movement => movement.space_name === name),
      spaceEffects: [], // Will be populated later
      diceOutcomes: [], // Will be populated later
      diceEffects: [], // Will be populated later
      spaceContent: undefined // Will be populated later
    }));
  }

  private buildSpaces(): void {
    // Build complete space data with all loaded information
    if (!this.cache.gameConfigs || !this.cache.movements) return;

    const spaceNames = new Set<string>();
    this.cache.gameConfigs.forEach(config => spaceNames.add(config.space_name));
    this.cache.movements.forEach(movement => spaceNames.add(movement.space_name));

    this.cache.spaces = Array.from(spaceNames).map(name => ({
      name,
      gameConfig: this.cache.gameConfigs!.find(config => config.space_name === name),
      movements: this.cache.movements!.filter(movement => movement.space_name === name),
      spaceEffects: this.cache.spaceEffects?.filter(effect => effect.space_name === name) || [],
      diceOutcomes: this.cache.diceOutcomes?.filter(outcome => outcome.space_name === name) || [],
      diceEffects: this.cache.diceEffects?.filter(effect => effect.space_name === name) || [],
      spaceContent: this.cache.spaceContents?.find(content => content.space_name === name)
    }));
  }

  // Include all the original parsing methods from DataService
  private parseGameConfigCsv(csvText: string): GameConfig[] {
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(',');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0] || '',
        phase: values[1] || '',
        cost: parseInt(values[2]) || 0,
        money_effect: parseInt(values[3]) || 0,
        time_effect: parseInt(values[4]) || 0,
        resource_type: values[5] || '',
        movement_type: values[6] || '',
        description: values[7] || '',
        effect_trigger: values[8] || '',
        prerequisites: values[9] || '',
        max_visits: parseInt(values[10]) || 0,
        is_starting_space: values[11]?.toLowerCase() === 'true',
        completion_bonus: parseInt(values[12]) || 0
      };
    });
  }

  private parseMovementCsv(csvText: string): Movement[] {
    const lines = csvText.trim().split('\n');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0] || '',
        visit_type: (values[1] as VisitType) || 'First',
        destination_1: values[2] || '',
        destination_2: values[3] || '',
        destination_3: values[4] || '',
        destination_4: values[5] || '',
        destination_5: values[6] || '',
        destination_6: values[7] || ''
      };
    });
  }

  private parseDiceOutcomesCsv(csvText: string): DiceOutcome[] {
    const lines = csvText.trim().split('\n');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0] || '',
        dice_value: parseInt(values[1]) || 1,
        outcome_description: values[2] || '',
        money_effect: parseInt(values[3]) || 0,
        time_effect: parseInt(values[4]) || 0,
        card_draw: values[5] || '',
        special_effect: values[6] || ''
      };
    });
  }

  private parseSpaceEffectsCsv(csvText: string): SpaceEffect[] {
    const lines = csvText.trim().split('\n');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0] || '',
        visit_type: (values[1] as VisitType) || 'First',
        effect_description: values[2] || '',
        money_effect: parseInt(values[3]) || 0,
        time_effect: parseInt(values[4]) || 0,
        card_draw: values[5] || '',
        requires_dice: values[6]?.toLowerCase() === 'true',
        special_conditions: values[7] || ''
      };
    });
  }

  private parseDiceEffectsCsv(csvText: string): DiceEffect[] {
    const lines = csvText.trim().split('\n');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0] || '',
        dice_value: parseInt(values[1]) || 1,
        effect_description: values[2] || '',
        money_effect: parseInt(values[3]) || 0,
        time_effect: parseInt(values[4]) || 0,
        card_effect: values[5] || '',
        movement_effect: values[6] || ''
      };
    });
  }

  private parseSpaceContentCsv(csvText: string): SpaceContent[] {
    const lines = csvText.trim().split('\n');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        space_name: values[0] || '',
        title: values[1] || '',
        story_text: values[2] || '',
        action_text: values[3] || '',
        outcome_text: values[4] || '',
        flavor_text: values[5] || ''
      };
    });
  }

  private parseCardsCsv(csvText: string): Card[] {
    const lines = csvText.trim().split('\n');

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      return {
        card_id: values[0] || '',
        card_name: values[1] || '',
        card_type: (values[2] as CardType) || 'W',
        description: values[3] || '',
        effects_on_play: values[4] || '',
        cost: parseInt(values[5]) || 0,
        phase_restriction: values[6] || '',
        duration: values[7] || '',
        duration_count: values[8] || '',
        turn_effect: values[9] || '',
        activation_timing: values[10] || '',
        loan_amount: parseInt(values[11]) || 0,
        loan_rate: parseFloat(values[12]) || 0,
        investment_amount: parseInt(values[13]) || 0,
        work_cost: parseInt(values[14]) || 0,
        money_effect: values[15] || '',
        tick_modifier: parseInt(values[16]) || 0,
        draw_cards: values[17] || '',
        discard_cards: values[18] || '',
        target: values[19] || '',
        scope: values[20] || '',
        work_type_restriction: values[21] || ''
      };
    });
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue);
    return values;
  }
}