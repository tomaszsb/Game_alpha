/**
 * Ghost Player — a headless bot that plays the game by picking random valid
 * actions. The Ghost Player is the v3.0 Beta regression safety net: it
 * exercises real service code paths without a UI, so silent breakage in any
 * space, card, or effect is caught in CI instead of by a student mid-session.
 *
 * Design goals:
 *   - Use the same DI-wired services the real game uses (via bootstrapServices)
 *   - Make only legal choices (no brute-forcing invalid state)
 *   - Report failures with enough context to reproduce deterministically
 *   - Cheap enough to run 1,000+ games in CI without babysitting
 *
 * Failure modes we detect:
 *   - Uncaught exceptions from any service
 *   - Turn count exceeding the cap (stuck / infinite loop)
 *   - NaN or undefined resource values on the player
 *   - Current space missing from the space table (corrupt move)
 */

import type { HeadlessServices } from './bootstrapServices';
import { bootstrapHeadlessServices } from './bootstrapServices';

export interface GhostGameResult {
  success: boolean;
  turns: number;
  finalSpace: string | undefined;
  reason: 'WIN' | 'TURN_CAP' | 'EXCEPTION' | 'INVARIANT_VIOLATION';
  error?: string;
  trail: string[];
}

export interface GhostGameOptions {
  maxTurns?: number;
  playerName?: string;
  verbose?: boolean;
  /**
   * Probability (0..1) that the ghost will invoke Try Again on any turn where
   * the current space allows it (can_negotiate = true). Default 0 — the base
   * ghost never uses Try Again. The "try-again-happy" variant uses ~0.2 so
   * every strict run exercises the Try Again code path and its state reverts.
   */
  tryAgainProbability?: number;
  /**
   * Optional abort signal. When triggered, the game loop and inner helpers
   * (resolveAnyPendingChoice, triggerManualSpaceEffects) return early at the
   * next yield point. Used by runGhostBatch to enforce a per-game wall-clock
   * cap without leaking the timed-out game's CPU into subsequent games.
   */
  signal?: AbortSignal;
}

/**
 * Play one game to completion (or failure) using a single Ghost Player.
 * Returns a result object; never throws — all failures are captured in
 * `result.success === false` so batch runners can aggregate.
 */
// Phase order for the bot's forward-bias heuristic. Higher = later in the
// project lifecycle. PM-DECISION-CHECK (OWNER) is a resume hub reached from
// multiple later phases; without a forward bias, the random-move bot loops
// through it forever.
const PHASE_ORDER: Record<string, number> = {
  SETUP: 0,
  OWNER: 1,
  FUNDING: 2,
  DESIGN: 3,
  REGULATORY: 4,
  CONSTRUCTION: 5,
  END: 6,
};

function phaseOf(dataService: any, space: string): number {
  const cfg = dataService.getGameConfigBySpace(space);
  return PHASE_ORDER[cfg?.phase] ?? -1;
}

/**
 * Pick a destination favoring forward progress + exploration:
 *   1. Filter to destinations whose phase >= current phase (forward / same)
 *   2. Among those (or all, if no forward options), pick the least-visited
 *   3. Ties broken randomly
 * Falls back to pure random only when phase data is missing.
 */
function pickDestination(
  dataService: any,
  destinations: string[],
  currentSpace: string,
  visitCounts: Map<string, number>
): string {
  if (destinations.length === 1) return destinations[0];
  const currentPhase = phaseOf(dataService, currentSpace);
  if (currentPhase < 0) {
    return destinations[Math.floor(Math.random() * destinations.length)];
  }
  const forward = destinations.filter(d => phaseOf(dataService, d) >= currentPhase);
  const pool = forward.length > 0 ? forward : destinations;
  let minVisits = Infinity;
  for (const d of pool) {
    const v = visitCounts.get(d) ?? 0;
    if (v < minVisits) minVisits = v;
  }
  const leastVisited = pool.filter(d => (visitCounts.get(d) ?? 0) === minVisits);
  return leastVisited[Math.floor(Math.random() * leastVisited.length)];
}

export async function playOneGame(
  services: HeadlessServices,
  options: GhostGameOptions = {}
): Promise<GhostGameResult> {
  const { stateService, turnService, dataService, choiceService } = services;
  const maxTurns = options.maxTurns ?? 300;
  const playerName = options.playerName ?? 'Ghost';
  const signal = options.signal;
  const trail: string[] = [];
  const visitCounts = new Map<string, number>();

  const fail = (reason: GhostGameResult['reason'], error: string, turns: number): GhostGameResult => ({
    success: false,
    turns,
    finalSpace: safeGetPlayerSpace(stateService),
    reason,
    error,
    trail,
  });

  const abortedResult = (turn: number): GhostGameResult => {
    trail.push(`  aborted by wall-clock signal at turn ${turn}`);
    return fail('TURN_CAP', 'Aborted by wall-clock signal', turn);
  };

  try {
    stateService.addPlayer(playerName);
    const player = stateService.getAllPlayers()[0];
    const playerId = player.id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();
    await turnService.startTurn(playerId);
    if (signal?.aborted) return abortedResult(0);

    for (let turn = 0; turn < maxTurns; turn++) {
      if (signal?.aborted) return abortedResult(turn);

      const p = stateService.getPlayer(playerId);
      if (!p) return fail('INVARIANT_VIOLATION', 'Player disappeared from state', turn);

      // Invariant checks on every turn
      const invariantErr = checkInvariants(p, dataService);
      if (invariantErr) return fail('INVARIANT_VIOLATION', invariantErr, turn);

      const wCards = p.hand?.filter((c: string) => c.startsWith('W')).length ?? 0;
      trail.push(`T${turn} ${p.currentSpace}:${p.visitType} hand=${p.hand?.length ?? 0}(W=${wCards}) $${p.money}`);
      if (options.verbose) console.log(`T${turn} @ ${p.currentSpace} (${p.visitType})`);
      visitCounts.set(p.currentSpace, (visitCounts.get(p.currentSpace) ?? 0) + 1);

      // Check win condition
      if (stateService.getGameState().isGameOver) {
        return {
          success: true,
          turns: turn,
          finalSpace: p.currentSpace,
          reason: 'WIN',
          trail,
        };
      }

      // Handle any pending choice before doing space effects
      await resolveAnyPendingChoice(services, signal);
      if (signal?.aborted) return abortedResult(turn);

      // Some spaces have an "automatic funding" hook the UI calls explicitly
      if (p.currentSpace === 'OWNER-FUND-INITIATION') {
        await turnService.handleAutomaticFunding(playerId);
        if (signal?.aborted) return abortedResult(turn);
      }

      // Trigger manual space effects (dice rolls, card draws, etc.)
      await triggerManualSpaceEffects(services, playerId, trail, signal);
      if (signal?.aborted) return abortedResult(turn);

      // Resolve any choice that popped up from the effect
      await resolveAnyPendingChoice(services, signal);
      if (signal?.aborted) return abortedResult(turn);

      // For movement: if it's a choice-type move, pick a random destination
      const refreshed = stateService.getPlayer(playerId);
      if (!refreshed) return fail('INVARIANT_VIOLATION', 'Player vanished mid-turn', turn);
      const movement = dataService.getMovement(refreshed.currentSpace, refreshed.visitType);

      if (movement?.movement_type === 'choice') {
        // Use MovementService.getValidMoves so we respect any runtime filtering
        // (e.g. spaces that present 2 CSV destinations but only allow one based
        // on prior player state). Falling back to raw CSV dests mirrors the old
        // behavior if the service somehow returns nothing.
        let dests = services.movementService.getValidMoves(playerId);
        if (!dests || dests.length === 0) dests = collectDestinations(movement);
        if (dests.length === 0) {
          return fail('INVARIANT_VIOLATION', `Choice movement from ${refreshed.currentSpace} has no destinations`, turn);
        }
        const pick = pickDestination(dataService, dests, refreshed.currentSpace, visitCounts);
        stateService.setPlayerMoveIntent(playerId, pick);
      } else if (movement?.movement_type === 'dice' || movement?.movement_type === 'dice_outcome') {
        // Dice-based movement: roll if not already rolled
        const state = stateService.getGameState();
        if (!state.hasPlayerRolledDice) {
          await turnService.rollDiceAndProcessEffects(playerId);
        }
      }

      // Final choice resolution (rolling dice may have introduced one)
      await resolveAnyPendingChoice(services, signal);
      if (signal?.aborted) return abortedResult(turn);

      // A space effect or dice roll may have ended the game (e.g. reaching FINISH).
      // If so, loop back so the isGameOver check at the top can record the WIN.
      const gs = stateService.getGameState();
      if (gs.isGameOver || gs.gamePhase !== 'PLAY') continue;

      // Randomly invoke Try Again on spaces that allow it. This exercises the
      // snapshot-revert code path so the try-again-happy ghost variant catches
      // regressions in the state-restore logic.
      const tryAgainProb = options.tryAgainProbability ?? 0;
      if (tryAgainProb > 0 && Math.random() < tryAgainProb) {
        const pp = stateService.getPlayer(playerId);
        const spaceContent = pp ? dataService.getSpaceContent(pp.currentSpace, pp.visitType) : null;
        if (spaceContent?.can_negotiate) {
          const handBefore = pp?.hand?.length ?? 0;
          const timeBefore = pp?.timeSpent ?? 0;
          const moneyBefore = pp?.money ?? 0;
          const tryResult = await turnService.tryAgainOnSpace(playerId);
          if (tryResult.success && tryResult.shouldAdvanceTurn) {
            const after = stateService.getPlayer(playerId);
            trail.push(
              `  tryAgain@${pp?.currentSpace} hand:${handBefore}→${after?.hand?.length ?? 0} ` +
                `time:${timeBefore}→${after?.timeSpent ?? 0} $:${moneyBefore}→${after?.money ?? 0}`
            );
            await turnService.endTurnWithMovement(true, true);
            continue;
          }
          trail.push(`  tryAgain failed: ${tryResult.message}`);
        }
      }

      // Verify action completion before ending turn (mirrors real UI guard)
      const preEndState = stateService.getGameState();
      if (preEndState.requiredActions > preEndState.completedActionCount) {
        return fail(
          'INVARIANT_VIOLATION',
          `Action mismatch at ${stateService.getPlayer(playerId)?.currentSpace}: ` +
            `required=${preEndState.requiredActions}, completed=${preEndState.completedActionCount}, ` +
            `manualActions=${JSON.stringify(preEndState.completedActions?.manualActions)}`,
          turn
        );
      }

      await turnService.endTurnWithMovement();
      if (signal?.aborted) return abortedResult(turn);
    }

    return fail('TURN_CAP', `Game did not finish within ${maxTurns} turns`, maxTurns);
  } catch (err: any) {
    const turns = trail.length;
    const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return fail('EXCEPTION', message, turns);
  }
}

function checkInvariants(player: any, dataService: any): string | null {
  if (player.money == null || Number.isNaN(player.money)) {
    return `player.money is ${player.money}`;
  }
  if (player.timeSpent == null || Number.isNaN(player.timeSpent)) {
    return `player.timeSpent is ${player.timeSpent}`;
  }
  if (!player.currentSpace) {
    return 'player.currentSpace is empty';
  }
  // Verify the space actually exists in the data
  const effects = dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const movement = dataService.getMovement(player.currentSpace, player.visitType);
  if ((!effects || effects.length === 0) && !movement) {
    return `space "${player.currentSpace}" (${player.visitType}) not found in data tables (effects=${effects?.length ?? 'null'}, movement=${!!movement})`;
  }
  return null;
}

async function resolveAnyPendingChoice(services: HeadlessServices, signal?: AbortSignal): Promise<void> {
  const { stateService, choiceService } = services;
  // Loop in case one resolution triggers another (e.g. LOGIC_QUESTION chains
  // where answering Q1 leads to Q2, etc.). 20 iterations covers the longest
  // chain in production (REG-FDNY-FEE-REVIEW = 5 questions + a possible
  // sub-choice MOVEMENT modal at Q5).
  for (let i = 0; i < 20; i++) {
    if (signal?.aborted) return;
    const choice = stateService.getGameState().awaitingChoice;
    if (!choice) return;
    if (choice.options.length === 0) return; // can't resolve, let the turn end
    // Resolve everything — including MOVEMENT-type sub-choices from inside
    // logic chains. We previously skipped MOVEMENT choices on the theory that
    // the main loop's setPlayerMoveIntent handles them, but that only applies
    // to top-level 'choice' movement_type spaces. A MOVEMENT choice created
    // mid-chain (resolveLogicTarget Case 2) hangs the chain forever if the
    // ghost doesn't resolve it, eventually triggering the 5-minute promise
    // timeout in ChoiceService and stalling the whole test batch.
    const pick = choice.options[Math.floor(Math.random() * choice.options.length)];
    choiceService.resolveChoice(choice.id, pick.id);
    // Yield to the event loop so the resolver (e.g. walkLogicChain awaiting
    // on the resolved createChoice promise) can resume and set the next
    // awaitingChoice before we re-check. walkLogicChain chains through
    // multiple awaits (createChoice → resolveLogicTarget → recursive
    // walkLogicChain → createChoice), so we need a setTimeout(0) yield
    // not just a microtask flush.
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function triggerManualSpaceEffects(
  services: HeadlessServices,
  playerId: string,
  trail: string[],
  signal?: AbortSignal
): Promise<void> {
  const { stateService, dataService, turnService, choiceService } = services;
  const p = stateService.getPlayer(playerId);
  if (!p) return;
  const effects = dataService.getSpaceEffects(p.currentSpace, p.visitType);
  if (!effects) return;

  for (const effect of effects) {
    if (signal?.aborted) return;
    if (effect.trigger_type !== 'manual') continue;
    if (effect.effect_type === 'turn') continue; // skip end-turn effects

    // UI splits dice vs non-dice effects:
    //   dice → turnService.rollDiceWithFeedback() (handles DICE_EFFECTS like W card draws)
    //   other → turnService.triggerManualEffect(key)
    if (effect.effect_type === 'dice') {
      if (stateService.getGameState().hasPlayerRolledDice) {
        trail.push(`  skip dice (already rolled)`);
        continue;
      }
      try {
        const result = await turnService.rollDiceWithFeedback(playerId);
        const pp = stateService.getPlayer(playerId);
        const w = pp?.hand?.filter((c: string) => c.startsWith('W')).length ?? 0;
        trail.push(`  rolled(${result?.diceValue}) fx=${result?.effects?.length ?? 0} → hand=${pp?.hand?.length ?? 0}(W=${w})`);
      } catch (e: any) {
        trail.push(`  roll FAILED: ${e?.message || e}`);
      }
    } else {
      const key = `${effect.effect_type}:${effect.effect_action}`;
      try {
        const promise = turnService.triggerManualEffect(playerId, key);
        // Poll for pending choice — triggerManualEffect sets awaitingChoice
        // synchronously inside createChoice before the promise hangs.
        // Poll up to 50ms (10 × 5ms) to be safe across environments.
        for (let wait = 0; wait < 10; wait++) {
          const choice = stateService.getGameState().awaitingChoice;
          if (choice && choice.type !== 'MOVEMENT' && choice.options.length > 0) {
            const pick = choice.options[Math.floor(Math.random() * choice.options.length)];
            choiceService.resolveChoice(choice.id, pick.id);
            break;
          }
          await new Promise((r) => setTimeout(r, 5));
        }
        // Await with a 10s timeout to prevent hanging if choice was never resolved.
        // Also race the abort signal so a wall-clock cap kicks in immediately.
        // Listener is explicitly removed in finally to avoid accumulating handlers
        // on a long-lived signal (one per effect × per turn would otherwise leak
        // hundreds of listeners and trigger MaxListenersExceededWarning).
        let abortHandler: (() => void) | undefined;
        const abortPromise = new Promise((_, reject) => {
          if (signal?.aborted) {
            reject(new Error('aborted by wall-clock signal'));
            return;
          }
          abortHandler = () => reject(new Error('aborted by wall-clock signal'));
          signal?.addEventListener('abort', abortHandler);
        });
        try {
          await Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(
              `triggerManualEffect(${key}) timed out after 10s — choice may not have been resolved`
            )), 10000)),
            abortPromise
          ]);
        } finally {
          if (abortHandler) signal?.removeEventListener('abort', abortHandler);
        }
        const pp = stateService.getPlayer(playerId);
        const w = pp?.hand?.filter((c: string) => c.startsWith('W')).length ?? 0;
        trail.push(`  triggered(${key}) → hand=${pp?.hand?.length ?? 0}(W=${w})`);
      } catch (e: any) {
        trail.push(`  trigger(${key}) FAILED: ${e?.message || e}`);
      }
    }
  }
}

function collectDestinations(movement: any): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const d = movement[`destination_${i}`];
    if (d) out.push(d);
  }
  return out;
}

function safeGetPlayerSpace(stateService: any): string | undefined {
  try {
    const players = stateService.getAllPlayers();
    return players[0]?.currentSpace;
  } catch {
    return undefined;
  }
}

/**
 * Run N games back-to-back, each with a fresh service bootstrap, and return
 * aggregate results. Fresh bootstrap per game is the safe default — it
 * prevents state bleed between games at the cost of a small perf hit.
 */
export async function runGhostBatch(
  gameCount: number,
  options: GhostGameOptions = {}
): Promise<{
  total: number;
  wins: number;
  failures: GhostGameResult[];
  avgTurns: number;
  longGames: number;
}> {
  const failures: GhostGameResult[] = [];
  let wins = 0;
  let totalTurns = 0;
  let longGames = 0;
  const LONG_GAME_THRESHOLD = 60;

  // Per-game wall-clock cap. playOneGame is cancellation-aware via the
  // AbortSignal — when the timer fires, the next yield point returns a
  // TURN_CAP fail and the game's CPU loop actually stops (unlike a naive
  // Promise.race which only resolves the race but leaves playOneGame running
  // in the background). 30s is generous: normal games finish in ~4s.
  const PER_GAME_TIMEOUT_MS = 30000;

  for (let i = 0; i < gameCount; i++) {
    const services = await bootstrapHeadlessServices();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_GAME_TIMEOUT_MS);
    let result: GhostGameResult;
    try {
      result = await playOneGame(services, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    totalTurns += Math.max(0, result.turns);
    if (result.success) {
      wins++;
      if (result.turns > LONG_GAME_THRESHOLD) {
        longGames++;
        console.warn(`⚠️ Long game #${i + 1}: ${result.turns} turns (possible loop). Final space: ${result.finalSpace}`);
      }
    } else {
      failures.push(result);
    }
  }

  return {
    total: gameCount,
    wins,
    failures,
    avgTurns: totalTurns / gameCount,
    longGames,
  };
}
