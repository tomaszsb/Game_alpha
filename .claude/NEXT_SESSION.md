# Next session starter — written 2026-07-10 by /koniec

## State at handoff
- **Version:** v3.0.100 — **deployed 2026-07-10** (commit `8929371`), no drift.
- **Branch:** master, clean (wrap-up commit pending — step 5c of this run).
- **Last shipped:** process session, no app change — v3.0.100 deployed + verified, 20 dashboard reports flipped (53→33 open), TODO slimmed 306→152, **autonomous fix loop built and calibrated** (`/loop /fixloop`), session SSH key to unraid installed, `/challenge` iPhone-verified + QR codes printed. Detail: CHANGELOG [Ops] 2026-07-10.
- **Test suite:** typecheck + build clean. Full suite not run (zero game-source changes this session); baseline 2340/2341 passing, 1 skipped (2026-07-09).

## Top 3 open items
1. **Launch the fix loop** — fresh session on **Sonnet 5**, auto-accept edits, type `/loop /fixloop`. Calibrated: Monday 7am reset, 19% used at day 5 (cap 71.25%) as of 2026-07-10. It picks one bug per iteration, routes the cheapest capable model, verifies, commits, pushes.
2. **6x duplicate `subscribeToAutoActions` firing** — every auto-action event fires 6× instead of once (fresh-session reproducible). Harmless today (idempotent handlers); investigation candidates in TODO. Good Opus/Fable escalation target for the loop.
3. **8 newly-staged dashboard reports** (July 3–5, mostly v3.0.93) in TODO "Newly arrived" — untriaged; the loop's natural food.

## Decisions waiting on the user
- Board layout (stock grid vs re-arrange); Bank/Investor/Lender naming (**don't nudge**); Workstream 2 v3.0.0 criterion; `ANTHROPIC_API_KEY` blank in dictionary-scraper stack.

## Flip after deploy
(None pending — 2026-07-10 sweep flipped all fixed-and-deployed ids. Fix-loop fixes queue in `.claude/fixloop/flip-queue.txt` for after the next deploy.)

## Suggested first move
Launch the fix loop (item 1). If working manually instead, pick from the 8 newly-staged reports or the 6x-subscription investigation.

## Suggested model for next session
**Sonnet 5** — the loop orchestrator should be cheap (its own tokens count against the budget); heavy reasoning is dispatched per-task via the Agent tool.

## Reminders
- Deploy runs from a Windows terminal: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` — user-run only. `ssh unraid` is now passwordless from session shells (use `-o BatchMode=yes`).
- If the user used Claude on phone/work machine, re-anchor the budget meter: `/fixloop calibrate <pct>` with the official /usage number.
- After the next deploy: flip the ids in `.claude/fixloop/flip-queue.txt` (recipe in TODO.md).
