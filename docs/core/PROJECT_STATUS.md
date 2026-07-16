# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 15, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.142** — **shipped, pending deploy** (v3.0.141 deployed, commit `8b5bf45`, confirmed by maintainer).

## Current sprint
**2026-07-15 — a real-hardware TV bug-triage thread, driven entirely by live maintainer testing.** The maintainer tested last session's TV-mode fix (v3.0.135–137) on a real 75" Hisense 4K TV and reported back across several rounds. Found and fixed, in order: the TV setup screen's 4 player tiles didn't fit without scrolling (root cause: a `vh`-vs-zoom-compensation mismatch plus a grid-packing bug that let a tile's QR silently double-wrap under its name); a foreign-game text alert falsely firing on the maintainer's own PC (residential IPv6 has no NAT, so exact-IP comparison can never match — fixed to compare by /64 network prefix); the same TV misdetected as a phone twice over (`isPhoneScreen()`'s short-side heuristic and `detectDeviceType()`'s bare-`Android` regex both fired on TV-specific traits neither had accounted for); a stuck-loading screen with no feedback (some TV browsers hang rather than error, and there's no dev console on a TV — added a 10-second visible hint suggesting an alternate browser). Once the TV's *real* logical resolution came in via feedback metadata (960×540 — half of what the first round was tested against), the player tile itself was redesigned: dropped the always-visible 8-swatch color picker for a single tap-to-cycle dot, which is what actually closed the fit gap. Full detail in CHANGELOG v3.0.138–142.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2374/2375 passing, 1 skipped, 0 failures** as of the last full run (699s), all 5 ghost simulation gates green.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.0.141, confirmed by maintainer 2026-07-15. **v3.0.142 shipped, pushed, NOT yet deployed** — it's the fix that actually closes the TV-fit thread; see NEXT_SESSION.md "Flip after deploy" for the 4 fb-ids waiting on that deploy.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.142, then flip 4 dashboard reports resolved** (fb:3f9f2831, fb:e121c34e, fb:dca292b8, fb:28512320) — code fixes are done and verified via live DOM measurement at the TV's actual 960×540 resolution; just needs the deploy + PATCH sweep.
2. **CSV-portability lift** (ApprovalService.ts + characters.ts + theme.ts) — scoped 2026-07-12, ~half a day; blocks the maintainer's long-term content-only reskin goal. Not touched this session.
3. **Architecture parking lot (all trigger-gated, not urgent)** — TurnService is a confirmed 2191-line/16-method orchestrator worth eventually splitting into a staged pipeline (also serves the maintainer's D&D-reskin reuse goal); PlayerSetup.tsx is a confirmed 2090-line monolith (this session's TV work touched it directly — a decomposition would make future TV-mode changes easier to reason about); a domain-event architecture (building on the already-present `StateService.subscribe()` foundation) is the most interesting long-term direction but needs a dedicated design pass before any engineering.
