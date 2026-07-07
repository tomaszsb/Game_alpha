# Next session starter — written 2026-07-07 by /koniec

## State at handoff
- **Version:** v3.0.98 — **pending deploy** (committed + pushed to master; v3.0.97 is what's live in production).
- **Branch:** master, clean after this session's commits are pushed.
- **Last shipped:** Live-playtested the new-panel-as-default experience as both players in a real 2-player game and found + fixed 4 real bugs (fundingAmount template, missing NPC portraits, uncollapsed effects list, player-order "rolodex"). Then worked through the design backlog directly with the user: closed the maintainer's Action/Outcome question (a real data gap, not intentional simplification), modal chrome polish, movement-option collapse, a 30-card Life Event narration rewrite, board discipline labels, and real drag-overlap prevention on the board editor. Full detail in CHANGELOG v3.0.98.
- **Test suite:** typecheck ✅, build ✅. Full vitest hit the known Windows ghost-test hang after `coverage.test.ts` passed — fell back to the documented targeted sweep: **1806/1806 passing** (`tests/components/ tests/utils/ tests/services/`, 108 files). No new failures.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.98** — code is on master, ready to go; just needs `bash deploy.sh` run from a Windows terminal.
2. **Bank/Investor/Lender have no character entry** — the board's new discipline labels (v3.0.98) fall back to phase-only for 6 spaces (Bank, Investor, Lender, PM's own decision point, Cheat/Bypass, Finish) because the game has never defined an NPC for those characters anywhere in the codebase. User is explicitly marinading on whether to invent names/colors for them — don't nudge, wait for them to bring it back up.
3. **Remaining design backlog from the "New-panel playtest" TODO section** — three items never got to this session: expeditors shouldn't be offered before they'd actually help (design call), the outcome modal doesn't show which work packages changed, and the bigger "plan-examiner verdict + DOB/FDNY approval moment" feature (paired together, genuinely a new modal to build, not a quick fix). See TODO.md.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** (see item 2 above) — parked at the user's request, no urgency.

## Suggested first move
Confirm the deploy command with the user and have them run it — v3.0.98 has been sitting verified-but-undeployed since this session's wrap-up. After that, ask which of the 3 remaining design-backlog items (expeditor timing, outcome-modal scope changes, or the plan-examiner-verdict feature) to tackle, since none of them were prioritized this session.

## Test failures to address
(None — suite is green. See "Test suite" above for the one known Windows-only ghost-test hang, not a real failure.)

## Suggested model for next session
**Sonnet 5.** Nothing in the top 3 is long-horizon or architecturally ambiguous — deploy is mechanical, and the remaining backlog items are scoped feature/polish work matching this session's pace.

## Reminders
- Deploy command runs from a **Windows terminal**, not WSL — `bash deploy.sh` (never `docker compose up`).
- **Local dev server never loads `.env`** (no dotenv, no `--env-file`) — it's Docker-only. To test admin/teacher features locally, pass `ADMIN_PASSWORD_HASH` as a real env var to `node server/server.js`, not via `.env`. See CLAUDE.md TACTICAL for the full note.
- **Synthetic PointerEvents don't drive React Flow's drag system** — if you need to verify board-tile drag behavior (e.g. confirm the new overlap-resolution feature with a real drag), it needs an actual mouse action; scripted `dispatchEvent` calls silently no-op. See CLAUDE.md TACTICAL.
