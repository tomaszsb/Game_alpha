# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 30, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.76** — app code **deployed and verified live** 2026-07-30 (served bundle embeds commit `81c259f`). The version *bump* landed after that deploy, so production currently self-reports `3.1.75 (81c259f)`; the label corrects itself on the next deploy. See Deploy below.

## Current sprint
**2026-07-30 — "finish the lint burn-down" turned out to be the wrong question.** 62 warnings remained, both rules documented as deliberate. The finding that mattered wasn't in the list: **`npm run lint` had only ever covered `src/`** — the twelve hard-error rules promoted over v3.1.66–75 guarded about a third of the code, and the entire Express server (auth guards, mailer, instance storage, WebSocket layer) had never been linted once. It looked unlintable only because plain-JS files inherited no globals, so `console`/`process` were "undefined" **156 times in `server/` alone**, burying 6 real findings. **Coverage 202 → 227 files.** One of those six was a parameter that looks deletable but isn't: Express identifies error-handling middleware *by arity*, so removing the unused `next` would have silently stopped every 500 from returning JSON. Re-auditing `no-explicit-any` (28 → 19) found "all intentional" true of only about half — **three of the nine removed were hiding real defects**, including a `remoteConfig` `TypeError` that escaped its own catch block instead of falling back to bundled defaults.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2497 passed / 1 skipped / 0 failed** (169 files; the skip is pre-existing), ghost gates **33/33** (567.71s). Both green.
- **Lint:** ✅ 0 errors, **53 warnings** (was 62), now across **227 files instead of 202** — `src` + `server` + `scripts` + `sw.js`. Twelve rules held at zero as hard errors, and verified by probe that a real error in `server/` exits 1 rather than being ignored. What remains is deliberate: **34 `set-state-in-effect`** (all audited; clearing them is a `useSyncExternalStore` refactor, not a sweep) and **19 `no-explicit-any`** — the latter now a recorded **decision to stay `warn` permanently**, not a backlog, split into permanent platform casts, honest free-form bags, and two items that are real work but not lint work. Still not in CI: this repo has no `.github/workflows/` at all.
- **Measured, so it doesn't get re-litigated:** a `src` file has 115 active rules, a `server` file 61 — and the 56-rule difference is **100% TypeScript and React rules**, i.e. inapplicable to plain JS, not missing strictness.
- **E2E determinism:** decks are seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds. Last session's unidentified single-test flake did **not** recur this session.
- **Deploy:** live = commit `81c259f`, verified 2026-07-30 by grepping the served bundle. `deploy.sh`'s image-ID verification fired and passed (`OK — running 81c259f`) — its **second** clean run since v3.1.75 closed the container-recreate race. (`/health`'s version field remains an unreliable "dev" placeholder — grep the bundle for the git commit, especially when a version bump lands after a deploy, as it did again here.)
- **Dashboard feedback:** **8 open**, all 8 already tracked in TODO.md — nothing untracked. Only `fb:2948cf19` (clipboard-copy the game code, 2026-07-27) is recent unstarted work; `fb:ae480630` is open by choice; the other 6 are long-tracked Parking-lot items.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Copy the game code to the clipboard when the restart banner shows it** (`fb:2948cf19`) — the only recent dashboard report that's real unstarted work. Small and self-contained; a tap-to-copy button is the safer shape than an automatic write, since `navigator.clipboard` can reject without a user gesture.
2. **Player-to-player trading is fully built and unreachable** — unchanged. Needs a **card** written that hands something to another player (none of the 399 do today), *then* an action-list button. A top-bar button would permit off-turn trading, since the service has zero turn awareness.
3. **Homeowner violation mechanic — needs a real spec before engineering.** Unchanged: the maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session design work, not code.
