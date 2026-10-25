// RepService - the reps you hold (BETA_PLAN_V3.md, N3 item 2 "reps you hold, with a salary").
//
// A rep is a person on the player's team who is GOOD or BAD at ONE area (Code, Permits, Inspections).
// Everything here goes through the player's TEMP state, so a push-back takes back what the turn changed.
//   hire / fire      the player's own choice, any time on their turn (the Expeditors page)
//   onArrival        a held rep shortens (good) or lengthens (bad) every visit to its area; then the
//                    1-in-20 roll, at most once per rep per 7 days: a good rep asks for a raise or quits,
//                    a bad rep causes a stop work order (a paid 3-way choice)
//   settleAtEndTurn  the salary, for whole weeks passed, taken at End Turn; a player who cannot pay picks who goes
//
// The numbers, names and prices are in REPS.csv (utils/repRules.ts). The held roster is `player.reps`
// (optional: saves from before reps hold none). Each pop-up is one choice; a robot has no screen, so with
// `autoDecide` on it answers by the rules in repRules.ts instead.

import type { IStateService, IDataService, ILoggingService, IChoiceService } from '../types/ServiceContracts';
import type { HeldRep, Player } from '../types/DataTypes';
import type { ResourceService } from './ResourceService';
import {
  getRepRules, getRepDef, repAreaOf, newHeldRep, salaryDue, salaryOnLeaving, visitShift, repsDueForRoll, rollHits,
  raiseAccepted, raisedSalary, pickOffers, stopWorkOptions, robotStopWork, weeklyPay, RepAreaWords,
  type RepDef, type RepArea,
} from '../utils/repRules';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const firstName = (name: string) => name.split(' ')[0];

export type RepMoment = 'hire' | 'fire' | 'raise' | 'raise_result' | 'stop_work' | 'stop_result' | 'unpaid' | 'info';

export class RepService {
  /** True for a robot (no screen): every pop-up is answered by the rules below instead of waiting for a click. */
  public autoDecide = false;
  /** Random numbers, replaceable in tests. */
  public rng: () => number = () => Math.random();

  constructor(
    private stateService: IStateService,
    private dataService: IDataService,
    private choiceService: IChoiceService,
    private resourceService: Pick<ResourceService, 'recordCost'>,
    private loggingService: ILoggingService,
  ) {}

  // ---------- reading ----------

  getReps(playerId: string): HeldRep[] {
    return this.stateService.getPlayer(playerId)?.reps ?? [];
  }

  /** The held reps with their names, areas and good/bad, for the Team list. */
  describe(playerId: string): Array<HeldRep & { def: RepDef }> {
    return this.getReps(playerId).flatMap(h => {
      const def = getRepDef(h.id);
      return def ? [{ ...h, def }] : [];
    });
  }

  weeklyPay(playerId: string): number {
    return weeklyPay(this.getReps(playerId));
  }

  // ---------- asking the player ----------

  /** One pop-up: the player's pick, or the robot's pick by `robot`. */
  private async ask(
    playerId: string,
    moment: RepMoment,
    prompt: string,
    options: Array<{ id: string; label: string }>,
    robot: (opts: Array<{ id: string; label: string }>) => string,
  ): Promise<string> {
    if (this.autoDecide) return robot(options);
    try {
      const picked = await this.choiceService.createChoice(playerId, 'GENERAL', prompt, options);
      this.stateService.clearAwaitingChoice({ keepMovement: true });
      return picked && options.some(o => o.id === picked) ? picked : (robot(options));
    } catch {
      return robot(options);
    }
  }

  // ---------- hire and fire ----------

  /**
   * The player asks to hire: three reps are shown one at a time and the player keeps none, one, two or all three.
   * Hiring starts the clock today (no back pay). Returns the reps hired.
   */
  async hire(playerId: string): Promise<RepDef[]> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return [];
    const offers = pickOffers((player.reps ?? []).map(r => r.id), this.rng);
    const hired: RepDef[] = [];
    for (let i = 0; i < offers.length; i++) {
      const def = offers[i];
      const answer = await this.ask(
        playerId,
        'hire',
        `Hire ${def.name}? ${def.blurb} ${RepAreaWords[def.area] ? `Works your ${def.area.toLowerCase()} stops.` : ''} ${money(def.salary)} per week. (${i + 1} of ${offers.length})`,
        [{ id: 'hire', label: `Hire ${firstName(def.name)} — ${money(def.salary)} a week` }, { id: 'pass', label: 'Not this one' }],
        () => 'pass',
      );
      if (answer !== 'hire') continue;
      const now = this.stateService.getPlayer(playerId);
      if (!now) break;
      const today = now.timeSpent ?? 0;
      this.stateService.updateTempState(playerId, { reps: [...(now.reps ?? []), newHeldRep(def, today)] });
      hired.push(def);
      this.loggingService.info(`${now.name} hired ${def.name} (${def.area.toLowerCase()}), ${money(def.salary)} a week.`, {
        playerId, playerName: now.name, action: 'rep_hired',
      });
    }
    return hired;
  }

  /** The player lets a rep go (free; what they are owed up to today is paid first). Asks which when several. */
  async fire(playerId: string, repId?: string): Promise<boolean> {
    const player = this.stateService.getPlayer(playerId);
    const reps = player?.reps ?? [];
    if (!player || reps.length === 0) return false;
    let target = repId;
    if (!target) {
      const options = reps.map(h => {
        const def = getRepDef(h.id);
        return { id: h.id, label: `${def?.name ?? h.id} (${(def?.area ?? '').toLowerCase()})` };
      });
      options.push({ id: 'keep', label: 'Keep the whole team' });
      target = await this.ask(playerId, 'fire', 'Let a team member go? They are paid for the days worked.', options, () => 'keep');
    }
    if (!target || target === 'keep') return false;
    this.removeRep(playerId, target, 'let go');
    return true;
  }

  /** Takes a rep off the team after paying what they are owed to date. */
  private removeRep(playerId: string, repId: string, why: 'let go' | 'quit' | 'unpaid'): void {
    const player = this.stateService.getPlayer(playerId);
    const held = player?.reps?.find(r => r.id === repId);
    if (!player || !held) return;
    const def = getRepDef(repId);
    const owed = why === 'unpaid' ? 0 : salaryOnLeaving(held, player.timeSpent ?? 0);
    if (owed > 0) this.pay(playerId, owed, `${def?.name ?? 'Team member'}: pay up to today`);
    const left = this.stateService.getPlayer(playerId);
    this.stateService.updateTempState(playerId, { reps: (left?.reps ?? []).filter(r => r.id !== repId) });
    this.loggingService.info(
      why === 'let go' ? `${player.name} let ${def?.name ?? 'a team member'} go.`
        : why === 'quit' ? `${def?.name ?? 'A team member'} left the team.`
          : `${player.name} could not pay ${def?.name ?? 'a team member'} and let them go.`,
      { playerId, playerName: player.name, action: 'rep_left' },
    );
  }

  /** Rep pay and stop-work payments: the "Team" line, counted toward On budget. May leave cash below zero; the bankruptcy check is separate. */
  private pay(playerId: string, amount: number, description: string): void {
    if (amount <= 0) return;
    this.resourceService.recordCost(playerId, 'team', amount, description, 'rep_pay', true);
  }

  // ---------- on arrival ----------

  /**
   * Called once each time a player arrives and the space's own effects have run.
   * Returns a one-line summary of what the reps did (for tests and the log).
   */
  async onArrival(playerId: string): Promise<string[]> {
    const lines: string[] = [];
    const player = this.stateService.getPlayer(playerId);
    if (!player || !player.reps || player.reps.length === 0) return lines;
    const space = player.currentSpace;
    const area = repAreaOf(space);
    if (!area) return lines;

    // 1. Shorter or longer visits.
    const visitDays = this.visitDays(space, player.visitType);
    const shift = visitShift(player.reps, space, visitDays);
    if (shift.delta !== 0) {
      const now = this.stateService.getPlayer(playerId);
      this.stateService.updateTempState(playerId, { timeSpent: Math.max(0, (now?.timeSpent ?? 0) + shift.delta) });
      const names = [...shift.helped, ...shift.hurt].map(id => firstName(getRepDef(id)?.name ?? ''));
      const line = shift.delta < 0
        ? `${names.join(' and ')} saved ${-shift.delta} days at this stop.`
        : `${names.join(' and ')} added ${shift.delta} days at this stop.`;
      lines.push(line);
      this.loggingService.info(line, { playerId, playerName: player.name, action: 'rep_visit', area });
    }

    // 2. The 1-in-20 roll: each rep in this area, at most once per 7 days.
    const today = this.stateService.getPlayer(playerId)?.timeSpent ?? 0;
    for (const h of repsDueForRoll(this.getReps(playerId), area, today)) {
      this.stampRoll(playerId, h.id, today);
      if (!rollHits(this.rng)) continue;
      const def = getRepDef(h.id);
      if (!def) continue;
      lines.push(def.sign === 'good' ? await this.goodRepQuits(playerId, h.id) : await this.stopWork(playerId, h.id, area));
      // The days the event itself took must not count toward the 7 before the next roll.
      this.stampRoll(playerId, h.id, this.stateService.getPlayer(playerId)?.timeSpent ?? today);
    }
    return lines;
  }

  /** The days a visit to this space costs by its own rules (auto "time add" rows), so a good rep cannot take off more. */
  private visitDays(space: string, visit: Player['visitType']): number {
    const effects = this.dataService.getSpaceEffects(space, visit) ?? [];
    return effects
      .filter(e => e.effect_type === 'time' && (e.effect_action ?? '').toLowerCase() === 'add')
      .reduce((s, e) => s + (parseFloat(String(e.effect_value)) || 0), 0);
  }

  private stampRoll(playerId: string, repId: string, today: number): void {
    const reps = this.getReps(playerId).map(r => r.id === repId ? { ...r, lastRollDay: today } : r);
    this.stateService.updateTempState(playerId, { reps });
  }

  // ---------- a good rep asks for a raise ----------

  private async goodRepQuits(playerId: string, repId: string): Promise<string> {
    const rules = getRepRules();
    const def = getRepDef(repId)!;
    const rep = this.getReps(playerId).find(r => r.id === repId)!;
    const out = rules.rules.raise_out_of || 4;
    const options = [
      ...rules.raises.map(r => {
        const next = raisedSalary(rep.salary, r.pct);
        return { id: `raise${r.pct}`, label: `Offer ${r.pct}% more: ${money(next)} a week (${r.accept} chance${r.accept > 1 ? 's' : ''} in ${out})` };
      }),
      { id: 'letgo', label: `Let ${firstName(def.name)} go` },
    ];
    const pick = await this.ask(
      playerId,
      'raise',
      `${def.name} says other firms are calling and is ready to leave. Offer a raise, or let them go?`,
      options,
      // The robot takes the biggest raise on offer: it is the one most likely to keep a good rep.
      opts => opts.filter(o => o.id.startsWith('raise')).slice(-1)[0]?.id ?? 'letgo',
    );
    if (pick === 'letgo') {
      this.removeRep(playerId, repId, 'quit');
      return `${def.name} left the team.`;
    }
    const pct = parseInt(pick.replace('raise', ''), 10);
    if (raiseAccepted(pct, this.rng)) {
      const reps = this.getReps(playerId).map(r => r.id === repId ? { ...r, salary: raisedSalary(r.salary, pct) } : r);
      this.stateService.updateTempState(playerId, { reps });
      const msg = `${firstName(def.name)} said yes: ${money(raisedSalary(rep.salary, pct))} a week now.`;
      await this.tell(playerId, 'raise_result', msg);
      return msg;
    }
    this.removeRep(playerId, repId, 'quit');
    const msg = `${firstName(def.name)} said no and left.`;
    await this.tell(playerId, 'raise_result', msg);
    return msg;
  }

  /** One line the player reads and clears; a robot just goes on. */
  private async tell(playerId: string, moment: RepMoment, text: string): Promise<void> {
    await this.ask(playerId, moment, text, [{ id: 'ok', label: 'OK' }], () => 'ok');
  }

  // ---------- a bad rep causes a stop work order ----------

  private async stopWork(playerId: string, repId: string, area: RepArea): Promise<string> {
    const def = getRepDef(repId)!;
    const player = this.stateService.getPlayer(playerId)!;
    const goodInArea = (player.reps ?? []).find(h => {
      const d = getRepDef(h.id);
      return d && d.area === area && d.sign === 'good';
    });
    const cash = player.money ?? 0;
    const opts = stopWorkOptions(!!goodInArea, cash);
    const why: Record<RepArea, string> = {
      Code: 'a design code error: new drawings are needed',
      Permits: 'a filing mistake',
      Inspections: 'a missed inspection sign-off',
    };
    const goodDef = goodInArea ? getRepDef(goodInArea.id) : undefined;
    const labels: Record<string, string> = {
      a: `${goodDef ? firstName(goodDef.name) : 'Your best rep'} expedites it: ${money(opts.find(o => o.id === 'a')?.cost ?? 0)}, ${opts.find(o => o.id === 'a')?.days ?? 0} days`,
      b: `${firstName(def.name)} fixes it: ${money(opts.find(o => o.id === 'b')?.cost ?? 0)}, ${opts.find(o => o.id === 'b')?.days ?? 0} days`,
      c: `Do it yourself: ${money(opts.find(o => o.id === 'c')?.cost ?? 0)}, ${opts.find(o => o.id === 'c')?.days ?? 0} days`,
    };
    const pick = (await this.ask(
      playerId,
      'stop_work',
      `Stop work order: ${why[area]}. ${firstName(def.name)} made the mistake. How do you get it lifted?`,
      opts.map(o => ({ id: o.id, label: labels[o.id] })),
      () => robotStopWork(opts, cash),
    )) as 'a' | 'b' | 'c';
    const chosen = opts.find(o => o.id === pick) ?? opts[opts.length - 1];
    this.pay(playerId, chosen.cost, `Stop work order lifted (${area.toLowerCase()})`);
    const now = this.stateService.getPlayer(playerId);
    this.stateService.updateTempState(playerId, { timeSpent: (now?.timeSpent ?? 0) + chosen.days });
    const msg = `Stop work order lifted: ${money(chosen.cost)} and ${chosen.days} days.`;
    this.loggingService.info(msg, { playerId, playerName: player.name, action: 'rep_stop_work', area });
    return msg;
  }

  // ---------- the salary, at End Turn ----------

  /**
   * Takes the pay owed for whole weeks passed. A player who cannot cover it picks who goes (the one let go is not paid);
   * salary alone never puts a player out of the game. Returns the total taken.
   */
  async settleAtEndTurn(playerId: string): Promise<number> {
    let player = this.stateService.getPlayer(playerId);
    if (!player || !player.reps || player.reps.length === 0) return 0;
    const today = player.timeSpent ?? 0;
    const owed = () => (this.stateService.getPlayer(playerId)?.reps ?? []).reduce((s, h) => s + salaryDue(h, today).amount, 0);

    // Who can be afforded: while the bill is more than the cash, someone goes.
    for (let guard = 0; guard < 20; guard++) {
      player = this.stateService.getPlayer(playerId)!;
      const bill = owed();
      const cash = Math.max(0, player.money ?? 0);
      const payable = (player.reps ?? []).filter(h => salaryDue(h, today).amount > 0);
      if (bill <= cash || payable.length === 0) break;
      const options = payable.map(h => {
        const d = getRepDef(h.id);
        return { id: h.id, label: `${d?.name ?? h.id}: ${money(salaryDue(h, today).amount)}` };
      });
      const goes = await this.ask(
        playerId,
        'unpaid',
        `The team's pay is ${money(bill)} and you have ${money(cash)}. Who do you let go?`,
        options,
        // The robot lets the dearest go first.
        opts => opts[0]?.id ?? '',
      );
      if (!goes) break;
      this.removeRep(playerId, goes, 'unpaid');
    }

    let taken = 0;
    const reps = this.getReps(playerId);
    const settled: HeldRep[] = [];
    for (const h of reps) {
      const due = salaryDue(h, today);
      if (due.amount > 0) {
        this.pay(playerId, due.amount, `${getRepDef(h.id)?.name ?? 'Team member'}: ${due.weeks} week${due.weeks > 1 ? 's' : ''} of pay`);
        taken += due.amount;
        settled.push({ ...h, salaryBilledThroughDay: h.salaryBilledThroughDay + due.weeks * (getRepRules().rules.week_days || 7) });
      } else settled.push(h);
    }
    if (settled.length > 0 || reps.length > 0) {
      const after = this.stateService.getPlayer(playerId);
      // Keep any rep removed above out; re-stamp the billed-through days of those still held.
      const still = new Set((after?.reps ?? []).map(r => r.id));
      this.stateService.updateTempState(playerId, { reps: settled.filter(r => still.has(r.id)) });
    }
    if (taken > 0) {
      this.loggingService.info(`Team pay: ${money(taken)}.`, { playerId, playerName: player.name, action: 'rep_pay' });
    }
    return taken;
  }
}
