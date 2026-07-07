# Next session starter — written 2026-07-07 by /koniec, updated 2026-07-07 post-deploy

## State at handoff
- **Version:** v3.0.98 — **deployed and verified live 2026-07-07** (deployed bundle confirms `version:"3.0.98"`, `gitCommit:"7ed1dbf"`, matching HEAD exactly — no drift).
- **Branch:** master, clean (both session commits pushed).
- **Last shipped:** Live-playtested the new-panel-as-default experience as both players in a real 2-player game and found + fixed 4 real bugs (fundingAmount template, missing NPC portraits, uncollapsed effects list, player-order "rolodex"). Then worked through the design backlog directly with the user: closed the maintainer's Action/Outcome question (a real data gap, not intentional simplification), modal chrome polish, movement-option collapse, a 30-card Life Event narration rewrite, board discipline labels, and real drag-overlap prevention on the board editor. Full detail in CHANGELOG v3.0.98.
- **Test suite:** 2339/2340 passing, 1 skipped. Full vitest looked hung on the known Windows ghost-test gate but was just slow (~25 min) — finished clean.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Bank/Investor/Lender have no character entry** — the board's new discipline labels (v3.0.98) fall back to phase-only for 6 spaces (Bank, Investor, Lender, PM's own decision point, Cheat/Bypass, Finish) because the game has never defined an NPC for those characters anywhere in the codebase. User is explicitly marinading on whether to invent names/colors for them — don't nudge, wait for them to bring it back up.
2. **Board-editor drag-overlap fix needs a real mouse-drag confirmation** — verified via 6 unit tests + code review only; synthetic pointer events don't register with React Flow's drag system in browser automation, so nobody has watched it happen live yet.
3. **Remaining design backlog from the "New-panel playtest" TODO section** — three items never got to this session: expeditors shouldn't be offered before they'd actually help (design call), the outcome modal doesn't show which work packages changed, and the bigger "plan-examiner verdict + DOB/FDNY approval moment" feature (paired together, genuinely a new modal to build, not a quick fix). See TODO.md.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** (see item 1 above) — parked at the user's request, no urgency.

## Suggested first move
Ask which of the 3 remaining design-backlog items (expeditor timing, outcome-modal scope changes, or the plan-examiner-verdict feature) to tackle, since none of them were prioritized this session. If the user's had a chance to drag tiles in the Board Layout Editor, confirm the overlap-prevention feels right (item 2) — the only piece of this session's work not yet watched live.

## Test failures to address
(None — suite is green.)

## Suggested model for next session
**Sonnet 5.** Nothing in the top 3 is long-horizon or architecturally ambiguous — the remaining backlog items are scoped feature/polish work matching this session's pace.

## Reminders
- Deploy runs from a **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **Verifying a live deploy's version:** the server's `/health` endpoint reports a generic `"version":"dev"` regardless of build — fetch the built JS bundle and grep it for the version/commit strings baked in via Vite's `define` instead.
- **Local dev server never loads `.env`** (no dotenv, no `--env-file`) — it's Docker-only. To test admin/teacher features locally, pass `ADMIN_PASSWORD_HASH` as a real env var to `node server/server.js`, not via `.env`. See CLAUDE.md TACTICAL for the full note.
- **Synthetic PointerEvents don't drive React Flow's drag system** — if you need to verify board-tile drag behavior (e.g. confirm the overlap-resolution feature with a real drag), it needs an actual mouse action; scripted `dispatchEvent` calls silently no-op. See CLAUDE.md TACTICAL.
