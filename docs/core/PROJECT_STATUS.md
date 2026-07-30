# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 29, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.75** — app code **deployed and verified live** 2026-07-29 (served bundle embeds commit `a2fa541`). See Deploy below for the one part that isn't live.

## Current sprint
**2026-07-29 — the lint queue kept producing real bugs.** Lint went **113 → 62 warnings**, with `no-unused-vars` (41) and `exhaustive-deps` (10) both taken to zero and promoted to hard `error` (12 rules now, up from 10). The count is not the story: reviewing sites one at a time found a **stale-closure bug in the Back button** (the routing-explanation modal wasn't in its dependency array, so Back closed the wrong thing or left the game), a **card doing the opposite of its text** (E045 asked you to pick a rival, then sped *them* up 4 days), a **documented option that did nothing** (`skipLog`) guarded by a test that passed no matter what, and ~90 lines of dead classic-panel code. About half the `exhaustive-deps` sites were *suppressed with reasons* rather than fixed — following the rule there would have frozen the Start Game button and broken glossary underlines. A **deploy race** was also hit for real and fixed: `deploy.sh` freed the container name for the whole ~7-minute build, and could have silently shipped the old version behind an error message identical to the harmless case.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2493/2494** (1 pre-existing skip, zero failures). Ghost-gate result for this session: see `.claude/NEXT_SESSION.md`.
- **One unidentified flake, worth watching:** a backgrounded `npm test` showed **1 failure** while the ghost gates ran concurrently; an immediate clean re-run was **2493/2494 green**, and the failing test's identity was lost because the captured output had been truncated to its tail. Not reproduced, not diagnosed — recorded rather than dismissed. If it recurs, capture full output *before* re-running.
- **Lint:** ✅ 0 errors, **62 warnings** (was 113). Twelve rules held at zero as hard errors. What remains is deliberate, not backlog: **34 `set-state-in-effect`** (all 34 audited — ~9 subscribe to a store, 3 load on mount, rest derive from props; clearing them properly is a `useSyncExternalStore` refactor, not a sweep) and **28 `no-explicit-any`** (Bucket E, documented intentional). The config now records *why* both stay. Still not in CI: this repo has no `.github/workflows/` at all.
- **E2E determinism:** decks are seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds. `npm test` is *consistent* — which is not the same as *proven correct*.
- **Deploy:** app code live = commit `a2fa541`, verified 2026-07-29 by grepping the served bundle for that commit hash. Note the version string could **not** settle it this time (the bump to 3.1.75 lands after the deploy), and `/health`'s version field is an unreliable "dev" placeholder — grep the bundle. **Not yet live:** the `deploy.sh` race fix, which is deploy tooling rather than app code and takes effect on the next deploy.
- **Dashboard feedback:** **8 open**, untouched this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Player-to-player trading is fully built and unreachable** — `NegotiationModal` (751 lines) + `NegotiationService` (426 lines), wired into the service container, tested on both halves, and nothing can open it. Needs a **card** written that hands something to another player (none of the 399 do today), *then* a button in the action list. Not a wiring job — and a top-bar button would permit off-turn trading, since the service has zero turn awareness. Full context in TODO.md's Parking lot.
2. **Homeowner violation mechanic — needs a real spec before engineering.** Unchanged: maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work — a design conversation, not code.
3. **fb:ae480630 (next-action highlight) is open by choice.** v3.1.63 fixed a real notify gap that is a well-evidenced probable cause, but the symptom was never reproduced — left open so a recurrence tells us it was something else.
