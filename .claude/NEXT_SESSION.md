# Next session starter — written 2026-07-17 by /koniec

## State at handoff
- **Version:** v3.1.4 **shipped, deployed, confirmed live** (commit `695aef0`, verified via the live JS bundle's embedded version string).
- **Branch:** master, clean (only pre-existing `.claude/settings.local.json` uncommitted — not part of this session's work).
- **Last shipped:** `PlayerSetup.tsx` decomposition — closed the architecture parking-lot item flagged in the prior two sessions' handoffs. 2166 lines → a 673-line orchestrator plus 8 new focused files (`PlayerSetup.styles.ts`, `PlayerMobileView.tsx`, `useAdminAuth.ts`, `AdminGameManager.tsx`, `ModeToggle.tsx`, `JoinByCodePanel.tsx`, `GameSettingsPanel.tsx`, `AdminToolsPanel.tsx`), following the `setup/` folder's existing one-concern-per-file convention. Planned via `EnterPlanMode` + a `Plan` subagent design review before touching code; each of the 9 extraction steps was checked with typecheck + build + a live browser click-through (admin login/lock, the 5s game-list poll starting/stopping on mount/unmount, PC/TV/Remote toggling, join-by-code both with and without an existing roster, modal wiring, a full Start Game click into the live PLAY phase). Full detail in CHANGELOG v3.1.4.
- **Test suite:** **2375/2380 passing, 1 skipped, 4 failures — all confirmed non-regressions** (746s). 3 are the pre-existing `E2E-AllPaths.test.ts` intermittent timeout under load (different random sub-test failed on re-run in isolation — tracked in TODO.md's parking lot since 2026-07-13); the 4th (`gameLogic.test.ts` performance benchmark) passed cleanly alone. Neither file has any connection to this session's changes.
- **Build/typecheck:** clean.
- **Dashboard:** not swept this session (no `fb:` reports were involved — this was a proactive architecture task, not a bug fix).

## Top 3 open items
1. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding from two sessions ago; this repo's embedded browser can't play animated camera transitions at all (throttles animation frames), so it was verified via unit tests + state instrumentation, not a watched animation. A glance on the maintainer's real TV (zoom should stay put between moves) is the honest final check — not blocking, just unverified live.
2. **Domain event architecture** — the most interesting long-term direction (per the 2026-07-14 external review), needs a dedicated design pass before any engineering. Full framing in TODO.md's Architecture/code-health parking lot.
3. **Nothing else blocking.** Pick from TODO.md's other Active sections (playtester acquisition screenshot carousel/demo video, dark/light mode coverage beyond `PlayerPanelV2`, dashboard `version`/`gitCommit` display) or the parking lot.

## Decisions waiting on the user
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.
- **Homeowner starting scenario** — direction decided, needs a design pass on the mechanic itself.

## Suggested first move
Nothing is blocking. Either open with the 2-minute real-TV camera check (closes out item 1), or pick a fresh item from TODO.md's Active sections — the domain-event architecture idea is the biggest available direction if a dedicated design session is wanted.

## Suggested model for next session
**Sonnet 5** — normal scoped work; nothing in the top-3 is architecturally ambiguous enough to need Opus.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- If doing live browser verification of a multi-step edit again: this session found the embedded Browser pane's `read_console_messages` replays stale errors from earlier failed-HMR states across navigations — trust `get_page_text`/`read_page` over the console log. Also, local admin-unlock testing (`sessionStorage.setItem('admin_authenticated','true')`) surfaces `BoardToggle`, a fixed-position admin widget that overlaps the setup screen's gear icon — click by DOM query, not screen coordinate, when admin UI is showing. Both now in CLAUDE.md TACTICAL.
