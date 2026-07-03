# Next session starter — written 2026-07-02 by /koniec

## State at handoff
- **Version:** v3.0.92 — committed + pushed, **PENDING DEPLOY** (deploy command handed to user at wrap-up; ghost gate PASSED so it's cleared to ship).
- **Branch:** master, clean apart from `.claude/settings.local.json`.
- **Last shipped:** bankruptcy **loss screen** (was a blank page), "$X **deficit**" cash cue (funding-gap aware), end-turn button shows "this turn: 🕐+Xd · 💰−$Y", **contractor redesign** — price 72–150% of estimate (was 6–90%), schedule 8–78 days at signing, unpayable contract = bankruptcy (`contractorTerms.ts` is the one math home).
- **Test suite:** targeted sweep 1772/1772 (+13 new); typecheck + build clean.
- **Ghost gate:** ALL THREE 50-game batches passed on the new economy — smart-bot 50/50, avgTurns improved 83.6 → 66.6, 0 hard failures.

## Top 3 open items
1. **Deploy v3.0.92 + playtest the contractor economy** — real-priced bids + schedules change game feel a lot; watch whether the deficit cue actually steers players to raise before hiring, and whether bankruptcies feel fair or brutal.
2. **Medium tier:** Chronicle "Turn ended/started" ordering + turn dividers (fb:1eff7156); dark-mode/contrast sweep for the V2 modals; action-count off-by-one (fb:65160c0c — needs a repro WITH the space name; engine and panel agreed on every space checked 2026-07-02, notes in TODO).
3. **Dashboard PATCH sweep** — flip `resolved:true` for: 9c110d52, 8d68ab14, 222cd521, 1990c71e (older) + this session's 40caa223, 06f7da3b, b53864af, plus the playtest pair (loss screen / funding gap) if they were filed as reports.

## Decisions waiting on the user
- None — this session CLOSED the open ones: loans don't bankrupt (repayment is post-scope; deadline+TCO parked), low cash is OK, "deficit" wording chosen.

## Suggested first move
Deploy v3.0.92 (it's a live-default-game economy change — the loss screen + real contractor pricing genuinely want a human playtest), then play one game to the contractor and go broke on purpose to feel the new failure arc. Or pick up the Chronicle ordering item if you'd rather code first. Which?

## Reminders
- Deploy from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Commit + push BEFORE deploy (done this session).
- Contractor knobs live at the top of [src/utils/contractorTerms.ts](../src/utils/contractorTerms.ts) (base bid 0.7, 10 days/roll-point, quality 0.9/1.0/1.15 price × 1.3/1.0/0.8 speed) — tune there if the playtest says too harsh/soft, then re-run ghost.
- Memory-graph session entity NOT written (memory MCP disconnected mid-wrap) — next session can add `Session 2026-07-02 (v3.0.92)` if it matters.
