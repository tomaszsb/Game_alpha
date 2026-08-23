# Next session starter — written 2026-08-23 by /koniec

## State at handoff
- **Version:** v3.2.34 — **deployed and confirmed live** (`7a77c65`).
- **Branch:** master, clean and pushed (only untracked scratch file `idea.txt`, a maintainer draft, untouched).
- **Last shipped:** the card library — 18 versions in one long session. The two space-editing screens are now one; a card carries all its own content; edits survive restarts; and three hand-edits to generated data files that had already been lost on live were restored, including a bank loan fee that was being charged flat instead of tiered.
- **Test suite:** `npm test` **2957/2957** (195 files). `npm run test:ghost` **33/33** (10 files, ~13.6 min, 0 hard failures, bot batches at their win-rate floors).
- **Build/typecheck:** both clean.

## Top 3 open items
1. **Teachers can no longer edit what a space says** — a regression from v3.2.29, stated at the time rather than found later. The 6-field editor removed there was their only way in, and the remaining save route is admin-only. `SpaceEditor` is already built for it (`visibleFields={SAFE_FIELD_SUBSET}`); it needs a teacher branch on `POST /api/instances/:id/content` writing `individual` cards. **No teachers exist yet**, so nothing is broken in practice — but it is a capability that left.
2. **`DataService.parseSpaceEffectsCsv` reads SPACE_EFFECTS by column NUMBER, not header name.** Inserting a column mid-header shifted every later field and turned 18 tests red (2026-08-22). New columns must be appended to the end until this is fixed. The editor's own `csvExport` was fixed this way in v2.66.1; this parser never was. Hot path — wants its own pass.
3. **Two small gaps from v3.2.34.** The editor's field labels have never been associated with their inputs, so a screen reader announces them unnamed (pre-existing across the whole ~1100-line `SpaceEditor`). And the new click-to-edit links were verified structurally but nobody has actually pressed Tab through them — 30 seconds in a real browser.

## Test failures to address
None. Both suites green — `npm test` 2957/2957 and `npm run test:ghost` 33/33.

## Decisions waiting on the user
- **Stage 4 of the card library — the group/school tier.** He leaned toward wanting it built ("I am leaning towards I want the tiers built"), was given the sizing, and the thread moved on before he chose. Cards already carry an owner, so this is additive. See [CARD_LIBRARY_DESIGN.md](../docs/core/CARD_LIBRARY_DESIGN.md) "Stage 4" and "Breadcrumbs".
- **`DataEditor` is now unreachable but deliberately still in the tree** as a fallback if the merged screen misbehaves in real use. Delete it once he has used the new screen for a while.

## Suggested first move
Ask him how the merged screen felt in real use — it changed a lot this session and he only saw the first version of it. If it held up, deleting the old `DataEditor` and reopening teacher editing are the two natural follow-ons; if it did not, his reaction is worth more than any of the three items above.

## Suggested model for next session
Sonnet 5 — the open items are scoped fixes (a teacher branch on one route, a parser reading by name, label associations). No architectural ambiguity left; the design work was done this session and is written down.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it to the maintainer — don't run it (deploy-handoff rule).
- **`tests/server/pipelineFaithful.test.ts` is new and load-bearing.** If it fails, fix the pipeline or add a SOURCE column — never edit a generated `CLEAN_FILES` file. Hand-edits there caused three silent production regressions.
- Editing `Spaces.csv` has real teeth (raw newlines in unquoted fields, positional parsers). Read the CLAUDE.md TACTICAL entry "Editing `Spaces.csv`" before touching it.
- The local `/fixloop` budget meter is anchored to a stale calibration — a monthly spend limit reset mid-session. Re-anchor with `node scripts/fixloop-usage.mjs --calibrate <official %>` before trusting it.
