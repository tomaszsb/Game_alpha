# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 18, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.16** — **deployed + confirmed live 2026-07-18** (header shows `v3.1.16 · 9095413`, built from HEAD, zero behind). The batch shipped: v3.1.11 fixed the `npm test` "hang" (test-infra only); v3.1.12–15 cover dark/light mode for all three card-play modals + BoardCanvas chrome; v3.1.16 adds Chronicle inline deltas + fixes a real card_draw formatting bug. Same day: full docs-vs-code sweep (4 docs archived), 6 stranded worktrees removed, `settings.local.json` untracked (root-cause fix).

## Current sprint
**2026-07-18 (continued) — dark-mode coverage sweep + a real formatting bug found along the way.** An autonomous `/loop /fixloop` session picked up after the v3.1.10 handoff. Root-caused the `npm test` "hang" (v3.1.11) — the ghost regression gates were silently in the fast config, not a deadlock. Then three modal dark-mode slices (`ChoiceModal`, `CardReplacementModal`, `CardDetailsModal`, v3.1.12–14), each copying the `DiceResultModal` pattern exactly. Audited `TVDisplay` and correctly declined to force the pattern onto it — it's a top-level route with no toggle ever reaching the shared TV device, a maintainer decision not a code fix. `BoardCanvas` (v3.1.15) got a narrower, more careful slice: only genuine chrome (canvas fill, tile surface, text) themed, phase/validity/status colors deliberately left alone since they're game-state signals. Final iteration (v3.1.16) scoped TODO's Project Chronicle P1 down to just "inline deltas per entry" and found the delta feature had a bug blocking it entirely — the card_draw formatter read the wrong field name (`cardCount` vs the real `count`), so the nicely-formatted log line had never fired in production.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2356/2358 passing, 1 skipped, 1 failure** — the 1 failure is `E2E-AllPaths.test.ts`'s pre-existing documented scheduling flake (passes in isolation). `/koniec` pre-flight full-suite result below (see wrap line).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = **v3.1.16** (`9095413`), confirmed 2026-07-18.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Real-TV checks** — the v3.1.2 camera fix confirmation + a quick look at the new dark-mode slices, now that v3.1.16 is live on the physical TV.
2. **TVDisplay dark mode — needs a maintainer decision**, not a code fix (audited 2026-07-18): does a shared, across-the-room TV screen even want a dark toggle, and who would operate it?
3. **Story authoring** — ~90 never-merged narratives sit in `narratives-draft.md` (found in the 2026-07-18 docs sweep); needs a voice-rule pass before merge.
