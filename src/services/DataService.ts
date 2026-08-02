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
  LogicQuestion,
  PathChoiceRule,
  CardTypeLabel
} from '../types/DataTypes';
import { getDataBasePath } from '../utils/dataInstance';

export class DataService implements IDataService {
  private gameConfigs: GameConfig[] = [];
  // 2026-08-02: keyed lookups for the hottest DataService reads
  // (getGameConfigBySpace — called from ~20 other methods here alone —
  // getMovement, getCardById per hand-card in scope calc/condition
  // checks/action counting). All 3 kept in sync by rebuildLookupMaps(),
  // called from each backing array's own load method AND from
  // buildSpaces() (belt-and-suspenders — see that method's comment).
  // Confirmed no duplicate space_name / (space_name,visit_type) / card_id
  // rows in the respective CSVs, so this is a behavior-preserving swap.
  private gameConfigsBySpace: Map<string, GameConfig> = new Map();
  private movements: Movement[] = [];
  private movementsByKey: Map<string, Movement> = new Map();
  private diceOutcomes: DiceOutcome[] = [];
  private spaceEffects: SpaceEffect[] = [];
  private diceEffects: DiceEffect[] = [];
  private spaceContents: SpaceContent[] = [];
  private cards: Card[] = [];
  private cardsById: Map<string, Card> = new Map();
  private spaces: Space[] = [];
  // Yes/no decision chains for path=LOGIC spaces. Keyed lookups go through
  // getLogicQuestion()/getLogicQuestionEntry(); do not read this array directly.
  private logicQuestions: LogicQuestion[] = [];
  // key: `${spaceName}|${visitType}|${effectAction}|${diceValue}` → overrides.
  // `diceValue` is empty string for generic rows (Phase 1-3b) and '1'..'6' for
  // dice-specific rows (Phase 4).
  private modalConfigs: Map<string, ModalConfigOverrides> = new Map();
  // Workstream 6 #4: cross-space path-choice exclusion rules. Keyed lookups go
  // through getPathChoiceExclusions().
  private pathChoiceRules: PathChoiceRule[] = [];
  // 2026-07-16: CSV-portability lift — reskin hook for card-type display labels.
  private cardTypeLabels: CardTypeLabel[] = [];
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
          this.loadLogicQuestions(),
          this.loadPathChoiceRules(),
          this.loadCardTypeLabels()
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

  /**
   * Re-fetch GAME_CONFIG.csv only and re-parse. Used by the Board Layout
   * Editor: after a drag-save writes new pos_x/pos_y to disk, this lets
   * the next render pick them up without a full page reload and without
   * tripping `loadData()`'s once-only guard. The fetch URL already has
   * Date.now() cache-busting so the browser/proxy doesn't serve stale.
   */
  async reloadGameConfig(): Promise<void> {
    await this.loadGameConfig();
  }

  /**
   * Re-fetch every CSV slice and rebuild derived data. Bypasses the
   * once-only loadData() guard so editor saves reflect immediately without
   * a hard browser refresh. See ServiceContracts comment for context.
   *
   * Implementation mirrors loadData() but skips the loadingPromise/loaded
   * machinery — callers are expected to invoke this only after a successful
   * editor save, so they're explicit about wanting fresh data.
   */
  async reloadAllData(): Promise<void> {
    await Promise.all([
      this.loadGameConfig(),
      this.loadMovements(),
      this.loadDiceOutcomes(),
      this.loadSpaceEffects(),
      this.loadDiceEffects(),
      this.loadSpaceContents(),
      this.loadCards(),
      this.loadModalConfigs(),
      this.loadLogicQuestions(),
      this.loadPathChoiceRules(),
      this.loadCardTypeLabels()
    ]);
    this.buildSpaces();
  }

  // Configuration methods
  getGameConfig(): GameConfig[] {
    return [...this.gameConfigs];
  }

  getGameConfigBySpace(spaceName: string): GameConfig | undefined {
    return this.gameConfigsBySpace.get(spaceName);
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
   * 2026-06-02: data-driven Stage-1 approval gate lookup (Workstream 7 Phase 7.4).
   * Returns true if the named space is flagged `has_final_review_gate=Yes` in
   * Spaces.csv. Gate spaces get ApprovalService.checkFinalReviewGate() run inside
   * MovementService.getValidMoves, which collapses valid moves to [routeTo] when
   * the player lacks the required approvals. Replaces hardcoded
   * `=== DOB_FINAL_REVIEW_SPACE` in MovementService.
   */
  hasFinalReviewGate(spaceName: string): boolean {
    return this.getGameConfigBySpace(spaceName)?.has_final_review_gate === true;
  }

  /**
   * 2026-07-16: CSV-portability lift. Returns the space_name flagged
   * `approval_role=<role>` in Spaces.csv, or null if no space claims that
   * role. A reskin CSV can move the DOB/FDNY exam and audit roles to
   * differently-named spaces this way; ApprovalService.configureApprovalSpaces
   * reads this at app startup. Replaces hardcoded `DOB_EXAM_SPACE`/
   * `FDNY_EXAM_SPACE`/`DOB_AUDIT_SPACE` literals in ApprovalService.
   */
  getSpaceForApprovalRole(role: 'dob_exam' | 'fdny_exam' | 'dob_audit'): string | null {
    return this.gameConfigs.find(config => config.approval_role === role)?.space_name ?? null;
  }

  /**
   * 2026-07-16: CSV-portability lift. Every space with a non-empty
   * `npc_speaker` in Spaces.csv, as (spaceName, npcSpeaker) pairs.
   * characters.ts's `configureNpcSpeakers` reads this at app startup to
   * override its hardcoded PM_VOICED_SPACES / prefix-heuristic defaults.
   */
  getNpcSpeakerAssignments(): Array<{ spaceName: string; npcSpeaker: string }> {
    return this.gameConfigs
      .filter(config => !!config.npc_speaker)
      .map(config => ({ spaceName: config.space_name, npcSpeaker: config.npc_speaker! }));
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

  /**
   * Workstream 6 #2: minimum W cards required to leave a space.
   * Returns the configured threshold from Spaces.csv (0 = no guard).
   * Replaces the hardcoded `=== 'OWNER-SCOPE-INITIATION'` scope-zero guard
   * in TurnService so educators can add similar guards on other spaces.
   */
  getMinWCardsToLeave(spaceName: string): number {
    return this.getGameConfigBySpace(spaceName)?.min_w_cards_to_leave ?? 0;
  }

  /**
   * Workstream 6 #7: design fee calculation method for a space.
   * 'percentage_of_scope' = fee is a % of the player's W-card project scope
   * (was hardcoded for ARCH-FEE-REVIEW + ENG-FEE-REVIEW). Default 'flat'
   * means the fee is the literal amount (or % of player money for non-design effects).
   */
  getFeeCalculationMethod(spaceName: string): 'flat' | 'percentage_of_scope' {
    return this.getGameConfigBySpace(spaceName)?.fee_calculation_method ?? 'flat';
  }

  /**
   * Workstream 6 #7: human-readable fee label for a space ('Architect',
   * 'Engineer', etc.). Used in dice-roll button text + effect descriptions.
   * Empty string when no label is configured (callers fall back to a generic
   * 'Fee' label).
   */
  getFeeLabel(spaceName: string): string {
    return this.getGameConfigBySpace(spaceName)?.fee_label ?? '';
  }

  /**
   * Workstream 6 #3: should this space auto-apply funding on arrival?
   * Replaces hardcoded `=== 'OWNER-FUND-INITIATION'` checks in TurnService.
   * When true, TurnService.handleAutomaticFunding fires automatically and
   * any cards listed in auto_trigger_card_types are auto-drawn (their direct
   * money effects also get skipped to avoid double-counting).
   */
  shouldAutoApplyFunding(spaceName: string): boolean {
    return this.getGameConfigBySpace(spaceName)?.auto_apply_funding === true;
  }

  /**
   * Workstream 6 #3: which card letters this space auto-triggers.
   * Returns the parsed array (from comma-separated CSV column).
   * Used for both auto-draw on arrival AND skip-direct-money-effect (because
   * funding is calculated by handleAutomaticFunding instead).
   */
  getAutoTriggerCardTypes(spaceName: string): string[] {
    return this.getGameConfigBySpace(spaceName)?.auto_trigger_card_types ?? [];
  }

  /**
   * 2026-05-18 audit: returns 'owner' | 'bank' | 'investor' | '' for a space.
   * Backed by the `funding_source` column in Spaces.csv → GAME_CONFIG.csv.
   * Replaces hardcoded `=== 'OWNER-FUND-INITIATION'` / `['OWNER-FUND-INITIATION',
   * 'BANK-FUND-REVIEW', 'INVESTOR-FUND-REVIEW']` checks scattered across the
   * funding-card and notification surfaces.
   */
  getFundingSource(spaceName: string): 'owner' | 'bank' | 'investor' | '' {
    return this.getGameConfigBySpace(spaceName)?.funding_source ?? '';
  }

  /**
   * 2026-05-18 audit: convenience boolean over `getFundingSource`. True if
   * the space participates in the funding mechanic (any of owner/bank/investor).
   */
  isFundingSpace(spaceName: string): boolean {
    return this.getFundingSource(spaceName) !== '';
  }

  /**
   * Workstream 6 #4: opaque key into player.pathChoiceMemory for this space.
   * Empty string when the space doesn't participate in path-choice memory.
   * Both lock-point spaces (where the choice is stored) and downstream spaces
   * that filter on the choice can share a key.
   */
  getPathChoiceMemoryKey(spaceName: string): string {
    return this.getGameConfigBySpace(spaceName)?.path_choice_memory_key ?? '';
  }

  /**
   * Workstream 6 #4: true if this space stores its First-visit destination
   * under its path_choice_memory_key, and filters Subsequent-visit moves to
   * that stored value. Replaces the hardcoded `=== 'REG-DOB-TYPE-SELECT'` checks.
   */
  isPathChoiceLockPoint(spaceName: string): boolean {
    return this.getGameConfigBySpace(spaceName)?.is_path_choice_lock_point === true;
  }

  /**
   * Workstream 6 #4: cross-space exclusions. Looks up PATH_CHOICE_RULES rows
   * affecting `spaceName` and returns the destinations that should be removed
   * from the player's choices, given their stored memory.
   *
   * Replaces the hardcoded REG-FDNY-PLAN-EXAM filter that special-cased the
   * Plan Exam vs Prof Cert paths.
   */
  getPathChoiceExclusions(spaceName: string, memory: Record<string, string> | undefined): string[] {
    if (!memory) return [];
    const exclusions: string[] = [];
    for (const rule of this.pathChoiceRules) {
      if (rule.affected_space !== spaceName) continue;
      if (memory[rule.memory_key] === rule.chosen_value) {
        exclusions.push(rule.excluded_destination);
      }
    }
    return exclusions;
  }

  /**
   * Workstream 6 Phase 6.3: short display label override for the board UI.
   * Returns empty string when no override is configured — callers (e.g.
   * `shortName()` in boardLayout) fall back to their legacy hardcoded map.
   */
  getDisplayLabelOverride(spaceName: string): string {
    return this.getGameConfigBySpace(spaceName)?.display_label_override ?? '';
  }

  /**
   * Workstream 6 Phase 6.3: review-loop explanation when dice sends a player
   * back to a re-review space. Returns empty string when not configured —
   * `DiceRollProcessor.getReviewLoopExplanation` falls back to legacy logic.
   */
  getReviewLoopMessage(spaceName: string): string {
    return this.getGameConfigBySpace(spaceName)?.review_loop_message ?? '';
  }

  /**
   * Workstream 3: board coordinates for the Living Map. Returns null if
   * the space isn't found or has no coords. Callers should fall back to
   * a sensible default (e.g. 0,0) — but in practice every space should
   * have coords seeded by scripts/seed-board-positions.mjs.
   */
  getPosition(spaceName: string): { x: number; y: number } | null {
    const config = this.getGameConfigBySpace(spaceName);
    if (!config) return null;
    const x = config.pos_x ?? 0;
    const y = config.pos_y ?? 0;
    return { x, y };
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
    return this.movementsByKey.get(`${spaceName}|${visitType}`);
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

  // Keeps the 3 keyed lookup Maps (gameConfigsBySpace/movementsByKey/
  // cardsById) in sync with their backing arrays. Called from each array's
  // own load method (covers the real fetch path + reloadGameConfig()'s
  // narrower single-table reload) AND from buildSpaces() (covers test
  // helpers across ~16 test files that populate the arrays directly via
  // `(this as any).gameConfigs = …` and call buildSpaces() without going
  // through the load methods at all — found 2026-08-02 when the first cut
  // of this change, rebuilding only inside the load methods, left those
  // tests' Maps empty).
  private rebuildLookupMaps(): void {
    this.gameConfigsBySpace = new Map(this.gameConfigs.map(config => [config.space_name, config]));
    this.movementsByKey = new Map(this.movements.map(m => [`${m.space_name}|${m.visit_type}`, m]));
    this.cardsById = new Map(this.cards.map(card => [card.card_id, card]));
  }

  // Private CSV loading methods
  private async loadGameConfig(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/GAME_CONFIG.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch GAME_CONFIG.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.gameConfigs = this.parseGameConfigCsv(csvText);
    this.rebuildLookupMaps();
  }

  private async loadMovements(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/MOVEMENT.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch MOVEMENT.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.movements = this.parseMovementCsv(csvText);
    this.rebuildLookupMaps();
  }

  private async loadDiceOutcomes(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/DICE_OUTCOMES.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch DICE_OUTCOMES.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.diceOutcomes = this.parseDiceOutcomesCsv(csvText);
  }

  private async loadSpaceEffects(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/SPACE_EFFECTS.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch SPACE_EFFECTS.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.spaceEffects = this.parseSpaceEffectsCsv(csvText);
  }

  private async loadDiceEffects(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/DICE_EFFECTS.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch DICE_EFFECTS.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.diceEffects = this.parseDiceEffectsCsv(csvText);
    this.validateDiceEffectGroups(this.diceEffects);
  }

  /**
   * Warn loudly when rows that share a (space, visit_type, roll_group) bucket
   * have different sets of populated roll columns. Rows in the same bucket
   * share a single dice roll (TurnService.processDiceRollEffects), so if e.g.
   * the time row has roll_1..roll_6 populated but the money row only has
   * roll_1..roll_5, rolling a 6 silently does nothing for money. The Cheat
   * Bypass time+money+destination triplet is the motivating case.
   *
   * Non-fatal — surfaces in the console so an editor can fix the CSV on the
   * next save, but doesn't block the app from loading.
   */
  private validateDiceEffectGroups(effects: DiceEffect[]): void {
    const buckets = new Map<string, DiceEffect[]>();
    for (const e of effects) {
      const key = `${e.space_name}|${e.visit_type}|${e.roll_group ?? ''}`;
      const list = buckets.get(key) ?? [];
      list.push(e);
      buckets.set(key, list);
    }

    const populatedRolls = (e: DiceEffect): string => {
      const flags = [e.roll_1, e.roll_2, e.roll_3, e.roll_4, e.roll_5, e.roll_6]
        .map(v => (v && String(v).trim() ? '1' : '0'))
        .join('');
      return flags;
    };

    for (const [key, list] of buckets) {
      if (list.length < 2) continue; // singletons can't desync
      const first = populatedRolls(list[0]);
      const mismatched = list.filter(e => populatedRolls(e) !== first);
      if (mismatched.length > 0) {
        const types = list.map(e => `${e.effect_type}:${populatedRolls(e)}`).join(', ');
        console.warn(
          `[DICE_EFFECTS validation] Rows sharing ${key} have inconsistent roll columns — ` +
          `they all use the SAME dice roll, so missing values silently do nothing. Rows: ${types}`
        );
      }
    }
  }

  private async loadSpaceContents(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/SPACE_CONTENT.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch SPACE_CONTENT.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.spaceContents = this.parseSpaceContentCsv(csvText);
  }

  private async loadCards(): Promise<void> {
    const response = await fetch(getDataBasePath() + '/CLEAN_FILES/CARDS_EXPANDED.csv?_=' + Date.now()); // Cache busting
    if (!response.ok) {
      throw new Error(`Failed to fetch CARDS_EXPANDED.csv: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    this.cards = this.parseCardsCsv(csvText);
    this.rebuildLookupMaps();
  }

  /**
   * Load the yes/no question chains for path=LOGIC spaces. Optional file —
   * a missing file simply leaves the array empty, which degrades logic spaces
   * to "no destination" at runtime rather than crashing boot.
   */
  private async loadLogicQuestions(): Promise<void> {
    try {
      const response = await fetch(getDataBasePath() + '/CLEAN_FILES/LOGIC_QUESTIONS.csv?_=' + Date.now());
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
   * Workstream 6 #4: load PATH_CHOICE_RULES.csv. Optional — a missing file
   * simply leaves the array empty (no cross-space exclusions, equivalent to
   * the pre-Workstream-6 behavior for any non-DOB space).
   */
  private async loadPathChoiceRules(): Promise<void> {
    try {
      const response = await fetch(getDataBasePath() + '/CLEAN_FILES/PATH_CHOICE_RULES.csv?_=' + Date.now());
      if (!response.ok) {
        this.pathChoiceRules = [];
        return;
      }
      const csvText = await response.text();
      this.pathChoiceRules = this.parsePathChoiceRulesCsv(csvText);
    } catch {
      this.pathChoiceRules = [];
    }
  }

  /**
   * 2026-07-16: CSV-portability lift — load CARD_TYPES.csv. Optional — a
   * missing file simply leaves the array empty, and cardTypeNames.ts falls
   * back to its hardcoded theme.ts label defaults.
   */
  private async loadCardTypeLabels(): Promise<void> {
    try {
      const response = await fetch(getDataBasePath() + '/CLEAN_FILES/CARD_TYPES.csv?_=' + Date.now());
      if (!response.ok) {
        this.cardTypeLabels = [];
        return;
      }
      const csvText = await response.text();
      this.cardTypeLabels = this.parseCardTypeLabelsCsv(csvText);
    } catch {
      this.cardTypeLabels = [];
    }
  }

  private parseCardTypeLabelsCsv(csvText: string): CardTypeLabel[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    return lines.slice(1)
      .map(line => {
        const values = this.parseCsvLine(line);
        return {
          card_type: (values[0] || '').trim(),
          label: (values[1] || '').trim()
        };
      })
      .filter(r => r.card_type && r.label);
  }

  /**
   * 2026-07-16: CSV-portability lift. Every card-type label defined in
   * CARD_TYPES.csv. cardTypeNames.ts's `configureCardTypeLabels` reads this
   * at app startup to override its hardcoded theme.ts defaults.
   */
  getCardTypeLabels(): CardTypeLabel[] {
    return [...this.cardTypeLabels];
  }

  private parsePathChoiceRulesCsv(csvText: string): PathChoiceRule[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    return lines.slice(1)
      .map(line => {
        const values = this.parseCsvLine(line);
        return {
          affected_space: (values[0] || '').trim(),
          memory_key: (values[1] || '').trim(),
          chosen_value: (values[2] || '').trim(),
          excluded_destination: (values[3] || '').trim()
        };
      })
      .filter(r => r.affected_space && r.memory_key && r.chosen_value && r.excluded_destination);
  }

  /**
   * Load SOURCE_FILES/ModalConfig.csv directly. Treated as optional — a missing
   * or empty file simply leaves the modal override map empty so all modals fall
   * back to their defaults.
   */
  private async loadModalConfigs(): Promise<void> {
    try {
      const response = await fetch(getDataBasePath() + '/SOURCE_FILES/ModalConfig.csv?_=' + Date.now());
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

    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      // Workstream 6 #2: parse min_w_cards_to_leave (numeric, default 0).
      const parsedMinW = parseInt(values[10], 10);
      const minWCardsToLeave = Number.isFinite(parsedMinW) && parsedMinW >= 0 ? parsedMinW : 0;
      // Workstream 6 #7: parse fee_calculation_method (only 'percentage_of_scope'
      // takes effect; everything else falls back to 'flat').
      const feeCalculationMethod: 'flat' | 'percentage_of_scope' =
        values[11] === 'percentage_of_scope' ? 'percentage_of_scope' : 'flat';
      const feeLabel = values[12] || '';
      // Workstream 6 #3: parse auto-handling flags. auto_trigger_card_types is
      // a comma-separated string in CSV → string[] in memory.
      const autoApplyFunding = values[13] === 'Yes';
      const autoTriggerCardTypes = (values[14] || '').split(',').map(s => s.trim()).filter(Boolean);
      // Workstream 6 #4: parse path-choice memory flags.
      const pathChoiceMemoryKey = values[15] || '';
      const isPathChoiceLockPoint = values[16] === 'Yes';
      // Workstream 6 Phase 6.3: cosmetic per-space overrides. Empty string when
      // missing — callers fall back to existing hardcoded behavior.
      const displayLabelOverride = values[17] || '';
      const reviewLoopMessage = values[18] || '';
      // Workstream 3: Living Map coordinates. Default to 0 if missing/blank
      // so the parsing never produces NaN (which would break BoardCanvas).
      const posX = parseFloat(values[19]);
      const posY = parseFloat(values[20]);
      // 2026-05-18 audit: funding_source enum ('owner'/'bank'/'investor' or '').
      const rawFundingSource = (values[21] ?? '').trim();
      const fundingSource: 'owner' | 'bank' | 'investor' | '' =
        rawFundingSource === 'owner' || rawFundingSource === 'bank' || rawFundingSource === 'investor'
          ? rawFundingSource
          : '';
      // 2026-06-02: Workstream 7 Phase 7.4 — Stage-1 gate flag. Older CLEAN_FILES
      // without this column produce undefined → falsy at the use site.
      const hasFinalReviewGate = values[22] === 'Yes';
      // 2026-07-16: CSV-portability lift — approval_role enum. Older CLEAN_FILES
      // without this column produce '' (no space claims a role, ApprovalService
      // keeps its built-in defaults).
      const rawApprovalRole = (values[23] ?? '').trim();
      const approvalRole: 'dob_exam' | 'fdny_exam' | 'dob_audit' | '' =
        rawApprovalRole === 'dob_exam' || rawApprovalRole === 'fdny_exam' || rawApprovalRole === 'dob_audit'
          ? rawApprovalRole
          : '';
      // 2026-07-16: CSV-portability lift — npc_speaker override. Empty for
      // spaces that keep the legacy prefix-heuristic default.
      const npcSpeaker = (values[24] ?? '').trim();

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
        is_point_of_no_return: values[9] === 'Yes',
        // Workstream 6 #2: minimum W cards required to leave (0 = no guard).
        min_w_cards_to_leave: minWCardsToLeave,
        // Workstream 6 #7: design fee mechanic.
        fee_calculation_method: feeCalculationMethod,
        fee_label: feeLabel,
        // Workstream 6 #3: setup-phase auto-handling.
        auto_apply_funding: autoApplyFunding,
        auto_trigger_card_types: autoTriggerCardTypes,
        // Workstream 6 #4: path-choice memory.
        path_choice_memory_key: pathChoiceMemoryKey,
        is_path_choice_lock_point: isPathChoiceLockPoint,
        // Workstream 6 Phase 6.3: cosmetic overrides.
        display_label_override: displayLabelOverride,
        review_loop_message: reviewLoopMessage,
        // Workstream 3: Living Map coordinates.
        pos_x: Number.isFinite(posX) ? posX : 0,
        pos_y: Number.isFinite(posY) ? posY : 0,
        // 2026-05-18 audit: funding-source data flag.
        funding_source: fundingSource,
        // 2026-06-02: Workstream 7 Phase 7.4 Stage-1 gate flag.
        has_final_review_gate: hasFinalReviewGate,
        // 2026-07-16: CSV-portability lift — approval-gate role.
        approval_role: approvalRole,
        // 2026-07-16: CSV-portability lift — NPC-speaker override.
        npc_speaker: npcSpeaker
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
        spaceEffect.fee_type = values[8].trim() as 'LOAN_PERCENTAGE' | 'SCOPE_PERCENTAGE' | 'FIXED' | 'DICE_BASED' | 'LOAN_TIERED';
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
   *   space_name,visit_type,question_id,question_text,yes_target,no_target,auto_answer_from,yes_reason,no_reason
   *
   * `yes_target` / `no_target` may contain:
   *   - another question_id (e.g. "Q2") → chain continues
   *   - a valid space_name → chain resolves to that move
   *   - a comma-separated list of space_names → downstream sub-choice
   *     (must be quoted in the CSV so the parser doesn't mis-split)
   * Parser treats them as opaque strings; MovementService resolves at walk time.
   *
   * `auto_answer_from` is optional (v3.0.20 / fb:58a2112b). When set, the
   * engine consults player state and skips the choice modal — see
   * LogicQuestion.auto_answer_from in DataTypes.ts for supported keys.
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
        auto_answer_from: (values[6] || '').trim() || undefined,
        yes_reason: (values[7] || '').trim() || undefined,
        no_reason: (values[8] || '').trim() || undefined,
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
      'dice_range_2_min', 'dice_range_2_max', 'dice_range_2_time', 'investor_payout',
      // v2.61.1 Workstream 7 column (was already in CSV but the parser
      // wasn't wiring it through to Card — silent always-undefined).
      'revokes_approval',
      // v3.0.17 column — phase filter for global-scope tick_modifier.
      'affected_phase'
    ];

    if (header.length < 22) {
      throw new Error(`CARDS_EXPANDED.csv header must have at least 22 columns. Found: ${header.length}`);
    }

    // Every field below is read positionally (values[2] is card_type, and so
    // on), so a renamed or reordered column would parse silently into the wrong
    // field rather than fail. expectedColumns was already written out but never
    // checked against anything; this compares it position by position.
    // Trailing columns beyond the list are allowed — the CSV has grown past it
    // several times (is_groundwork, requires_utility_hookup, …) and those are
    // read by name elsewhere, not here.
    for (let i = 0; i < expectedColumns.length && i < header.length; i++) {
      // Strip a UTF-8 BOM off the first cell: the admin Data Editor and Excel
      // both round-trip these files, and either can prepend one. A BOM is not
      // a schema change, so it must not trip the guard.
      const actual = header[i].replace(/^\uFEFF/, '').trim();
      if (actual !== expectedColumns[i]) {
        throw new Error(
          `CARDS_EXPANDED.csv column ${i + 1} must be '${expectedColumns[i]}' but found '${actual}'. ` +
          `Columns are read by position, so reordering or renaming them silently corrupts card data.`
        );
      }
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
        card_mechanic: (values[22] === 'choice' || values[22] === 'dice_conditional' || values[22] === 'work_type_conditional' || values[22] === 'utility_conditional' || values[22] === 'competing_worktype_conditional' || values[22] === 'high_profile_conditional' || values[22] === 'leader_phase_conditional' || values[22] === 'bulk_permit_conditional') ? values[22] as Card['card_mechanic'] : undefined,
        dice_range_1_min: values[23] ? parseInt(values[23]) : undefined,
        dice_range_1_max: values[24] ? parseInt(values[24]) : undefined,
        dice_range_1_time: values[25] ? parseInt(values[25]) : undefined,
        dice_range_2_min: values[26] ? parseInt(values[26]) : undefined,
        dice_range_2_max: values[27] ? parseInt(values[27]) : undefined,
        dice_range_2_time: values[28] ? parseInt(values[28]) : undefined,
        investor_payout: values[29] ? parseInt(values[29]) : undefined,

        // v2.61.1 W7 — wire through the previously-dormant column. CSV
        // values are 'dob' | 'fdny' | 'both' | '' (empty); narrow at read.
        revokes_approval: (values[30] === 'dob' || values[30] === 'fdny' || values[30] === 'both')
          ? values[30] as Card['revokes_approval']
          : undefined,

        // v3.0.17 — global-scope phase filter. Empty/missing → unrestricted.
        affected_phase: values[31] || undefined,

        // 2026-07-16: CSV-portability lift — per-W-card category flags
        // (replaces hardcoded work-type-name allowlists in CardService).
        is_groundwork: values[32] === 'Yes',
        requires_utility_hookup: values[33] === 'Yes',
        is_high_profile: values[34] === 'Yes',

        // 2026-07-26 — L021 "High-Profile Client" fix. The card's authored
        // description promises a SECOND, asymmetric effect ("all other
        // players' current filing time increases by 1 day") that the main
        // tick_modifier column can't express because tick_modifier already
        // carries the self-only -4. This column carries the per-OTHER-player
        // delta; CardService fires it as a second, independent effect (one
        // RESOURCE_CHANGE per other player) after the card's own
        // tick_modifier effect resolves. Empty/undefined → no other-player
        // effect (the vast majority of cards).
        other_players_tick_modifier: values[35] || undefined,
      };
    });
  }

  private buildSpaces(): void {
    // Safety net: some test helpers populate gameConfigs/movements/cards
    // directly (bypassing loadGameConfig()/loadMovements()/loadCards()) and
    // call buildSpaces() straight after — rebuild here too so the lookup
    // Maps aren't left empty in that path. Cheap: a few hundred rows, and
    // buildSpaces() itself is only called once per load/reload.
    this.rebuildLookupMaps();

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
    return this.cardsById.get(cardId);
  }

  getCardsByType(cardType: CardType): Card[] {
    return this.cards.filter(card => card.card_type === cardType);
  }

  getAllCardTypes(): CardType[] {
    const types = new Set(this.cards.map(card => card.card_type));
    return Array.from(types) as CardType[];
  }
}