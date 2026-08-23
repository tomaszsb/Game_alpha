# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 23, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.37** — **pending deploy**. v3.2.36 (`e121dd5`) is the last version confirmed live.

## Current sprint
**2026-08-23, continuing the card-library session: the maintainer used the merged space-editing screen and reported back three times.** Every version this stretch came straight off his reaction, not from a plan.

His first verdict was that the left side was "very big and sparse" and that it was "hard to find things on the left that match things on the player panel on the right." Both halves had one cause: the editor headed its sections after the data model — *(C) Actions*, *Dice Outcome Modals*, *Movement Destinations* — while the player view named the same parts plainly. Ten headings, no shared words. **v3.2.35** made headings come off `spaceRegions.ts`, the one map both directions already read, split two sections so each answers to exactly one clickable part, and folded the empty ones.

His second round: folded sections were still bordered white cards, so twelve one-line rows read as clutter; and clicking into a field still showed nothing, because only *typing* had ever lit the panel. **v3.2.37** made a folded section a quiet borderless row and made the panel mark the part your cursor is in — steadily, scrolled into view — reported from one handler on the form rather than field by field.

Between them, **v3.2.36** cleared the four `extract-zip` advisories his deploy log was printing, by upgrading puppeteer *forward* to 25.8.0 (`@puppeteer/browsers` 3.2.1 dropped the package outright) rather than accepting `npm audit fix`'s proposed six-major downgrade to a 2023 release.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. `npm test` **2963/2963** (195 files, +6 this stretch). `npm run test:ghost` **33/33** (10 files, ~14.8 min, 0 hard failures, bot batches at their win-rate floors).
- **Security:** `npm audit` **0 vulnerabilities** (was 4 high).
- **Lint:** not touched this session (41 problems / 6 errors, unchanged baseline, all pre-existing `react/no-unescaped-entities`).
- **Deploy:** v3.2.36 confirmed live by the maintainer (`/health` → `e121dd5`). **v3.2.37 is built and pushed but not deployed.**
- **Dashboard feedback:** untouched this session — these three versions came from direct reports, not filed ones. 6–7 open, per the last live count.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.2.37, then look at the folded editor with your own eyes.** Two things in it could only be verified by dispatching the events a browser would send: the click-to-light link, and Tab order. The Browser pane never holds keyboard focus (`document.hasFocus()` is false, so *zero* focus events fire) — root-caused this session and now in CLAUDE.md TACTICAL. One minute of real clicking settles both.
2. **Teachers can no longer edit what a space says** — a regression from v3.2.29, stated at the time rather than discovered later. `SpaceEditor` is already built to show them the safe subset (`visibleFields={SAFE_FIELD_SUBSET}`); it needs a teacher branch on `POST /content` writing `individual` cards. **No teachers exist yet**, so nothing is broken in practice.
3. **`DataService.parseSpaceEffectsCsv` reads a CSV by column number, not header name** — inserting a column mid-header shifted every later field and turned 18 tests red. New columns must be appended to the end until it reads by name. The editor's own `csvExport` was fixed this way in v2.66.1; this parser never was.
4. **The Dockerfile ships devDependencies into the running image** — and the obvious one-line fix is a live outage. `express`/`cors`/`ws` were filed as devDependencies (moved to `dependencies` in v3.2.37, so the prerequisite is done), but `npm prune --omit=dev` still needs a real container build to prove before it goes near a deploy. Full trap written into TODO.md.
