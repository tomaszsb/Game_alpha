# Next session starter — written 2026-07-25 by /koniec

## State at handoff
- **Version:** v3.1.31 — **pushed to origin/master, pending deploy.** Live/deployed is v3.1.29 (`1c2130a`, bundle-confirmed live 2026-07-24). 8 commits/2 versions ahead of what's deployed.
- **Branch:** master, clean.
- **Last shipped:** opened by discovering 9 real commits (3 security fixes + TV/compat fixes + an admin stats page) had shipped without ever running `/koniec` — reconciled CHANGELOG/package.json against `git log` (v3.1.21–23), fixed the version badge's own sync-check bug found in the process (v3.1.24). Then ran `/loop /fixloop` through the whole 2026-07-21 Playwright playtest batch: fixed a board-copy templating bug, a duplicate log line, a log-ordering bug, solo-game card copy on "High-Profile Client" (+ found its "other players" effect was never actually implemented — new TODO decision item), a Game Log grammar bug, a stale test assertion, and removed `#error-fallback` from the DOM until a real failure occurs. 4 of the LOW playtest items turned out to be automation-observation artifacts, not real bugs (player-name persistence, cost-strip text spacing, first-page-load 404, REGULATORY/REGULATORY_REVIEW naming) — verified live, documented, no code needed. New CLAUDE.md TACTICAL entry captures the artifact-vs-real-bug pattern for future sessions. Mid-session: fixloop's budget meter was recalibrated against the official `/usage` reading — the local tracker had been overestimating the weekly budget by ~11x ($2284 vs. the real $202.89); headroom is now correctly tracked at a much tighter margin (32.6% left as of this write-up).
- **Test suite:** fast suite 2445/2447 (1 pre-existing skip, 1 known `E2E-Multiplayer2P` scheduling flake under full-suite load — confirmed non-regression, passes in isolation, same root cause as the existing `E2E-AllPaths` flake already tracked in TODO.md) + ghost gates 33/33 (all four 50-game batches passed, 0 hard failures, 575s).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.1.31** — 8 commits sitting pushed but undeployed, including 2 carried-over security fixes from before this session even started. Deploy command in Reminders below.
2. **Real-TV checks + TVDisplay dark-mode decision** — still outstanding from before this session (untouched again this session): confirm the v3.1.2 camera feel and dark-mode slices on a real TV, and decide whether the shared TV screen wants a dark toggle at all.
3. **Remaining fixloop backlog is now mostly maintainer-decision items, not blind-fixable bugs** — "Unify press-and-hold commit implementations" (needs scoping), 3 naming reconciliations (Glossary/Dictionary, Rules/Game Rules, PM Check across surfaces — light decisions), funding-gap number reconciliation + "Funding raised" definition (needs a semantics call), and the High-Profile Client mechanic-vs-copy decision from this session. Fixloop can keep grinding through the naming ones, but the funding/mechanic ones genuinely need your input first.

## Decisions waiting on the user
- **Board layout** — keep stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 2.
- **High-Profile Client (L021)** — build the missing "+1 day to other players" mechanic, or permanently rewrite the card to only describe what it actually does (see TODO.md, v3.1.28 CHANGELOG entry).
- **Two funding-number items** — reconcile the top-bar/sidebar funding-gap denominators, and pick one definition of "Funding raised" (currently inconsistent across surfaces).

## Suggested first move
Deploy v3.1.31 first (item 1) — it's been sitting 2 versions behind live since before this session started, and includes real security fixes. Then either keep fixloop grinding the naming-reconciliation backlog, or spend time on the real-TV check that's been waiting the longest.

## Suggested model for next session
Sonnet 5 — the remaining backlog is either straightforward naming/scoping work or needs your decision, not deep architectural judgment. Budget headroom is tighter now (32.6%, day-cap-gated) than earlier this week — recalibrate against `/usage` again if it's been a few days.

## Reminders
- Deploy from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The deploy's `git pull` will delete the server's copy of `.claude/settings.local.json` — expected and harmless.
- Dashboard PATCH-flip calls: issue one at a time, not in a shell loop (see CLAUDE.md TACTICAL).
- Fixloop budget meter can drift far from reality across a multi-device week — recalibrate early with `node scripts/fixloop-usage.mjs --calibrate <official %>` rather than trusting the local estimate (see CLAUDE.md TACTICAL, this session's ~11x correction).
