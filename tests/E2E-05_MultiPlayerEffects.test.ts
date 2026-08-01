// tests/E2E-05_MultiPlayerEffects.test.ts

/**
 * E2E Test Suite: Multi-Player Interactive Effects
 * 
 * This test suite validates the Multi-Player Interactive Effects system, ensuring:
 * - Cards with "All Players" targeting affect everyone
 * - Cards with "All Players-Self" targeting affect everyone except the player
 * - Cards with "Choose Opponent" targeting allow player selection
 * - Cards with "Choose Player" targeting allow any player selection
 * - Multi-player effects work with duration-based persistence
 * - Interactive targeting presents proper choice UI
 * - Complex multi-step targeting scenarios work correctly
 * 
 * Key Cards Tested:
 * - L003: "All Players" - discard cards + time effects 
 * - E009: "Choose Opponent" - interactive targeting with dual effects
 * - TEST005: "Choose Player" - broad player selection
 * 
 * This validates the P2-HIGH priority feature: Multi-Player Interactive Effects
 */

import { StateService } from '../src/services/StateService';
import { DataService } from '../src/services/DataService';
import { CardService } from '../src/services/CardService';
import { LoggingService } from '../src/services/LoggingService';
import { LogWriter } from '../src/services/LogWriter';
import { ChoiceService } from '../src/services/ChoiceService';
import { EffectEngineService } from '../src/services/EffectEngineService';
import { GameRulesService } from '../src/services/GameRulesService';
import { MovementService } from '../src/services/MovementService';
import { ResourceService } from '../src/services/ResourceService';
import { TurnService } from '../src/services/TurnService';
import { NegotiationService } from '../src/services/NegotiationService';
import { TargetingService } from '../src/services/TargetingService';
import { FinancialEffectHandler } from '../src/services/FinancialEffectHandler';
import { CardEffectHandler } from '../src/services/CardEffectHandler';
import { CardEffectService } from '../src/services/CardEffectService';
import { IDataService, IStateService } from '../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ActiveEffect } from '../src/types/DataTypes';

// Node.js compatible DataService for E2E testing
class NodeDataService extends DataService {
  // Override the loadData method to use filesystem instead of fetch
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;

    try {
      const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
      
      // Load all CSV files using filesystem
      const gameConfigCsv = readFileSync(join(dataDir, 'GAME_CONFIG.csv'), 'utf-8');
      const movementCsv = readFileSync(join(dataDir, 'MOVEMENT.csv'), 'utf-8');
      const diceOutcomesCsv = readFileSync(join(dataDir, 'DICE_OUTCOMES.csv'), 'utf-8');
      const spaceEffectsCsv = readFileSync(join(dataDir, 'SPACE_EFFECTS.csv'), 'utf-8');
      const diceEffectsCsv = readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8');
      const spaceContentsCsv = readFileSync(join(dataDir, 'SPACE_CONTENT.csv'), 'utf-8');
      const cardsCsv = readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8');
      
      // Parse CSV data using existing methods
      (this as any).gameConfigs = (this as any).parseGameConfigCsv(gameConfigCsv);
      (this as any).movements = (this as any).parseMovementCsv(movementCsv);
      (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(diceOutcomesCsv);
      (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(spaceEffectsCsv);
      (this as any).diceEffects = (this as any).parseDiceEffectsCsv(diceEffectsCsv);
      (this as any).spaceContents = (this as any).parseSpaceContentCsv(spaceContentsCsv);
      (this as any).cards = (this as any).parseCardsCsv(cardsCsv);
      
      (this as any).buildSpaces();
      (this as any).loaded = true;
    } catch (error) {
      console.error('Error loading CSV data from filesystem:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to load game data from filesystem: ${error.message}`);
      }
      throw error;
    }
  }
}

describe('E2E-05: Multi-Player Interactive Effects', () => {
  let dataService: IDataService;
  let stateService: IStateService;
  let resourceService: ResourceService;
  let choiceService: ChoiceService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let targetingService: TargetingService;
  let effectEngineService: EffectEngineService;
  let turnService: TurnService;
  let negotiationService: NegotiationService;
  
  // Player ID variables for proper service calls
  let aliceId: string, bobId: string, charlieId: string;

  beforeEach(async () => {
    // Create services in dependency order
    dataService = new NodeDataService();
    await dataService.loadData();
    
    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    new LogWriter(stateService, loggingService);
    resourceService = new ResourceService(stateService);
    choiceService = new ChoiceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
    movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService);
    targetingService = new TargetingService(stateService, choiceService);
    
    // Create temporary EffectEngineService for circular dependencies
    const tempEffectEngine = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, undefined as any, undefined as any, targetingService, loggingService);
    negotiationService = new NegotiationService(stateService, tempEffectEngine, resourceService, choiceService);
    
    // Create CardEffectService — needed for TurnService constructor
    const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);

    // Create TurnService
    turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService, choiceService, undefined, undefined, undefined, undefined, cardEffectService);

    // Build handlers first so they can be passed via the EE constructor
    const loggingServiceRef = new LoggingService(stateService);
    const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingServiceRef);
    const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingServiceRef);
    // Headless bypass for forced-discard choice modals (L003/L048) — same flag
    // the ghost bot sets (tests/ghost/bootstrapServices.ts). Needed since these
    // tests now drive the live cardService.playCard path, whose CARD_DISCARD
    // fan-out otherwise awaits a per-player pick modal and times out headless.
    cardEffectHandler.autoPickForcedDiscards = true;

    // Create final EffectEngineService with complete dependencies
    effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, turnService, gameRulesService, targetingService, loggingService, undefined, financialEffectHandler, cardEffectHandler);

    // Complete circular dependencies (real cycle)
    turnService.setEffectEngineService(effectEngineService);
    cardService.setEffectEngineService(effectEngineService);

    // Initialize 3 players for comprehensive multi-player testing
    stateService.addPlayer('Alice');
    stateService.addPlayer('Bob');
    stateService.addPlayer('Charlie');
    stateService.startGame();
    
    // Capture the actual player IDs
    const players = stateService.getGameState().players;
    aliceId = players.find(p => p.name === 'Alice')!.id;
    bobId = players.find(p => p.name === 'Bob')!.id;
    charlieId = players.find(p => p.name === 'Charlie')!.id;
    
    // Ensure all players start in well-defined states (after game is started)
    try {
      await movementService.movePlayer(aliceId, 'CONSTRUCTION-SITE');
      await movementService.movePlayer(bobId, 'OFFICE-DOWNTOWN');
      await movementService.movePlayer(charlieId, 'PERMITTING-OFFICE');
    } catch (error) {
      // If movement fails, players will use their default starting positions
      console.log('Player movement in setup failed, using default starting positions:', (error as Error).message);
    }
  });

  afterEach(() => {
    // Clean up all service references to prevent memory leaks
    if (stateService) {
      // Clear any running timers or intervals
      const gameState = stateService.getGameState();
      if (gameState.players) {
        gameState.players.forEach(player => {
          if (player.activeEffects) {
            player.activeEffects.length = 0;
          }
        });
      }
    }

    // Clear all service references
    dataService = null as any;
    stateService = null as any;
    resourceService = null as any;
    choiceService = null as any;
    gameRulesService = null as any;
    cardService = null as any;
    movementService = null as any;
    targetingService = null as any;
    effectEngineService = null as any;
    turnService = null as any;
    negotiationService = null as any;

    // Clear player ID references
    aliceId = null as any;
    bobId = null as any;
    charlieId = null as any;

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('All Players Targeting', () => {
    it('should affect all players with L003 New Safety Regulations', async () => {
      // L003: "All players must discard 1 Expeditor card. All inspections take 3 additional days this turn."
      // Target: "All Players"
      
      // Setup: Give all players some E cards to discard
      const alice = stateService.getPlayer(aliceId)!;
      const bob = stateService.getPlayer(bobId)!;
      const charlie = stateService.getPlayer(charlieId)!;
      
      // Initialize hand with E cards to players' hands. L003 carries
      // phase_restriction=CONSTRUCTION (data change after this test was
      // written), so Alice must be on a CONSTRUCTION-phase space to play it.
      stateService.updatePlayer({ id: aliceId, hand: ['E001', 'E002', 'L003'], currentSpace: 'CON-INITIATION' });
      stateService.updatePlayer({ id: bobId, hand: ['E003', 'E004'] });
      stateService.updatePlayer({ id: charlieId, hand: ['E005'] });
      
      // Record initial card counts
      const aliceInitialECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const bobInitialECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const charlieInitialECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      console.log('📊 Initial E card counts:', { 
        alice: aliceInitialECards, 
        bob: bobInitialECards, 
        charlie: charlieInitialECards 
      });
      
      // Apply L003 the way production does. Life Events are never played
      // manually (the V2 UI's play-from-hand action is E-cards-only) — they
      // auto-apply on draw via CardEffectHandler, which calls
      // applyCardEffects(..., { onlyResourceEffects: true }). That path carries
      // the Kid E fan-out guard, so each player discards exactly once.
      // (The old test drove the deleted PlayerActionService manual-play path.)
      await cardService.applyCardEffects(aliceId, 'L003', { onlyResourceEffects: true });

      // Verify: All players should have lost 1 E card
      const aliceFinalECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const bobFinalECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const charlieFinalECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;

      console.log('📊 Final E card counts:', {
        alice: aliceFinalECards,
        bob: bobFinalECards,
        charlie: charlieFinalECards
      });

      expect(aliceFinalECards).toBe(Math.max(0, aliceInitialECards - 1));
      expect(bobFinalECards).toBe(Math.max(0, bobInitialECards - 1));
      expect(charlieFinalECards).toBe(Math.max(0, charlieInitialECards - 1));

      // Verify: L003 stays in Alice's hand as a record — the auto life-event
      // path deliberately does NOT discard the drawn L card (see
      // CardEffectHandler's draw handler: "Card stays in hand as a record").
      expect(stateService.getPlayer(aliceId)!.hand).toContain('L003');
    });

    it('manual playCard of a global no-duration card applies each effect exactly once per player (N×N fan-out regression, v3.1.10)', async () => {
      // Regression pin for the Kid E guard extension. Before v3.1.10 the
      // guard (CardService.applyCardEffects overriding target to 'Self' when
      // the parser has already fanned a Global no-duration card out per
      // player) only ran on the onlyResourceEffects auto path. The manual
      // cardService.playCard path re-fanned the already-fanned effects via
      // the card's target='All Players' rule — N effects × N targets — so a
      // 3-player L003 discarded up to 3 E cards per player instead of 1.
      // Unreachable from the V2 UI (manual play is E-cards-only) but real at
      // the service-API level.
      stateService.updatePlayer({ id: aliceId, hand: ['E001', 'E002', 'L003'], currentSpace: 'CON-INITIATION' });
      stateService.updatePlayer({ id: bobId, hand: ['E003', 'E004'] });
      stateService.updatePlayer({ id: charlieId, hand: ['E005'] });

      const timeBefore = Object.fromEntries([aliceId, bobId, charlieId].map(id =>
        [id, stateService.getPlayer(id)!.timeSpent ?? 0]));

      await cardService.playCard(aliceId, 'L003');

      // Exactly ONE discard per player — the N×N bug drained every E card.
      const eCards = (id: string) => stateService.getPlayer(id)!.hand.filter(c => c.startsWith('E')).length;
      expect(eCards(aliceId)).toBe(1);   // 2 - 1
      expect(eCards(bobId)).toBe(1);     // 2 - 1
      expect(eCards(charlieId)).toBe(0); // 1 - 1

      // Played manually, L003 IS discarded (finalizePlayedCard), unlike the
      // auto-draw path where it stays in hand as a record.
      expect(stateService.getPlayer(aliceId)!.hand).not.toContain('L003');
      expect(stateService.getGameState().discardPiles.L).toContain('L003');

      // L003's +3-days tick is phase-filtered (affected_phase), so depending
      // on where each player stands the delta is 0 or 3 — never 6/9, which is
      // what the N×N re-fan produced.
      for (const id of [aliceId, bobId, charlieId]) {
        const delta = (stateService.getPlayer(id)!.timeSpent ?? 0) - timeBefore[id];
        expect([0, 3]).toContain(delta);
      }
    });

    it('should handle duration-based All Players effects with L002 Economic Downturn, ticking each holder only on their OWN turn', async () => {
      // L002: "All permit and inspection times increase by 2 days for the next 3 turns."
      // Target: "All Players", Duration: "Turns", Duration Count: "3"
      //
      // v3.0.119 (maintainer ruling 2026-07-11, Option B): a duration effect
      // ticks/decrements only on the HOLDER's own turn ending, not on every
      // turn-end in the game. "3 turns" means 3 of *your* turns — so with 3
      // players, each player's copy of L002 now takes a full 3 ROUNDS (9
      // total turn-ends) to expire, not 3 turn-ends total like the old bug.
      // Total ticks per holder (3) and total damage (3 x per-tick amount)
      // are unchanged — only the wall-clock/turn-order spread changes.

      // Give Alice the L002 card
      stateService.updatePlayer({
        id: aliceId,
        hand: ['L002']
      });

      // Alice plays L002 card
      await cardService.playCard(aliceId, 'L002');

      // Verify: All players have active effects with 3-turn duration
      const players = [aliceId, bobId, charlieId];
      for (const playerId of players) {
        const player = stateService.getPlayer(playerId)!;
        const l002Effect = player.activeEffects.find(effect => effect.sourceCardId === 'L002');

        expect(l002Effect).toBeDefined();
        expect(l002Effect!.remainingDuration).toBe(3);
      }

      const getRemaining = (playerId: string) =>
        stateService.getPlayer(playerId)!.activeEffects.find(e => e.sourceCardId === 'L002')?.remainingDuration;

      // Turn order is Alice -> Bob -> Charlie -> Alice -> ... (player array
      // order). Alice already played L002 during her turn 1; the game is
      // still on turn 1, current player Alice.
      //
      // v3.0.113: TurnService.endTurn() was dead code and was deleted; use
      // the live endTurnWithMovement() path instead (force=true skips the
      // required-actions gate, skipAutoMove=true skips movement — this test
      // only cares about turn advancement, not where players end up).

      // End Alice's own turn (turn 1 -> 2). Only ALICE's effect should tick;
      // Bob's and Charlie's effects belong to turns that haven't ended yet.
      await turnService.endTurnWithMovement(true, true);
      expect(getRemaining(aliceId)).toBe(2);
      expect(getRemaining(bobId)).toBe(3);
      expect(getRemaining(charlieId)).toBe(3);

      // End Bob's turn (turn 2 -> 3) and Charlie's turn (turn 3 -> 4) — two
      // OTHER players' turns ending. Alice's own effect must stay UNCHANGED
      // since it only decrements on Alice's own turn end.
      await turnService.endTurnWithMovement(true, true); // Bob's turn ends
      expect(getRemaining(aliceId)).toBe(2); // unchanged — not Alice's turn
      expect(getRemaining(bobId)).toBe(2);   // Bob's own turn ticked his copy

      await turnService.endTurnWithMovement(true, true); // Charlie's turn ends
      expect(getRemaining(aliceId)).toBe(2);   // still unchanged
      expect(getRemaining(charlieId)).toBe(2); // Charlie's own turn ticked his copy

      // One full round complete (3 turn-ends, one per player) — every
      // player's copy has now ticked exactly once, matching the old
      // per-round cadence but for the correct reason (each holder's OWN
      // turn), not "any turn-end anywhere."
      for (const playerId of players) {
        expect(getRemaining(playerId)).toBe(2);
      }

      // Second round (turns 4, 5, 6): Alice, Bob, Charlie each tick again.
      await turnService.endTurnWithMovement(true, true); // Alice's 2nd turn ends
      await turnService.endTurnWithMovement(true, true); // Bob's 2nd turn ends
      await turnService.endTurnWithMovement(true, true); // Charlie's 2nd turn ends
      for (const playerId of players) {
        expect(getRemaining(playerId)).toBe(1);
      }

      // Third round (turns 7, 8, 9): each holder's final tick expires their
      // own copy of the effect. With the old bug this expired after just 3
      // turn-ends total (1 round); correctly it now takes 9 (3 rounds).
      await turnService.endTurnWithMovement(true, true); // Alice's 3rd turn ends
      expect(getRemaining(aliceId)).toBeUndefined();
      expect(getRemaining(bobId)).toBe(1); // Bob's copy hasn't ticked a 3rd time yet

      await turnService.endTurnWithMovement(true, true); // Bob's 3rd turn ends
      expect(getRemaining(bobId)).toBeUndefined();
      expect(getRemaining(charlieId)).toBe(1); // Charlie's copy hasn't ticked a 3rd time yet

      await turnService.endTurnWithMovement(true, true); // Charlie's 3rd turn ends
      expect(getRemaining(charlieId)).toBeUndefined();

      for (const playerId of players) {
        const player = stateService.getPlayer(playerId)!;
        const l002Effect = player.activeEffects.find(effect => effect.sourceCardId === 'L002');
        expect(l002Effect).toBeUndefined(); // Effect should be expired for everyone
      }
    });
  });

  describe('L021 "High-Profile Client" — asymmetric self/other effect (2026-07-26 fix)', () => {
    it('reduces the playing player by 4 days and every OTHER player by (increases) 1 day', async () => {
      // L021: "The current filing time is reduced by 4 days; all other
      // players' current filing time increases by 1 day." tick_modifier=-4
      // already worked (self); other_players_tick_modifier=1 is the fix
      // under test — every other player's timeSpent should go UP by 1.
      // Alice needs pre-existing timeSpent for the -4 to be observable —
      // ResourceService clamps timeSpent at a floor of 0 (Math.max(0, ...)),
      // and a fresh test player starts at 0.
      stateService.updatePlayer({ id: aliceId, hand: ['L021'], timeSpent: 10 });

      const before = Object.fromEntries([aliceId, bobId, charlieId].map(id =>
        [id, stateService.getPlayer(id)!.timeSpent ?? 0]));

      await cardService.playCard(aliceId, 'L021');

      const after = Object.fromEntries([aliceId, bobId, charlieId].map(id =>
        [id, stateService.getPlayer(id)!.timeSpent ?? 0]));

      expect(after[aliceId] - before[aliceId]).toBe(-4);   // acting player: -4 days
      expect(after[bobId] - before[bobId]).toBe(1);        // other player: +1 day
      expect(after[charlieId] - before[charlieId]).toBe(1); // other player: +1 day

      // Played manually, L021 is discarded (finalizePlayedCard) like any
      // other Immediate/no-duration card.
      expect(stateService.getPlayer(aliceId)!.hand).not.toContain('L021');
    });

    it('does not touch other players when a DIFFERENT card with no other_players_tick_modifier is played', async () => {
      // Regression guard: this mechanic must stay scoped to cards that
      // actually set the column (L021 today) and not leak onto ordinary
      // self-only tick_modifier cards. L001 "Neighborly Complaints" is a
      // plain target=Self/scope=Single/+3-day card with no other-player
      // column set — a clean negative control.
      stateService.updatePlayer({ id: aliceId, hand: ['L001'], currentSpace: 'CON-INITIATION' });

      const bobBefore = stateService.getPlayer(bobId)!.timeSpent ?? 0;
      const charlieBefore = stateService.getPlayer(charlieId)!.timeSpent ?? 0;

      await cardService.playCard(aliceId, 'L001');

      expect(stateService.getPlayer(bobId)!.timeSpent ?? 0).toBe(bobBefore);
      expect(stateService.getPlayer(charlieId)!.timeSpent ?? 0).toBe(charlieBefore);
    });
  });

  describe('Basic Targeting Verification', () => {
    it('should verify targeting service is integrated properly', async () => {
      // Simple test to verify the targeting system is working
      // This tests that the TargetingService is properly integrated
      
      // Test basic targeting rules - check if players exist first
      const gameState = stateService.getGameState();
      console.log('Players in game:', gameState.players.map(p => p.name));
      
      if (gameState.players.length >= 3) {
        // Test that the service can resolve basic targeting rules
        const selfTargets = await targetingService.resolveTargets(aliceId, 'Self');
        expect(selfTargets).toEqual([aliceId]);
        
        const allPlayersTargets = await targetingService.resolveTargets(aliceId, 'All Players');
        expect(allPlayersTargets.length).toBe(3);
        expect(allPlayersTargets).toContain(aliceId);
        expect(allPlayersTargets).toContain(bobId);
        expect(allPlayersTargets).toContain(charlieId);
        
        const allOtherTargets = await targetingService.resolveTargets(aliceId, 'All Players-Self');
        expect(allOtherTargets.length).toBe(2);
        expect(allOtherTargets).not.toContain(aliceId);
      }
      
      // Verify interactive targeting detection
      expect(targetingService.isInteractiveTargeting('Choose Opponent')).toBe(true);
      expect(targetingService.isInteractiveTargeting('Choose Player')).toBe(true);
      expect(targetingService.isInteractiveTargeting('Self')).toBe(false);
      expect(targetingService.isInteractiveTargeting('All Players')).toBe(false);
    });

    it('should process multi-player card effects through the EffectEngine', async () => {
      // Test that cards with multi-player targets get processed correctly
      // This verifies the integration between CardService, EffectEngineService, and TargetingService
      
      // Get L003 card data  
      const l003Card = dataService.getCardById('L003');
      expect(l003Card).toBeDefined();
      expect(l003Card!.target).toBe('All Players');
      
      // Give Alice some E cards and the L003 card. L003 is CONSTRUCTION-phase
      // restricted, so put her on a CONSTRUCTION space (see the test above).
      stateService.updatePlayer({
        id: aliceId,
        hand: ['E001', 'E002', 'L003'],
        currentSpace: 'CON-INITIATION'
      });
      
      // Give other players E cards too
      stateService.updatePlayer({
        id: bobId,
        hand: ['E003']
      });
      stateService.updatePlayer({
        id: charlieId,
        hand: ['E004']
      });
      
      // Record initial state
      const initialAliceECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const initialBobECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const initialCharlieECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      // Apply the multi-player card via the production auto life-event path
      // (see the L003 test above — manual L-card play doesn't exist in the UI)
      await cardService.applyCardEffects(aliceId, 'L003', { onlyResourceEffects: true });
      
      // Verify all players were affected
      const finalAliceECards = stateService.getPlayer(aliceId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const finalBobECards = stateService.getPlayer(bobId)!.hand.filter(card => card.startsWith('E')).length || 0;
      const finalCharlieECards = stateService.getPlayer(charlieId)!.hand.filter(card => card.startsWith('E')).length || 0;
      
      // All players should have discarded 1 E card (or 0 if they had none)
      expect(finalAliceECards).toBe(Math.max(0, initialAliceECards - 1));
      expect(finalBobECards).toBe(Math.max(0, initialBobECards - 1));
      expect(finalCharlieECards).toBe(Math.max(0, initialCharlieECards - 1));
    });
  });
});

describe('E2E-05b: L021 "High-Profile Client" in solo play (2026-07-26 fix)', () => {
  // Separate top-level suite with its own single-player game, since the
  // main E2E-05 suite above always seeds 3 players. Confirms the new
  // other_players_tick_modifier mechanic doesn't error with zero other
  // players — it should simply have no targets, matching the existing
  // solo-safe DISPLAY override in templateInterpolation.ts (that override
  // only trims the shown text; this test confirms the MECHANIC side is
  // equally safe without needing any solo-specific code of its own).
  let dataService: IDataService;
  let stateService: IStateService;
  let resourceService: ResourceService;
  let choiceService: ChoiceService;
  let gameRulesService: GameRulesService;
  let cardService: CardService;
  let movementService: MovementService;
  let targetingService: TargetingService;
  let effectEngineService: EffectEngineService;
  let turnService: TurnService;
  let negotiationService: NegotiationService;
  let soloId: string;

  class NodeDataServiceSolo extends DataService {
    async loadData(): Promise<void> {
      if ((this as any).loaded) return;
      const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
      const gameConfigCsv = readFileSync(join(dataDir, 'GAME_CONFIG.csv'), 'utf-8');
      const movementCsv = readFileSync(join(dataDir, 'MOVEMENT.csv'), 'utf-8');
      const diceOutcomesCsv = readFileSync(join(dataDir, 'DICE_OUTCOMES.csv'), 'utf-8');
      const spaceEffectsCsv = readFileSync(join(dataDir, 'SPACE_EFFECTS.csv'), 'utf-8');
      const diceEffectsCsv = readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8');
      const spaceContentsCsv = readFileSync(join(dataDir, 'SPACE_CONTENT.csv'), 'utf-8');
      const cardsCsv = readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8');
      (this as any).gameConfigs = (this as any).parseGameConfigCsv(gameConfigCsv);
      (this as any).movements = (this as any).parseMovementCsv(movementCsv);
      (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(diceOutcomesCsv);
      (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(spaceEffectsCsv);
      (this as any).diceEffects = (this as any).parseDiceEffectsCsv(diceEffectsCsv);
      (this as any).spaceContents = (this as any).parseSpaceContentCsv(spaceContentsCsv);
      (this as any).cards = (this as any).parseCardsCsv(cardsCsv);
      (this as any).buildSpaces();
      (this as any).loaded = true;
    }
  }

  beforeEach(async () => {
    dataService = new NodeDataServiceSolo();
    await dataService.loadData();

    stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    new LogWriter(stateService, loggingService);
    resourceService = new ResourceService(stateService);
    choiceService = new ChoiceService(stateService);
    gameRulesService = new GameRulesService(dataService, stateService);
    cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService);
    movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService);
    targetingService = new TargetingService(stateService, choiceService);

    const tempEffectEngine = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, undefined as any, undefined as any, targetingService, loggingService);
    negotiationService = new NegotiationService(stateService, tempEffectEngine, resourceService, choiceService);
    const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);
    turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService, choiceService, undefined, undefined, undefined, undefined, cardEffectService);

    const loggingServiceRef = new LoggingService(stateService);
    const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingServiceRef);
    const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingServiceRef);
    cardEffectHandler.autoPickForcedDiscards = true;

    effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, turnService, gameRulesService, targetingService, loggingService, undefined, financialEffectHandler, cardEffectHandler);
    turnService.setEffectEngineService(effectEngineService);
    cardService.setEffectEngineService(effectEngineService);

    // Solo game — exactly ONE player, no one else to target.
    stateService.addPlayer('Solo');
    stateService.startGame();
    soloId = stateService.getGameState().players[0].id;
  });

  it('applies the self -4 with zero other players and does not error (no targets, not a crash)', async () => {
    // Seed timeSpent so the -4 is observable — ResourceService floors
    // timeSpent at 0 (Math.max(0, ...)) and a fresh player starts at 0.
    stateService.updatePlayer({ id: soloId, hand: ['L021'], timeSpent: 10 });
    const before = stateService.getPlayer(soloId)!.timeSpent ?? 0;

    // No try/catch, no expect-wrapper: if applyOtherPlayersTickModifier ever
    // threw on an empty other-players list, this await would reject and fail
    // the test with that error, same as any other unhandled rejection.
    await cardService.playCard(soloId, 'L021');

    const after = stateService.getPlayer(soloId)!.timeSpent ?? 0;
    expect(after - before).toBe(-4); // self benefit still applies
    expect(stateService.getGameState().players.length).toBe(1); // sanity: truly solo
  });
});