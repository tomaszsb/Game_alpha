# Next session starter — written 2026-07-17 by /koniec

## State at handoff
- **Version:** v3.1.3 **shipped, deployed, confirmed live by maintainer** (commit `c4471b3`).
- **Branch:** master, clean (only pre-existing session-state files uncommitted — `.claude/fixloop/*`, `.claude/settings.local.json` — not part of this session's work).
- **Last shipped:** two planned architecture items, then a reactive TV bug-fixing tail. CSV-portability lift (v3.1.0) closed all 5 real-world-hardcoding blockers from the 2026-07-12 audit (approval-gate space roles, NPC-speaker mapping, card-type labels, work-scope card flags, tiered-loan-fee detection) — all CSV-driven now, current-game behavior verified identical. TurnService split (v3.1.1) dropped from 2191 to 1159 lines via two new extracted modules (`TurnEffectsOrchestrator`, `ManualActionProcessor`), `ITurnService` contract unchanged. Then two fresh dashboard reports arrived from the maintainer's own TV playtest same session: the TV camera re-zoomed on every player move (now fits once, pans-only after — v3.1.2), plus a newly-found bug where PC-mode's "remember my zoom" had never actually worked (fixed same version); also added 3 direct-pick color dots to the TV tile. A live-playtest report ("why won't it start") led to v3.1.3: a visible banner + relabeled Start button naming which players still need to scan their QR code. Full detail in CHANGELOG v3.1.0–3.1.3.
- **Test suite:** **2378/2380 passing, 1 skipped, 1 known-flaky failure** (622s, all 5 ghost gates green). The 1 failure is `E2E-AllPaths.test.ts`'s pre-existing intermittent timeout under full-suite load (tracked in TODO.md parking lot since 2026-07-13) — confirmed passing in isolation this same session, not a new regression.
- **Build/typecheck:** clean.
- **Dashboard:** both reports from this session's TV work flipped resolved (fb:2b5b9f2a, fb:daf6b7fc) once v3.1.0–3.1.3 deploy was confirmed → 27 open. Not otherwise swept (no monthly trigger, not `/start full`).

## Top 3 open items
1. **Real-TV confirmation of the camera fix.** This session's embedded Browser-pane preview can't play animated camera transitions at all (throttles animation frames — React Flow's `fitView()` promise never settles there; see CLAUDE.md TACTICAL). The pan-only TV camera behavior was verified via unit tests + live state instrumentation, never a watched animation. A glance on the maintainer's real TV (zoom should stay put between moves now) is the honest final check — not blocking, just unverified live.
2. **Architecture parking lot, all trigger-gated** — PlayerSetup.tsx (~2100 lines, touched directly again this session for the QR-waiting banner) worth decomposing; a domain-event architecture remains the most interesting long-term direction but needs a dedicated design pass first. TurnService is off this list now — split completed v3.1.1.
3. **Nothing else blocking.** Pick from the parking lot, or from TODO.md's other Active sections (playtester acquisition screenshot carousel/demo video, dark/light mode coverage beyond PlayerPanelV2, dashboard `version`/`gitCommit` display).

## Decisions waiting on the user
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.
- **Homeowner starting scenario** — direction decided, needs a design pass on the mechanic itself.

## Suggested first move
Nothing is blocking. Either open with a quick real-TV check of the camera fix (2 minutes, closes out item 1 above), or pick a fresh item — the async/decoupled turn order idea is now unblocked by the CSV-portability lift shipping, if that's of interest.

## Suggested model for next session
**Sonnet 5** — normal scoped work; nothing in the top-3 is architecturally ambiguous enough to need Opus.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- This session's embedded browser cannot verify animated transitions (camera pans/zooms, CSS-duration moves) — don't spend time trying; read final state instead and flag animation-dependent fixes as needing a real-device check. See CLAUDE.md TACTICAL ("embedded browser throttles animation frames").
- If touching TV-mode UI again: don't assume 1920×1080 is a safe floor. A real TV reported 960×540 last week. Design/test down to that size when it matters.
