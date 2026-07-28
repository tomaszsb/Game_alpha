# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 27, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.66** — **deployed and confirmed live** by the maintainer 2026-07-27.

## Current sprint
**2026-07-27 (evening) — a `/loop /fixloop` run cleared the entire staged dashboard backlog, then two code-health items turned out to be a real crash and the tooling that should have caught it.** Fixloop took all four staged reports: the player panel's redundant frame + blue outline (v3.1.62), a `StateService.updateActionCounts()` notify gap that silently dropped both UI refreshes and cross-device sync (v3.1.63), the "yellow banner too big" report (**measured as already resolved** by v3.1.22's zoom gate — no code change, deliberately), and TV mode having no glossary entry point, added to the player's own phone per the maintainer's call (v3.1.64). Then the code-health bundle: `DataEditor`'s "28 lint errors" turned out to be a **guaranteed crash** for any admin logging in through the auth gate (v3.1.65), and the follow-on made `npm run lint` runnable again after being broken by a `no-undef` misconfiguration that produced 138 pure false positives (v3.1.66). Separately, the glossary auto-sync was confirmed working since 2026-07-26 — the TODO claiming it needed deploying was stale by a day.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2493/2494** (1 pre-existing skip, zero failures, no flakes), ghost gates **33/33** (575.93s).
- **Lint:** ✅ **`npm run lint` runs and exits 0** (was 392 errors / effectively unrunnable). 0 errors, 257 warnings — a deliberate, visible burn-down list tracked in TODO.md, not suppression. `react-hooks/rules-of-hooks` is at zero and stays a **hard error**, so the v3.1.65 crash class is now blocked. Lint is *ready* for CI but not wired in — this repo has no `.github/workflows/` at all.
- **Deploy:** live = **v3.1.66**, confirmed by maintainer.
- **Dashboard feedback:** 7 open (was 13 at session start).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Homeowner violation mechanic — needs a real spec before engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work — needs a design conversation, not code.
2. **fb:ae480630 (next-action highlight) is open by choice.** v3.1.63 fixed a real notify gap that is a well-evidenced probable cause, but the symptom was never reproduced — left open so a recurrence tells us it was something else. (fb:b39ea2bd was reviewed and closed 2026-07-27; it needed no code change.)
3. **CSP/HSTS/Permissions-Policy headers still deferred** — real regression risk this app's jsdom-based test suite structurally can't catch; needs a full inline-style/iframe survey + live-browser verification.
