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
  CardType,
  ModalConfigOverrides,
  LogicQuestion
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
  // Yes/no decision chains for path=LOGIC spaces. Keyed lookups go through
  // getLogicQuestion()/getLogicQuestionEntry(); do not read this array directly.
  private logicQuestions: LogicQuestion[] = [];
  // key: `${spaceName}|${visitType}|${effectAction}|${diceValue}` → overrides.
  // `diceValue` is empty string for generic rows (Phase 1-3b) and '1'..'6' for
  // dice-specific rows (Phase 4).
  private modalConfigs: Map<string, ModalConfigOverrides> = new Map();
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
          this.loadCards(),
          this.loadModalConfigs(),
          this.loadLogicQuestions()
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

  /**
   * Workstream 6 #1: data-driven starting-space lookup.
   * Returns true if the named space is flagged `is_starting_space=Yes` in Spaces.csv.
   * Replaces hardcoded `=== 'OWNER-SCOPE-INITIATION'` checks so educator-added
   * starting spaces (any name) work without engine changes.
   */
  isStartingSpace(spaceName: string): boolean {
    return this.getGameConfigBySpace(spaceName)?.is_starting_space === true;
  }

  /**
   * Workstream 6 #5: data-driven resume-hub lookup.
   * Returns true if the named space is flagged `is_resume_hub=Yes` in Spaces.csv.
   * A resume hub stores the `mainPathResumePoint` when arrived-at from a main-path
   * space, and offers those resume destinations when arrived-at later (after side
   * quest). Replaces hardcoded `=== 'PM-DECISION-CHECK'` checks in MovementService.
   */
  isResumeHub(spaceName: string): boolean {
    return this.getGameConfigBySpace(spaceName)?.is_resume_hub === true;
  }

  /**
   * Workstream 6 #6: data-driven point-of-no-return lookup.
   * Returns true if the named space is flagged `is_point_of_no_return=Yes` in
   * Spaces.csv. Arriving here clears any stored `mainPathResumePoint` and
   * permanently disables future resume-from-side-quest behavior (sets
   * `hasUsedCheatBypass`). Replaces hardcoded `=== 'CHEAT-BYPASS'` checks.
   */
  isPointOfNoReturn(spaceName: string): boolean {
    return this.getGameConfigBySpace(spaceName)?.is_point_of_no_return === true;
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

  getEffectNarrative(spaceName: string, visitType: VisitType, effectAction: string): string | undefined {
    const effect = this.spaceEffects.find(
      e => e.space_name === spaceName && e.visit_type === visitType && e.effect_action === effectAction
    );
    return effect?.narrative || undefined;
  }

  /**
   * Look up a specific question in a logic-tree space's chain.
   * Returns undefined if the space has no chain or the question_id is missing.
   */
  getLogicQuestion(
    spaceName: string,
    visitType: VisitType,
    questionId: string
  ): LogicQuestion | undefined {
    return this.logicQuestions.find(
      q => q.space_name === spaceName && q.visit_type === visitType && q.question_id === questionId
    );
  }

  /**
   * Return the first question in a logic-tree space's chain (question_id === 'Q1').
   * Callers can use this to bootstrap the yes/no walk without hardcoding 'Q1'.
   */
  getLogicQuestionEntry(
    spaceName: string,
    visitType: VisitType
  ): LogicQuestion | undefined {
    return this.getLogicQuestion(spaceName, visitType, 'Q1');
  }

  /**
   * Return all questions in a logic-tree space's chain (ordered by question_id).
   * Used by the question-chain walker to compute total-step count for the
   * "Question 2 of 5" progress display.
   */
  getLogicQuestionsForSpace(
    spaceName: string,
    visitType: VisitType
  ): LogicQuestion[] {
    return this.logicQuestions
      .filter(q => q.space_name === spaceName && q.visit_type === visitType)
      .sort((a, b) => a.question_id.localeCompare(b.question_id, undefined, { numeric: true }));
  }

  getAllLogicQuestions(): LogicQuestion[] {
    return [...this.logicQuestions];
  }

  /**
   * Look up modal overrides for a given space/visit/action, optionally filtered
   * by a specific dice value. Returns undefined if no row is configured or if
   * all override fields are empty.
   *
   * Precedence when `diceValue` is provided: dice-specific row (matching value)
   * wins, falling back to the generic row (no dice_value) if present. When
   * `diceValue` is omitted, only the generic row is considered.
   */
  getModalConfig(
    spaceName: string,
    visitType: VisitType,
    effectAction: string,
    diceValue?: number
  ): ModalConfigOverrides | undefined {
    const pickNonEmpty = (cfg: ModalConfigOverrides | undefined): ModalConfigOverrides | undefined => {
      if (!cfg) return undefined;
      if (!cfg.modal_title && !cfg.modal_description && !cfg.modal_button_label && !cfg.modal_summary) {
        return undefined;
      }
      return cfg;
    };

    if (diceValue !== undefined) {
      const specific = pickNonEmpty(
        this.modalConfigs.get(`${spaceName}|${visitType}|${effectAction}|${diceValue}`)
      );
      if (specific) return specific;
    }
    return pickNonEmpty(
      this.modalConfigs.get(`${spaceName}|${visitType}|${effectAction}|`)
    );
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

  /**
   * Load the yes/no question chains for path=LOGIC spaces. Optional file —
   * a missing file simply leaves the array empty, which degrades logic spaces
   * to "no destination" at runtime rather than crashing boot.
   */
  private async loadLogicQuestions(): Promise<void> {
    try {
      const response = await fetch('/data/CLEAN_FILES/LOGIC_QUESTIONS.csv?_=' + Date.now());
      if (!response.ok) {
        this.logicQuestions = [];
        return;
      }
      const csvText = await response.text();
      this.logicQuestions = this.parseLogicQuestionsCsv(csvText);
    } catch {
      this.logicQuestions = [];
    }
  }

  /**
   * Load SOURCE_FILES/ModalConfig.csv directly. Treated as optional — a missing
   * or empty file simply leaves the modal override map empty so all modals fall
   * back to their defaults.
   */
  private async loadModalConfigs(): Promise<void> {
    try {
      const response = await fetch('/data/SOURCE_FILES/ModalConfig.csv?_=' + Date.now());
      if (!response.ok) {
        // Not fatal — file is optional
        this.modalConfigs = new Map();
        return;
      }
      const csvText = await response.text();
      this.modalConfigs = this.parseModalConfigCsv(csvText);
    } catch {
      this.modalConfigs = new Map();
    }
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
        requires_dice_roll: values[7] === 'Yes',
        // Workstream 6 #5+#6: resume-mechanic flags. Older CLEAN_FILES without
        // these columns produce undefined → falsy at the use site.
        is_resume_hub: values[8] === 'Yes',
        is_point_of_no_return: values[9] === 'Yes'
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

      // Add fee_type if it exists (column 8)
      if (values[8] && values[8].trim()) {
        spaceEffect.fee_type = values[8].trim() as 'LOAN_PERCENTAGE' | 'FIXED' | 'DICE_BASED';
      }

      // Add narrative if it exists (column 9)
      if (values[9] && values[9].trim()) {
        spaceEffect.narrative = values[9].trim();
      }

      // Add modal config fields (columns 10-13)
      if (values[10] && values[10].trim()) spaceEffect.modal_title = values[10].trim();
      if (values[11] && values[11].trim()) spaceEffect.modal_description = values[11].trim();
      if (values[12] && values[12].trim()) spaceEffect.modal_button_label = values[12].trim();
      if (values[13] && values[13].trim()) spaceEffect.modal_summary = values[13].trim();

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
        roll_6: values[9] || undefined,
        roll_group: values[10] || undefined,
        roll_action: values[11] || undefined,
        roll_is_percentage: values[12] === 'true',
        roll_numeric_only: values[13] === 'true'
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
        can_negotiate: values[6].toUpperCase() === 'YES',
        end_turn_label: values[7] || 'End Turn',
        try_again_label: values[8] || 'Try Again',
        shake_on: values[9] || '',
        tts_field: values[10] || ''
      };
    });
  }

  /**
   * Parse SOURCE_FILES/ModalConfig.csv into a lookup map keyed by
   * `${space_name}|${visit_type}|${effect_action}|${dice_value}`. Header row is
   * `space_name,visit_type,effect_action,modal_title,modal_description,modal_button_label,modal_summary,dice_value`.
   *
   * `dice_value` (Phase 4) is optional: empty column means the row applies to
   * any dice outcome (generic), while '1'..'6' scopes it to that specific roll.
   */
  /**
   * Parse LOGIC_QUESTIONS.csv. Schema:
   *   space_name,visit_type,question_id,question_text,yes_target,no_target
   *
   * `yes_target` / `no_target` may contain:
   *   - another question_id (e.g. "Q2") → chain continues
   *   - a valid space_name → chain resolves to that move
   *   - a comma-separated list of space_names → downstream sub-choice
   * Parser treats them as opaque strings; MovementService resolves at walk time.
   */
  private parseLogicQuestionsCsv(csvText: string): LogicQuestion[] {
    if (!csvText) return [];
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const result: LogicQuestion[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const spaceName = (values[0] || '').trim();
      if (!spaceName) continue; // skip blanks/trailing rows
      result.push({
        space_name: spaceName,
        visit_type: (values[1] as VisitType) || 'First',
        question_id: (values[2] || '').trim(),
        question_text: (values[3] || '').trim(),
        yes_target: (values[4] || '').trim(),
        no_target: (values[5] || '').trim(),
      });
    }
    return result;
  }

  private parseModalConfigCsv(csvText: string): Map<string, ModalConfigOverrides> {
    const map = new Map<string, ModalConfigOverrides>();
    if (!csvText) return map;
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return map;
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      const spaceName = (cols[0] || '').trim();
      const visitType = (cols[1] || '').trim();
      const effectAction = (cols[2] || '').trim();
      if (!spaceName || !effectAction) continue;
      const diceValue = (cols[7] || '').trim(); // Phase 4: optional filter
      const overrides: ModalConfigOverrides = {
        modal_title: (cols[3] || '').trim() || undefined,
        modal_description: (cols[4] || '').trim() || undefined,
        modal_button_label: (cols[5] || '').trim() || undefined,
        modal_summary: (cols[6] || '').trim() || undefined,
      };
      map.set(`${spaceName}|${visitType}|${effectAction}|${diceValue}`, overrides);
    }
    return map;
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
      'draw_cards', 'discard_cards', 'target', 'scope', 'work_type_restriction',
      'card_mechanic', 'dice_range_1_min', 'dice_range_1_max', 'dice_range_1_time',
      'dice_range_2_min', 'dice_range_2_max', 'dice_range_2_time', 'investor_payout'
    ];

    if (header.length < 22) {
      throw new Error(`CARDS_EXPANDED.csv header must have at least 22 columns. Found: ${header.length}`);
    }
    
    return lines.slice(1).map((line, index) => {
      const values = this.parseCsvLine(line);
      
      if (values.length < 22) {
        throw new Error(`CARDS_EXPANDED.csv row ${index + 2} must have at least 22 columns. Found: ${values.length}`);
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
        scope: values[20] || undefined,

        // Structured effect columns (optional, for eliminating text parsing)
        card_mechanic: (values[22] === 'choice' || values[22] === 'dice_conditional') ? values[22] as Card['card_mechanic'] : undefined,
        dice_range_1_min: values[23] ? parseInt(values[23]) : undefined,
        dice_range_1_max: values[24] ? parseInt(values[24]) : undefined,
        dice_range_1_time: values[25] ? parseInt(values[25]) : undefined,
        dice_range_2_min: values[26] ? parseInt(values[26]) : undefined,
        dice_range_2_max: values[27] ? parseInt(values[27]) : undefined,
        dice_range_2_time: values[28] ? parseInt(values[28]) : undefined,
        investor_payout: values[29] ? parseInt(values[29]) : undefined,
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
        id: spaceName,
        name: spaceName,
        title: content[0]?.title || spaceName,
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