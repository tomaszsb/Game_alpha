// AutoRunService - the filing rep's run round the circle (BETA_PLAN_V3.md, N3 item 4).
//
// After the student is sent back twice in a row on the plan exam / architect / engineer circle, the next arrival at the
// first stop offers: play it yourself, or send the filing rep. The rep then walks ONE circle inside this player's turn,
// through the very same arrival / dice / fee / History code a hand-played turn uses (TurnService hops: leave, move,
// commit, arrive again, without handing the turn on). It stops AT the plan exam, whose verdict is the student's to take
// with End Turn, and one summary card reports the whole run.
//
//   GOOD rep   rolls the starting-up, fee and scope dice twice and keeps the better (fewer days, then lower fee,
//              then fewer work items; a tie keeps the first)
//   BAD rep    rolls once. No extra fee for either: only the normal rep salary for the days, paid by the usual End Turn code.
//
// The circle, and which stops get two rolls, are data (REPS.csv, utils/repRules.ts). The rules are pure and in utils/autoRunRules.ts.

import type { IStateService, IDataService, ILoggingService, IChoiceService, IMovementService } from '../types/ServiceContracts';
import type { Player, VisitType } from '../types/DataTypes';
import type { TurnEffectResult } from '../types/StateTypes';
import type { RepService } from './RepService';
import { isSkippableEffectAction } from '../utils/skippableActions';
import {
  circleRank, circleEnds, isSendBack, nextSendBackCount, shouldOffer, pickFilingRep, bestIndex, circleTwice,
  parseFeePct, itemsOfScopeCell, describeStep, describeTotal, type RollScore, type RunLine,
} from '../utils/autoRunRules';
import { getRepRules } from '../utils/repRules';

/** What the run needs from TurnService (kept narrow so there is no import cycle). */
export interface AutoRunTurnDriver {
  rollDiceWithFeedback(playerId: string, forcedRoll?: number): Promise<TurnEffectResult>;
  rollDiceAndProcessEffects(playerId: string, forcedRoll?: number): Promise<{ diceRoll: number }>;
  triggerManualEffect(playerId: string, effectType: string): Promise<unknown>;
  endTurnWithMovement(force?: boolean, skipAutoMove?: boolean, stayWithPlayer?: boolean): Promise<{ nextPlayerId: string }>;
}

/** ask = put the offer to the student; auto = a robot with a rep always sends it, without one plays by hand; never = off. */
export type AutoRunMode = 'ask' | 'auto' | 'never';

const MAX_HOPS = 20;
const OFFER_ID_HAND = 'hand';
const OFFER_ID_REP = 'rep';

export class AutoRunService {
  public mode: AutoRunMode = 'ask';
  /** Random numbers, replaceable in tests. Only the run itself ever draws from it. */
  public rng: () => number = () => Math.random();
  private running = false;
  private driver?: AutoRunTurnDriver;

  constructor(
    private stateService: IStateService,
    private dataService: IDataService,
    private choiceService: IChoiceService,
    private loggingService: ILoggingService,
    private repService: Pick<RepService, 'describe'>,
    private movementService: Pick<IMovementService, 'getValidMoves' | 'getDiceDestinationChoices'>,
  ) {}

  public setTurnDriver(driver: AutoRunTurnDriver): void {
    this.driver = driver;
  }

  public isRunning(): boolean {
    return this.running;
  }

  // ---------- the counter ----------

  /** Called by End Turn after a move. A send-back adds one, a pass clears it; anything else leaves it alone. */
  public noteMove(playerId: string, from: string | undefined, to: string | undefined): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return;
    const before = player.sendBackCount ?? 0;
    const after = nextSendBackCount(before, from, to);
    if (after !== before) this.stateService.updatePlayer({ id: playerId, sendBackCount: after });
  }

  // ---------- the offer ----------

  /** Called at the end of startTurn. Puts the offer when the student has been sent back often enough. */
  public async maybeOffer(playerId: string): Promise<void> {
    if (this.running || this.mode === 'never' || !this.driver) return;
    const player = this.stateService.getPlayer(playerId);
    if (!player || player.finishedAtTurn !== undefined || player.outReason) return;
    if (!shouldOffer(player.sendBackCount ?? 0, player.currentSpace, player.visitType)) return;

    const rep = pickFilingRep(this.repService.describe(playerId));
    if (this.mode === 'auto') {
      if (rep) await this.run(playerId);
      return;
    }

    const options = [
      { id: OFFER_ID_HAND, label: 'Play it yourself' },
      rep
        ? { id: OFFER_ID_REP, label: 'Send your filing rep' }
        : { id: OFFER_ID_REP, label: 'Send your filing rep', disabled: true, hint: 'Needs a filing rep' },
    ];
    let picked = OFFER_ID_HAND;
    try {
      picked = await this.choiceService.createChoice(
        playerId,
        'GENERAL',
        'The plan examiner has sent you back more than once. You can go round again yourself, or send your filing rep to run the whole round for you.',
        options,
        { kind: 'autorun_offer', title: 'Go round again?' },
      );
      this.stateService.clearAwaitingChoice({ keepMovement: true });
    } catch {
      return;
    }
    if (picked === OFFER_ID_REP && rep) await this.run(playerId);
  }

  // ---------- the run ----------

  public async run(playerId: string): Promise<void> {
    const driver = this.driver;
    const first = this.stateService.getPlayer(playerId);
    if (!driver || !first || this.running) return;
    const filing = pickFilingRep(this.repService.describe(playerId));
    if (!filing) return;
    const good = filing.good;
    const repName = filing.rep ? (this.repService.describe(playerId).find(r => r.id === filing.rep.id)?.def.name ?? 'Your filing rep') : 'Your filing rep';
    const { last } = circleEnds();

    this.running = true;
    const lines: RunLine[] = [];
    const startMoney = first.money;
    const startDays = first.timeSpent ?? 0;
    try {
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const player = this.stateService.getPlayer(playerId);
        if (!player) break;
        const here = player.currentSpace;
        const label = this.labelOf(here);
        const gs = this.stateService.getGameState();
        if (gs.isGameOver || player.outReason || player.finishedAtTurn !== undefined) break;

        // The plan exam: it has already looked at the filing on arrival. Its answer is the student's to take.
        if (here === last) {
          lines.push({ label, text: this.verdictText(player) });
          break;
        }

        const before = this.snapshot(player);
        const step = await this.playSpace(playerId, player, good);
        if (step.stop) {
          lines.push({ label, text: step.stop });
          break;
        }
        // The pick of where to go next counts as an action here, so it is made before the check below.
        if (!this.pickNextStop(playerId, here)) {
          lines.push({ label, text: 'stopped: the way on from here is your call' });
          break;
        }
        const gs2 = this.stateService.getGameState();
        if (gs2.requiredActions > gs2.completedActionCount) {
          lines.push({ label, text: 'stopped: there is something here that needs your own decision' });
          break;
        }

        const from = here;
        await driver.endTurnWithMovement(false, false, true);
        const after = this.stateService.getPlayer(playerId);
        if (!after) break;
        // The move may have gone somewhere off the circle (or a send-back count moved): the run only follows the circle.
        const d = this.diff(before, this.snapshot(after));
        lines.push({
          label,
          text: describeStep({ rolls: step.rolls, kept: step.kept, dMoney: d.money, dDays: d.days, dItems: d.items }),
        });
        this.loggingService.info(`${repName} ran ${label}: ${describeStep({ rolls: step.rolls, kept: step.kept, dMoney: d.money, dDays: d.days, dItems: d.items })}.`, {
          playerId, playerName: player.name, action: 'autorun_step', spaceName: from, visibility: 'player',
        });
        if (after.currentSpace !== undefined && circleRank(after.currentSpace) === undefined) {
          lines.push({ label: this.labelOf(after.currentSpace), text: 'the run ended here, off the circle' });
          break;
        }
      }
    } catch (error) {
      lines.push({ label: 'Stopped', text: error instanceof Error ? error.message : 'something went wrong' });
    } finally {
      this.running = false;
    }

    const end = this.stateService.getPlayer(playerId);
    const totalMoney = (end?.money ?? startMoney) - startMoney;
    const totalDays = (end?.timeSpent ?? startDays) - startDays;
    lines.push({ label: 'Total so far', text: describeTotal(totalMoney, totalDays) });
    await this.report(playerId, repName, good, lines);
  }

  // ---------- one stop ----------

  private async playSpace(
    playerId: string, player: Player, good: boolean,
  ): Promise<{ rolls?: number[]; kept?: number; stop?: string }> {
    const driver = this.driver!;
    const space = player.currentSpace;
    const visit = player.visitType;
    const twice = good && circleTwice(space);
    const out: { rolls?: number[]; kept?: number; stop?: string } = {};
    const effects = this.dataService.getSpaceEffects(space, visit) ?? [];

    for (const effect of effects) {
      if (effect.trigger_type !== 'manual' || effect.effect_type === 'turn') continue;
      if (effect.effect_type === 'dice') {
        if (this.stateService.getGameState().hasPlayerRolledDice) continue;
        const rolled = this.chooseRoll(space, visit, twice, false);
        out.rolls = rolled.rolls; out.kept = rolled.kept;
        await driver.rollDiceWithFeedback(playerId, rolled.forced);
      } else {
        if (isSkippableEffectAction(effect.effect_action)) continue;
        const stop = await this.runManual(playerId, `${effect.effect_type}:${effect.effect_action}`);
        if (stop) return { ...out, stop };
      }
    }

    const movement = this.dataService.getMovement(space, visit);
    if (movement?.movement_type === 'dice' || movement?.movement_type === 'dice_outcome') {
      if (!this.stateService.getGameState().hasPlayerRolledDice) {
        const rolled = this.chooseRoll(space, visit, twice, true);
        out.rolls = rolled.rolls; out.kept = rolled.kept;
        await driver.rollDiceAndProcessEffects(playerId, rolled.forced);
      }
    }

    const open = this.stateService.getGameState().awaitingChoice;
    if (open && open.type !== 'MOVEMENT') return { ...out, stop: 'stopped: a question here needs your own answer' };
    return out;
  }

  /** Runs one manual effect; returns a stop sentence when it opened a question only the student can answer. */
  private async runManual(playerId: string, key: string): Promise<string | undefined> {
    const done = this.driver!.triggerManualEffect(playerId, key).then(() => true, () => true);
    for (let wait = 0; wait < 12; wait++) {
      const open = this.stateService.getGameState().awaitingChoice;
      if (open && open.type !== 'MOVEMENT') return 'stopped: a question here needs your own answer';
      const finished = await Promise.race([done, new Promise<boolean>(r => setTimeout(() => r(false), 5))]);
      if (finished) return undefined;
    }
    const open = this.stateService.getGameState().awaitingChoice;
    return open && open.type !== 'MOVEMENT' ? 'stopped: a question here needs your own answer' : undefined;
  }

  /** The next circle stop: sets the player's move to it when the way on is a choice. False when there is no stop to go to. */
  private pickNextStop(playerId: string, here: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;
    const rankHere = circleRank(here) ?? 0;
    const moves = player.moveIntent ? [player.moveIntent] : this.movementService.getValidMoves(playerId);
    if (!moves || moves.length === 0) return false;
    const ahead = moves.filter(m => (circleRank(m) ?? 0) > rankHere).sort((a, b) => (circleRank(a) ?? 0) - (circleRank(b) ?? 0));
    if (player.moveIntent) return circleRank(player.moveIntent) !== undefined;
    if (moves.length === 1 && ahead.length === 1) return true;
    if (ahead.length === 0) return false;
    this.stateService.setPlayerMoveIntent(playerId, ahead[0]);
    return true;
  }

  // ---------- the better roll ----------

  private chooseRoll(space: string, visit: VisitType, twice: boolean, movement: boolean): { forced?: number; rolls?: number[]; kept?: number } {
    if (!twice) return {};
    const rolls = [this.d6(), this.d6()];
    const scores = rolls.map(r => this.scoreRoll(space, visit, r, movement));
    const kept = rolls[bestIndex(scores)];
    return { forced: kept, rolls, kept };
  }

  private d6(): number {
    return 1 + Math.floor(this.rng() * 6);
  }

  /** What a roll would cost at this stop, read from the dice tables. */
  private scoreRoll(space: string, visit: VisitType, roll: number, movement: boolean): RollScore {
    const score: RollScore = { days: 0, feePct: 0, items: 0 };
    const col = `roll_${roll}` as 'roll_1';
    const rows = this.dataService.getDiceEffects(space, visit) ?? [];
    for (const row of rows) {
      const cell = row[col];
      if (row.effect_type === 'money' && row.roll_action === 'fee') score.feePct += parseFeePct(cell);
      else if (row.effect_type === 'cards' && row.card_type === 'W') score.items += itemsOfScopeCell(cell);
      else if (/time/i.test(row.effect_type)) score.days += parseFloat(String(cell ?? '')) || 0;
    }
    if (movement) {
      const player = this.stateService.getGameState().players.find(p => p.currentSpace === space);
      const dests = this.movementService.getDiceDestinationChoices(space, visit, roll, player?.id);
      const onCircle = dests.filter(d => circleRank(d) !== undefined);
      const paths = (onCircle.length > 0 ? onCircle : dests).map(d => this.pathDays(d));
      if (paths.length > 0) score.days += Math.min(...paths);
    }
    return score;
  }

  /** Days still to spend from a stop to the plan exam: the stops left on the circle, each charged for its stay. */
  private pathDays(dest: string): number {
    const from = circleRank(dest);
    if (from === undefined) return 0;
    let days = 0;
    for (const c of getRepRules().circle) {
      if (c.rank < from) continue;
      const stay = this.dataService.getSpaceEffects(c.space, 'Subsequent') ?? [];
      for (const e of stay) {
        if (e.effect_type === 'time' && e.effect_action === 'add' && e.trigger_type === 'auto') days += Number(e.effect_value) || 0;
      }
    }
    return days;
  }

  // ---------- reading and saying ----------

  private snapshot(player: Player): { money: number; days: number; items: number } {
    return {
      money: player.money,
      days: player.timeSpent ?? 0,
      items: (player.hand ?? []).filter(c => this.dataService.isProjectScopeCard(c)).length,
    };
  }

  private diff(a: { money: number; days: number; items: number }, b: { money: number; days: number; items: number }) {
    return { money: b.money - a.money, days: b.days - a.days, items: b.items - a.items };
  }

  private labelOf(space: string): string {
    return this.dataService.getGameConfigBySpace(space)?.display_label_override
      || this.dataService.getSpaceContent(space, 'First')?.title
      || space;
  }

  private verdictText(player: Player): string {
    const dest = player.moveIntent;
    if (!dest) return 'the plan examiner is waiting on you';
    const place = this.labelOf(dest);
    if (isSendBack(player.currentSpace, dest)) {
      const n = (player.sendBackCount ?? 0) + 1;
      return `sent you back to ${place}. Press End Turn to go there (that is send-back number ${n})`;
    }
    return `passed. Press End Turn to go on to ${place}`;
  }

  private async report(playerId: string, repName: string, good: boolean, lines: RunLine[]): Promise<void> {
    if (this.mode === 'auto') return;
    const text = good
      ? `${repName} went round the circle for you, rolling twice at each architect and engineer stop and keeping the better.`
      : `${repName} went round the circle for you.`;
    try {
      await this.choiceService.createChoice(
        playerId,
        'GENERAL',
        text,
        [{ id: 'ok', label: 'OK' }],
        { kind: 'autorun_report', title: 'The round, done', lines },
      );
      this.stateService.clearAwaitingChoice({ keepMovement: true });
    } catch {
      /* the report is a courtesy; the History lines already hold everything */
    }
  }
}
