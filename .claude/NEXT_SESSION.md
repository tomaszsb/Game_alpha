# Next session starter — written 2026-07-11 by /koniec

## State at handoff
- **Version:** v3.0.111 built, **v3.0.108 deployed** (commit `aa11433`, confirmed by maintainer 2026-07-10). v3.0.109–111 pushed to master, awaiting the next `deploy.sh` run.
- **Branch:** master, clean after this session's wrap-up commit.
- **Last shipped:** v3.0.111 — "Funding raised" redefined to exclude the owner's own seed money (maintainer-directed), keeping a separate `totalCapital` internally so the funding-gap and low-cash warnings still measure against every real dollar.
- **Test suite:** **2358/2359 passing, 1 skipped, 0 failures** (654.71s / ~11 min full run).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Blind code review batch (2026-07-11) — now triaged WITH maintainer rulings, ready to fix.** Biggest: `StateService.advanceTurn` only bumps the deprecated `turn` field in a no-current-player fallback branch normal play never hits, so `turn` stays 0 forever → duration cards never expire (stay "active" forever, keep counting toward scope) + wrong turn numbers recorded in 3 services. Also: the missing-DOB end-game penalty is unreachable (lives only in a dead `endTurn()` nothing calls), and expeditor "replace" permanently leaks cards out of the pool. All findings file:line-cited in TODO.md "🔎 Active — bugs & investigations" (+4 code-health bundles in the parking lot). **Maintainer ruled 2026-07-11:** (a) NO turn limit — delete `checkTurnLimit` + turn-limit branch, don't fix; (b) replaced/used cards must land in the discard pile and wait until the deck is exhausted (reshuffle-on-empty already correct — the bug is replaced cards never reach the pile); (c) timed life events tick on the holder's OWN turn only — "3 turns" = 3 of *your* turns (Option B; exact change spelled out in the TODO item on `processActiveEffectsForAllPlayers`). **Static-analysis findings, not live-reproduced — verify with a real repro before fixing.** Start with the `turn`/`globalTurnCount` one; highest-leverage single fix.
2. **Deploy v3.0.109–111**, then flip the 3 queued dashboard reports in `.claude/fixloop/flip-queue.txt` (share button, game-setup layout fix, funding-raised redefinition).
3. **Push-back/Lock-the-scope buttons don't preview cost before pressing** (fb:feedback-1783080349985-a3dc215f) — real feature work: needs a dry-run cost-preview computation for dice-based actions (which have random outcomes) plus the specific 2-column/5-row UI layout the player requested. Not a scoped bug fix — needs a deliberate build session.

## Test failures to address
(None — full suite green, 2358/2359 passing, 1 pre-existing skip.)

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange once in the editor (drag-save persists now).
- **Bank/Investor/Lender character naming** — 6 spaces show phase-only labels; user is marinading. **Don't nudge.**
- **Workstream 2 / v3.0.0 criterion** — snapshot Try Again was to *replace* REAL/TEMP entirely; they coexist. Tighten the criterion or do the replacement?
- **dictionary-scraper stack: `ANTHROPIC_API_KEY` blank** — compose warns on every `up`. Intentional? Ask before fixing.

## Flip after deploy
- fb:feedback-1783230681607-5e05dc1f (share button), fb:feedback-1782833653490-5470235b (game-setup dead space/scrollbar/phone warning), fb:feedback-1783081115822-cac490a5 (funding raised) — all fixed in v3.0.109–111; PATCH resolved once that range is confirmed live. Recipe + token location in TODO.md.

## Suggested first move
Triage the blind-code-review batch first — reproduce the `turn`-counter bug live (start a game, check whether `turn` ever moves, whether a duration card ever actually expires) before touching anything, since the review itself wasn't live-verified. If confirmed, it's a good `/loop /fixloop` candidate (scoped, file:line-cited, verifiable by test). Deploy v3.0.109–111 can happen any time in parallel — it's just waiting on the user running `deploy.sh`.

## Suggested model for next session
**Sonnet 5** for the deploy/dashboard/feature-build items. For the blind-review batch, item 1 (`turn` counter) touches 6 files across StateService/CardService/GameRulesService/MovementService/EffectEngineService/ResourceService — if the live repro confirms it's real, consider **Opus 4.8** for that specific fix given the cross-service blast radius, even though the diagnosis itself is already scoped and file-cited.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- `/loop /fixloop` now defaults to fetching a dashboard report's actual screenshot before landing a fix — a session this cycle fixed one blind, misdiagnosed it, and silently regressed an already-fixed bug. See CLAUDE.md TACTICAL "Fixing a dashboard report blind."
- Fixloop budget meter drifts ~5-10pts behind the official `/usage` % over a long session (phone/work-machine usage this machine can't see) — recalibrate with `/fixloop calibrate <pct>` whenever the user reports a mismatch.
