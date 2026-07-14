# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 14, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.137** — **deployed 2026-07-14** (commit `c6e516c`, confirmed by maintainer).

## Current sprint
**2026-07-14 — dashboard feedback → classic-panel removal → board camera → architecture review triage.** A 3-round footer-toggle refinement driven by live maintainer playtesting settled the fb:f453b1f3 A/B experiment (separate buttons vs. a merged press-and-hold control) on the merged control as the clear winner. That decision then unlocked the big item: the classic `ActionCenterPanel` panel — retained since the player-panel redesign as a compare-against-old-behavior toggle — was deleted entirely (~7000 net lines: the panel, 8 exclusive section components, CSS, tests), along with the winning control being unified across light and dark mode (previously dark-mode-only). Separately: two dashboard reports about the TV-mode setup screen ("resolution is crap," "can't go back up") led to a real fix — 10-foot-UI zoom scaling plus actual keyboard/remote scroll handling (the prior fix only made the scrollbar visible, never scrollable by a remote). A maintainer-forwarded "house standard" review of board-scaling practices led to space-size-aware camera zoom + per-device viewport memory for the game board. Session closed by triaging a second maintainer-forwarded review (an external read of the CHANGELOG only, no code access) — several findings held up against the real code, one was already stale by the time it was raised. Full detail in CHANGELOG v3.0.128–137.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2343/2344 passing, 1 skipped, 0 failures** as of the last full run (628s), all 5 ghost simulation gates green.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.0.137, confirmed by maintainer 2026-07-14. Dashboard PATCH sweep run same day: fb:f453b1f3 + fb:7dbc2fcc flipped resolved (28 open remain). fb:3f9f2831/fb:e121c34e deliberately NOT flipped — need real-TV confirmation, not just deploy confirmation.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **TV-mode fix needs real hardware confirmation** (fb:3f9f2831/e121c34e) — best-effort code fix already live in v3.0.137, just unverified on an actual smart TV.
2. **CSV-portability lift** (ApprovalService.ts + characters.ts + theme.ts) — scoped 2026-07-12, ~half a day; blocks the maintainer's long-term content-only reskin goal. Not touched this session.
3. **Architecture parking lot (all trigger-gated, not urgent)** — TurnService is a confirmed 2191-line/16-method orchestrator worth eventually splitting into a staged pipeline (also serves the maintainer's D&D-reskin reuse goal); PlayerSetup.tsx is a confirmed 2090-line monolith; a domain-event architecture (building on the already-present `StateService.subscribe()` foundation) is the most interesting long-term direction but needs a dedicated design pass before any engineering.
