# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 26, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.42** — deployed and confirmed live (`/health` → `e6f6330`, bundle carries `3.2.42`). v3.2.39–3.2.42 all shipped in one deploy.

## Current sprint
**2026-08-25/26 — the maintainer answered a design question that had been open since the Project Chronicle's first slice, and the answer settled more than the thing it was asked about.** On the TV history feed: *"all the feeds should look the same, they should just be filtered differently. because it is on tv maybe we should just have the filters visible to users and let them decide what to see?"* **v3.2.38** made that true — one `HistoryFeed` behind the TV column, the phone panel, the shared-screen Log and the end-of-game viewer, differing only in the filter they open on, with Who/What chips on screen because nobody can open a menu on a television.

An autonomous `/loop /fixloop` run then landed **v3.2.39** (SPACE_EFFECTS read by header name, so a column added mid-file no longer shifts every field after it) and **v3.2.40** (accessible names across the space editor) before **stopping on judgement rather than budget**: the next item, a teacher branch on the content-save route, needed permission semantics that Stage 4's undecided role model owns. The maintainer then decided it — **skip the group/school tier** — and **v3.2.41** built it: a teacher writes an `individual` card over six wording columns, rebuilt from their own baked board, and an edit on a slot playing an `official` card branches instead of overwriting. **v3.2.42** closed a gap v3.2.40's release note had overstated (see Health).

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, lint ✅ clean on all touched files. `npm test` **3016 tests / 198 files**. `npm run test:ghost` — see NEXT_SESSION for the final number.
- **Coverage gap found this session:** `tests/scripts/run-tests-batch-fixed.sh` does **not** cover `tests/components/classroom/`. A v3.2.41 regression (10 failures in `ClassroomSetup.test.tsx`) passed 22/22 batches and was only caught by the full `npm test` at wrap-up. Treat "22/22 batches" as a subset signal, not the full suite.
- **Security:** `npm audit` 0 vulnerabilities.
- **Deploy:** v3.2.42 confirmed live (`e6f6330`), verified by version string **and** the `tv-history-feed` marker in the served bundle.
- **Dashboard feedback:** no flips pending — this session's fixes came from design decisions and code investigation, not filed reports.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Look at the TV history column on a real television.** It takes 260px of the TV's 960px width. Verified at that exact resolution in a browser (no overflow, chips work, board renders), but whether the board stays *readable across a room* is what the browser can't answer — and the TV-fit history behind fb:3f9f2831 / fb:28512320 says it matters. If it's tight, the fix is one line: default `showHistory` to false.
2. **Two things only a real click settles.** v3.2.37's click-a-field-to-light-the-panel and v3.2.34's Tab order were both verified by *dispatching* the events a browser sends. Root cause, now in CLAUDE.md TACTICAL: the Browser pane never holds keyboard focus, so `.focus()` moves `activeElement` while firing zero focus events. Also worth a glance: v3.2.42 changed a `<span>` to a `<label>` in the dice-outcome table and was not eyeballed.
3. **Teachers reach the new editor through Classroom Setup, not the merged admin screen** — so they get the deck and the fields without the player-view preview. Tracked as follow-up (ii) on the card-library item.
4. **`DataService`'s sibling CSV parsers still read by column number.** v3.2.39 fixed `parseSpaceEffectsCsv` only; `parseDiceEffectsCsv` and the rest share the shape and the latent bug. Deliberately left — a hot-path parser wants its own pass.
