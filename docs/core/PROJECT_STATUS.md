# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 23, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.34** — deployed and confirmed live (`7a77c65`).

## Current sprint
**2026-08-22/23, one long session: the card library.** Started from the maintainer's report that the two space-editing screens "do the same thing in different ways." Researched both, found the durability was backwards — the friendlier editor's saves were reverted on every restart — designed a card-library model with him ([CARD_LIBRARY_DESIGN.md](CARD_LIBRARY_DESIGN.md)), and built stages 1–3: edits survive restarts, a card carries all its own content (dice, modal copy, logic wording), the classroom config gained the backup net its Phase 1 spec promised in June, and the two screens became one — browse your deck with a live player view, click into editing where the deck folds into a rolodex drawer.

He then used it and pushed back twice, both correctly: two edit paths still existed inside the merged screen, and automatic versioning complicated more than it helped. **v3.2.29 removed branching and one whole editor — net −443 lines.** Versioning came back out because its one benefit (undo a bad save) was already covered by the backups shipped alongside it.

Chasing his last bug — a typed button label reaching the modal but not the player panel — turned up something bigger: **three values had been hand-edited into generated data files and were already lost on live**, including a bank loan fee being charged flat instead of tiered. All restored, and `tests/server/pipelineFaithful.test.ts` now guards it.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. `npm test` **2957/2957** (195 files), `npm run test:ghost` **33/33** (10 files, 0 hard failures). Full Golden-Rule coverage green.
- **Lint:** not touched this session (41 problems / 6 errors, unchanged baseline, all pre-existing `react/no-unescaped-entities`).
- **Deploy:** v3.2.34 deployed and confirmed live by the maintainer (`/health` → `7a77c65`).
- **Dashboard feedback:** `fb:feedback-1781190420890-5a155a1a` flipped resolved (fixed v3.2.13, deploy confirmed). 6 reports remain open.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Teachers can no longer edit what a space says** — a regression from v3.2.29, stated at the time rather than discovered later. The 6-field editor removed there was their only way in; the remaining save route is admin-only. `SpaceEditor` is already built to show them the safe subset (`visibleFields={SAFE_FIELD_SUBSET}`); it needs a teacher branch on `POST /content` writing `individual` cards. **No teachers exist yet**, so nothing is broken in practice.
2. **`DataService.parseSpaceEffectsCsv` reads a CSV by column number, not header name** — inserting a column mid-header shifted every later field and turned 18 tests red. New columns must be appended to the end until it reads by name. The editor's own `csvExport` was fixed this way in v2.66.1; this parser never was.
3. **Two small accessibility/verification gaps from v3.2.34** — the editor's field labels have never been associated with their inputs (screen readers announce them unnamed, across the whole ~1100-line editor), and the new click-to-edit links were verified structurally but nobody has actually pressed Tab through them.
