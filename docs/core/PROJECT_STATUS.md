# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 31, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.43** — deployed and confirmed live (`/health` → `c88b222`; the served bundle `index-CjDqcCm6.js` carries `3.2.43`, and a local `npm run build` reproduced that exact hash, so master == live).

## Current sprint
**2026-08-30 — v3.2.43 fixed the measuring instrument first, then three things it could finally see.** `run-tests-batch-fixed.sh` was enumerating **60 of 198** test files by hand while reporting "22/22 batches PASSED" — 138 files across 19 directories were simply never on the list, including all of `tests/server/` and the load-bearing `pipelineFaithful` test. It now derives its list from the same include/exclude rules as `vitest.config.dev.ts` and ends every run by asserting the dispatched set **equals** the discovered set — set equality, not a count, because the rewrite's own first cut dropped one file per directory and duplicated another while holding the total at exactly 198.

On that footing: the TV history column now defaults **off** (the maintainer's own hardware verdict — *"It is on but should be off"* — after a browser check at 960x540 proved it *fit* but could not say whether it *read* across a room); twelve more CSV parsers moved off positional indexing onto one shared `csvFieldReader()`, closing a silent-corruption path where inserting a column shifted every field after it with nothing thrown and nothing logged; and the editor panel now lights blank fields and opens its own fold-out, both bugs found by the maintainer hand-testing v3.2.37.

**2026-08-31 was an infrastructure session** — Unraid server recovery, dashboard auth, credential permissions. No game code changed; this snapshot was corrected because v3.2.43 shipped without a `/koniec` pass and left this file, `NEXT_SESSION.md` and `TODO.md` a version behind.

## Health
- **Tests:** typecheck ✅ clean and build ✅ clean, both re-verified 2026-08-31 against untouched master. `npm test` **3043/3043 across 198 files** (v3.2.43). `npm run test:ghost` **33/33 across 10 files** (812s, 2026-08-31) — green. Both 50-game bots cleared their win-rate floors with no exceptions. This run was done **because v3.2.43 shipped without one**: it changed `src/` and twelve CSV parsers, so the gap is now closed and no behavioural drift was introduced.
- **Batch-runner coverage gap: CLOSED** by v3.2.43. The old warning here — "treat 22/22 batches as a subset signal" — no longer applies: the runner is now a true superset of `npm test`, which remains the commit gate.
- **Security:** `npm audit` 0 vulnerabilities.
- **Deploy:** v3.2.43 confirmed live (`c88b222`), verified by version string, bundle hash and `/health` together.
- **Dashboard feedback:** **6 open** (was 7). fb:93449bf2 — the TV history verdict, fixed in v3.2.43 — flipped resolved 2026-08-31 once the deploy was confirmed.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **The TV history column on a real television, second pass.** Now defaults off, so it fails safe — but nobody has yet answered whether it should be *on* for a classroom, or what the filter chips read as across a room.
2. **One real click still owed.** Tab order is **confirmed good** (maintainer, 2026-08-30). What remains: v3.2.43's click-to-light fix, not re-confirmed by a real click, and v3.2.42's `<span>`→`<label>` swap, never eyeballed. The wall is unchanged — the Browser pane never holds keyboard focus, so `.focus()` fires zero focus events (measured: 0 listeners) and `editingRegion` is driven entirely by them.
3. **Teachers reach the new editor through Classroom Setup, not the merged admin screen** — deck and six wording fields, but not the admin's player-view preview. No teacher account exists in production; the boundary was proven against a throwaway local server.
