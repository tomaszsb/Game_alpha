# Next session starter — written 2026-08-23 by /koniec

## State at handoff
- **Version:** v3.2.37 — **pending deploy**. v3.2.36 (`e121dd5`) is the last version confirmed live.
- **Branch:** master, clean and pushed (untracked `idea.txt` is the maintainer's own draft — leave it).
- **Last shipped:** three rounds off the maintainer's own use of the merged space-editing screen — the editor now uses the player view's words and folds what is empty (v3.2.35), the four `extract-zip` advisories cleared by upgrading puppeteer forward (v3.2.36), and clicking into a field now marks what it changes while folded sections stopped looking like boxes (v3.2.37).
- **Test suite:** `npm test` **2963/2963** (195 files). `npm run test:ghost` **33/33** (10 files, ~14.8 min).
- **Build/typecheck:** both clean. `npm audit` **0 vulnerabilities** (was 4 high).

## Top 3 open items
1. **Deploy v3.2.37 and look at it.** Two things in it were verified by *dispatching* the events a browser sends, not by a real click: the new click-a-field-to-light-the-panel link, and Tab order from v3.2.34. Root cause, established this session and now in CLAUDE.md TACTICAL: the Browser pane never holds keyboard focus — `document.hasFocus()` is false, so `.focus()` moves `activeElement` while the browser fires **zero** focus events. One minute of real clicking and tabbing settles both. He has reacted to this screen three times running; his fourth reaction is worth more than any item below.
2. **Teachers can no longer edit what a space says** — regression from v3.2.29, stated at the time rather than found later. `SpaceEditor` is already built for it (`visibleFields={SAFE_FIELD_SUBSET}`); it needs a teacher branch on `POST /api/instances/:id/content` writing `individual` cards. **No teachers exist yet**, so nothing is broken in practice.
3. **`DataService.parseSpaceEffectsCsv` reads SPACE_EFFECTS by column NUMBER, not header name.** Inserting a column mid-header shifted every later field and turned 18 tests red (2026-08-22). New columns must be appended to the end until this is fixed. Hot path — wants its own pass with the suite green either side.

(Not exhaustive — this is a shortlist. `TODO.md` holds the rest, including the Dockerfile dev-dependency item whose obvious fix is a live outage.)

## Test failures to address
None. Both suites green — `npm test` 2963/2963 and `npm run test:ghost` 33/33.

## Decisions waiting on the user
- **Stage 4 of the card library — the group/school tier.** He leaned toward wanting it built, was given the sizing, and the thread moved on before he chose. Cards already carry an owner, so this is additive. See [CARD_LIBRARY_DESIGN.md](../docs/core/CARD_LIBRARY_DESIGN.md) "Stage 4".
- **`DataEditor` is now unreachable but deliberately still in the tree** as a fallback. He has now used the merged screen three times but has not called it good — delete once he does.
- He said of the Dockerfile question: *"too technical for me i do not know how to make this decision."* Treat infrastructure trade-offs as yours to decide and report, not to put to him.

## Suggested first move
Hand him the deploy command, then ask what the folded editor actually looks like once he opens it — specifically whether folding reads as "the clutter is gone" or as "things are being hidden from me." If it is the latter, the fix is small: start every section open and let folding be something he does.

## Suggested model for next session
Sonnet 5 — the open items are scoped (a teacher branch on one route, a parser reading by name, label associations). No architectural ambiguity; the design work is done and written down. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it over — don't run it.
- **Patch scripts: preserve each file's line endings.** Several source files are CRLF in HEAD despite `.gitattributes` saying `eol=lf`; a python round-trip flattened two of them this session and turned a 500-line change into a 2500-line diff. And never inline a backtick-bearing script into `python -c` from bash — bash ran `npm ci` out of one's prose. Both in CLAUDE.md TACTICAL now.
- `tests/server/pipelineFaithful.test.ts` is load-bearing. If it fails, fix the pipeline or add a SOURCE column — never edit a generated `CLEAN_FILES` file.
- The local `/fixloop` budget meter was re-anchored this session at 89% weekly (`node scripts/fixloop-usage.mjs --calibrate <official %>`). Weekly usage was high; check before starting a long autonomous run.
