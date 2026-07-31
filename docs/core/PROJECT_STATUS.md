# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 31, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.80** — **deployed and verified live** 2026-07-31 (bundle-grepped: live `index-*.js` embeds `"3.1.80"` and commit `5eba257`, current master HEAD). Covers the clipboard-copy fix, CSP/HSTS/Permissions-Policy headers, dead-code cleanup, and the `set-state-in-effect` refactor.

## Current sprint
**2026-07-31 — resolved the `set-state-in-effect` warning the 2026-07-29 audit deliberately left as "its own project."** Researched the rule properly first (React's own docs, the `useSyncExternalStore` migration path, a live upstream false-positive report) rather than guessing, then read all 34 flagged sites individually — the original 9/3/22 estimate undersold the real split. 16 got a real fix: ~7 "subscribe to store" sites moved to a new `useSyncedGameState` hook wrapping `StateService` in `useSyncExternalStore`; ~7 "state that's just a copy of a prop" sites moved to render-time computation. `GameLayout`'s biggest site also had real per-turn notification-clearing logic bundled in — rewritten as a `useRef`-based transition detector, covered by 5 new dedicated tests since it had zero coverage before. The remaining 18 are individually documented, not left by default: `BoardCanvas`'s site is the exact fix for two previously-shipped bugs and stays untouched (a real architecture separation, not a pattern swap); the rest are genuine one-shot/timed/orchestration effects or lint false positives (checked each function body — 4 of 8 mount-load sites have no synchronous `setState` at all). Same session also: a full CSP/HSTS/Permissions-Policy header survey (real external-resource audit + live-browser verification, not headers added blind) and a small confirmed-dead-code cleanup.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2501 passed / 1 skipped / 0 failed** (170 files; the skip is pre-existing, +5 tests vs last session from the new `GameLayoutTransitionClear` file), ghost gates **33/33** (10 files, 573.83s). Both green.
- **Lint:** ✅ 0 errors, **37 warnings** (was 53) — 19 pre-existing `no-explicit-any` + **18 `set-state-in-effect`** (was 34), every remaining one now individually reasoned in `eslint.config.js` rather than a bare count. Still not in CI: this repo has no `.github/workflows/` at all.
- **E2E determinism:** decks are seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds.
- **Deploy:** live = commit `5eba257` (v3.1.80), verified 2026-07-31 by grepping the served bundle. (`/health`'s version field remains an unreliable "dev" placeholder — grep the bundle for the git commit.)
- **Dashboard feedback:** **7 open**, all tracked in TODO.md. `fb:89d83c39` (TV-mode glossary) and `fb:2948cf19` (clipboard-copy) both flipped resolved 2026-07-31 after this deploy confirmed live.
- **Live-verification gap:** `SpaceExplorerPanel` and `TVDisplay` got this session's refactor but couldn't be live-browser-verified (a narrow deep-link that didn't reproduce cleanly, and TV mode's real "all phones connect" hard-block respectively) — same pattern already proven live in six other components, plus clean typecheck, but worth a real playtest pass. See TODO.md.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Live-verify `SpaceExplorerPanel` and `TVDisplay` on real hardware.** Both got the `set-state-in-effect` refactor but couldn't be live-browser-verified this session — worth a real playtest pass before fully trusting.
2. **Player-to-player trading is fully built and unreachable** — unchanged. Needs a **card** written that hands something to another player (none of the 399 do today), *then* an action-list button. A top-bar button would permit off-turn trading, since the service has zero turn awareness.
3. **Homeowner violation mechanic — needs a real spec before engineering.** Unchanged: the maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session design work, not code.
