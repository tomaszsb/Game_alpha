# Next session starter — written 2026-07-12 by /koniec

## State at handoff
- **Version:** v3.0.120 built, **v3.0.115 deployed** (commit `b46cb30`, confirmed by maintainer 2026-07-12). v3.0.116–120 pushed to master, awaiting the next `deploy.sh` run.
- **Branch:** master, clean after this session's wrap-up commit.
- **Last shipped:** v3.0.120 — closes the entire 10-item 2026-07-11 blind code review batch (v3.0.112–120). Biggest: timed life events now tick only on the effect holder's own turn (previously ticked on every turn end, burning a "3-turn" event out within one table round), which surfaced and required fixing a genuine pre-existing TEMP/REAL staleness bug (see CLAUDE.md TACTICAL).
- **Test suite:** 2368/2369 passing, 1 skipped, 0 failures as of the last confirmed run this session (commit `157b385`); a fresh pre-flight re-run was in progress at handoff — if it hasn't posted results by the time you read this, re-run `npx vitest run` to confirm (nothing has changed source-wise since 157b385, so it should match).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.116–120**, then run the standard dashboard PATCH sweep for anything closed by this batch (none of the 10 blind-review items were dashboard-sourced reports, so likely nothing to flip — double-check `.claude/fixloop/flip-queue.txt`, which is empty as of this session).
2. **Push-back/Lock-the-scope buttons don't preview cost before pressing** (fb:feedback-1783080349985-a3dc215f) — real feature work: needs a dry-run cost-preview computation for dice-based actions (which have random outcomes) plus the specific 2-column/5-row UI layout the player requested. Not a scoped bug fix — needs a deliberate build session.
3. **New starting scenario: cash-strapped homeowner facing a Notice of Violation** — direct player comment logged 2026-07-12 (TODO.md "Decisions waiting on the user"). Needs a maintainer scope call before any content/engine work: new selectable starting preset, different starting-money value, or a whole new narrative branch?

## Test failures to address
(None — full suite green as of the last confirmed run this session, 2368/2369 passing, 1 pre-existing skip. Re-verify with a fresh run if picking up mid-way.)

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange once in the editor (drag-save persists now).
- **Bank/Investor/Lender character naming** — 6 spaces show phase-only labels; user is marinading. **Don't nudge.**
- **Workstream 2 / v3.0.0 criterion** — snapshot Try Again was to *replace* REAL/TEMP entirely; they coexist. Tighten the criterion or do the replacement?
- **dictionary-scraper stack: `ANTHROPIC_API_KEY` blank** — compose warns on every `up`. Intentional? Ask before fixing.
- **New starting scenario for a cash-strapped homeowner** (item 3 above) — needs a scope decision, not code.

## Suggested first move
Get v3.0.116–120 deployed — nothing is blocking it, the batch is fully verified (full suite + all 5 ghost gates green). After that, the two open feature items (push-back cost preview, homeowner starting scenario) both need a scope/design decision from the maintainer before engineering starts — good candidates for a conversation rather than autonomous fixloop work.

## Suggested model for next session
**Sonnet 5** — nothing in the top-3 needs deep architectural judgment; the deploy is a human action, and both feature items need a scope decision before code work can even start.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- If touching anything in the TEMP/REAL turn-state system (`StateService`, `TurnStateManager`), read the new CLAUDE.md TACTICAL entry on `updateTempState`'s fallback path and `realStates` staleness first — it's a subtle trap and the fix pattern (write-side sync, never broaden what `createTempStateFromReal` reads) is spelled out there with the reasoning.
- Fixloop budget meter drifts behind the official `/usage` % over a long session — recalibrate with `/fixloop calibrate <pct>` whenever the user reports a mismatch.
