# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 16, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.3** — **shipped, deployed, confirmed live by maintainer** (commit `c4471b3`).

## Current sprint
**2026-07-16 — two planned architecture items, then a reactive TV bug-fixing tail.** Picked the CSV-portability lift (v3.1.0) and a TurnService split (v3.1.1) as the session's "hard items": all 5 real-world-hardcoding blockers from the 2026-07-12 audit are now CSV-driven (approval-gate space roles, NPC-speaker mapping, card-type labels, work-scope card flags, the tiered-loan-fee detection), and TurnService dropped from 2191 to 1159 lines via two new extracted modules. Two fresh dashboard reports then arrived from the maintainer's own TV playtest and were fixed same-session: the TV camera was re-zooming on every player move (now fits once, then pans-only at whatever zoom is active — v3.1.2), plus a newly-found bug where PC-mode's "remember my zoom" feature had never actually worked; also added 3 direct-pick color dots to the TV player tile. A live-playtest report (real players stuck at "why won't it start") then led to v3.1.3: a visible banner + relabeled Start button naming which players still need to scan their QR code, replacing a tooltip nobody on a TV could see. Full detail in CHANGELOG v3.1.0–3.1.3.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2378/2380 passing, 1 skipped, 1 known-flaky failure** (622s; the pre-existing `E2E-AllPaths.test.ts` intermittent timeout under full-suite load, tracked in TODO.md — confirmed passing in isolation this same session). All 5 ghost simulation gates green.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.1.3, confirmed by maintainer 2026-07-16/17. No pending deploy.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Real-TV confirmation of the camera fix** — this session's embedded browser can't play animated camera transitions at all (throttles animation frames), so the pan-only TV camera behavior was verified via unit tests + live state instrumentation, not a watched animation. A glance on the maintainer's real TV (zoom should stay put between moves) is the honest final check.
2. **Architecture parking lot (trigger-gated, not urgent)** — PlayerSetup.tsx is still a ~2100-line monolith (edited directly again this session for the QR-waiting banner, not decomposed); a domain-event architecture remains the most interesting long-term direction but needs a dedicated design pass before any engineering.
3. **Nothing else blocking** — v3.1.0–3.1.3 are deployed and confirmed, both dashboard reports from the TV session are flipped resolved (29→27 open), full test suite result pending this session's background run (see NEXT_SESSION.md).
