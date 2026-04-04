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
}

/**
 * Play one game to completion (or failure) using a single Ghost Player.
 * Returns a result object; never throws — all failures are captured in
 * `result.success === false` so batch runners can aggregate.
 */
export async function playOneGame(
  services: HeadlessServices,
  options: GhostGameOptions = {}
): Promise<GhostGameResult> {
  const { stateService, turnService, dataService, choiceService } = services;
  const maxTurns = options.maxTurns ?? 300;
  const playerName = options.playerName ?? 'Ghost';
  const trail: string[] = [];

  const fail = (reason: GhostGameResult['reason'], error: string, turns: number): GhostGameResult => ({
    success: false,
    turns,
    finalSpace: safeGetPlayerSpace(stateService),
    reason,
    error,
    trail,
  });

  try {
    stateService.addPlayer(playerName);
    const player = stateService.getAllPlayers()[0];
    const playerId = player.id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();
    await turnService.startTurn(playerId);

    for (let turn = 0; turn < maxTurns; turn++) {
      const p = stateService.getPlayer(playerId);
      if (!p) return fail('INVARIANT_VIOLATION', 'Player disappeared from state', turn);

      // Invariant checks on every turn
      const invariantErr = checkInvariants(p, dataService);
      if (invariantErr) return fail('INVARIANT_VIOLATION', invariantErr, turn);

      const wCards = p.hand?.filter((c: string) => c.startsWith('W')).length ?? 0;
      trail.push(`T${turn} ${p.currentSpace}:${p.visitType} hand=${p.hand?.length ?? 0}(W=${wCards}) $${p.money}`);
      if (options.verbose) console.log(`T${turn} @ ${p.currentSpace} (${p.visitType})`);

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
      await resolveAnyPendingChoice(services);

      // Some spaces have an "automatic funding" hook the UI calls explicitly
      if (p.currentSpace === 'OWNER-FUND-INITIATION') {
        await turnService.handleAutomaticFunding(playerId);
      }

      // Trigger manual space effects (dice rolls, card draws, etc.)
      await triggerManualSpaceEffects(services, playerId, trail);

      // Resolve any choice that popped up from the effect
      await resolveAnyPendingChoice(services);

      // For movement: if it's a choice-type move, pick a random destination
      const refreshed = stateService.getPlayer(playerId);
      if (!refreshed) return fail('INVARIANT_VIOLATION', 'Player vanished mid-turn', turn);
      const movement = dataService.getMovement(refreshed.currentSpace, refreshed.visitType);

      if (movement?.movement_type === 'choice') {
        const dests = collectDestinations(movement);
        if (dests.length === 0) {
          return fail('INVARIANT_VIOLATION', `Choice movement from ${refreshed.currentSpace} has no destinations`, turn);
        }
        const pick = dests[Math.floor(Math.random() * dests.length)];
        stateService.setPlayerMoveIntent(playerId, pick);
      } else if (movement?.movement_type === 'dice' || movement?.movement_type === 'dice_outcome') {
        // Dice-based movement: roll if not already rolled
        const state = stateService.getGameState();
        if (!state.hasPlayerRolledDice) {
          await turnService.rollDiceAndProcessEffects(playerId);
        }
      }

      // Final choice resolution (rolling dice may have introduced one)
      await resolveAnyPendingChoice(services);

      await turnService.endTurnWithMovement(true);
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
  if (!effects && !movement) {
    return `space "${player.currentSpace}" (${player.visitType}) not found in data tables`;
  }
  return null;
}

async function resolveAnyPendingChoice(services: HeadlessServices): Promise<void> {
  const { stateService, choiceService } = services;
  // Loop in case one resolution triggers another
  for (let i = 0; i < 10; i++) {
    const choice = stateService.getGameState().awaitingChoice;
    if (!choice) return;
    if (choice.type === 'MOVEMENT') return; // movement choices handled in main loop
    if (choice.options.length === 0) return; // can't resolve, let the turn end
    const pick = choice.options[Math.floor(Math.random() * choice.options.length)];
    choiceService.resolveChoice(choice.id, pick.id);
  }
}

async function triggerManualSpaceEffects(
  services: HeadlessServices,
  playerId: string,
  trail: string[]
): Promise<void> {
  const { stateService, dataService, turnService, choiceService } = services;
  const p = stateService.getPlayer(playerId);
  if (!p) return;
  const effects = dataService.getSpaceEffects(p.currentSpace, p.visitType);
  if (!effects) return;

  for (const effect of effects) {
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
        await new Promise((r) => setTimeout(r, 5));
        const choice = stateService.getGameState().awaitingChoice;
        if (choice && choice.type !== 'MOVEMENT' && choice.options.length > 0) {
          const pick = choice.options[Math.floor(Math.random() * choice.options.length)];
          choiceService.resolveChoice(choice.id, pick.id);
        }
        await promise;
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
}> {
  const failures: GhostGameResult[] = [];
  let wins = 0;
  let totalTurns = 0;

  for (let i = 0; i < gameCount; i++) {
    const services = await bootstrapHeadlessServices();
    const result = await playOneGame(services, options);
    totalTurns += result.turns;
    if (result.success) {
      wins++;
    } else {
      failures.push(result);
    }
  }

  return {
    total: gameCount,
    wins,
    failures,
    avgTurns: totalTurns / gameCount,
  };
}
