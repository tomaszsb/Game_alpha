# Next session starter — written 2026-10-30 by /koniec (Game session, folder D:\Unravel\Current_Game\Game_Alpha; other sessions add below)

## State at handoff
- **Version:** v3.9.12 pushed, **NOT deployed** (3.9.12 = one card-wording cell, W053 "NFPA 13", from the scope-drawings session below). Live is **v3.9.11** (`/health` = `f18d07cd`, checked 10-30 16:20). 3.9.10 = TV fix pack from Tom's Hisense test; 3.9.11 = honest iPhone wording and a sturdier turn chime. Check `/health` vs `git rev-parse --short HEAD` first.
- **Branch:** master, clean except the untracked `public/assets/inspector/` + `public/assets/trophies/` (other sessions'; do not add or delete).
- **Last shipped:** the round town, opt-in (fb:fefe42f8). 3.9.6: ring of the 7 shared buildings round a park with a fountain, a side per player (owner's house + office in the player's colour), a table that turns to whoever's turn it is, clocks on the rim, pulsing move choices, teacher Town settings strip. 3.9.7: each building drawn by its job (`round_looks` in TOWN.csv, drawings in `src/components/board/townLooks.tsx`), names on signs on the front walls, room choices on the sign. 3.9.8: "Round town" as a third board choice.
- **Test suite:** `npm test` 351 files / 4,451 passing (v3.9.12); `npm run test:ghost` 16 files passed / 4 skipped (60 tests, 722 s, 10-30); build OK; typecheck = the 9 old errors in `tests/` only (`finalStretch.test.ts`, `dataGate.test.ts` missing `@types/express`).
- **Version rule:** patch caps at 99.

## How Tom picks Round town
- Setup screen > Game Settings > **Board: Round town** (every screen of that game). In a running game: **Menu > Board** goes Town, Round town, Classic (that screen only). Also still works: a `?town=round` link, or a class's Town settings strip `round_town` = on. Default stays Street view, so the class and the robot see no change.

## Top 3 open items
1. **Tom deploys 3.9.11 and plays again on the Hisense; read `PLAYTEST_TV_TURN` and `PLAYTEST_TV_KEYS` from `GET /api/logs` for the real numbers. The iPhone chime (3.9.11) has not been heard on a real iPhone.** Stage 2 (talk bubbles, panel split, glossary viewer) waits for that test; the Manager sequences it.
2. **Round town NOT done:** the table turn is lighter but not proven smooth on a real TV (numbers in CHANGELOG 3.9.10); signs can cross for a moment WHILE the table turns (tested clean at every resting pose, 1-4 players, v3.9.9); a sign can be partly hidden behind a nearer building or a pawn on the left/right sides; **never tried on a real Fire Stick**; the teacher Town settings strip was never clicked in a browser (component + server tests only). Done in 3.9.9: the sign-overlap test, the trailer's sign at full size, weather and scenery on the round town.
3. **fb:5618257f blank board:** v3.9.1 records `nodesHidden`; the next blank-board report answers the hypothesis (unverified).

## Decisions waiting on the user
- Round town: keep, change, or go on to stage 2 (after the TV test).
- From the mock-ups, worth taking later (stage 5 for fonts/palette): a soft shadow under each building, darker ink outlines, roof details (water tower, drafting triangle), white room chips with a coloured edge, heavy rounded sign letters, the paler sky-to-sand backdrop.
- Design items, not bugs: newspaper pop-up (fb:1b7607e9), site picture by scope (fb:cd4d445e), expediter rework (fb:f22035af, cd598be9, db1d1104), phone "show my board" button (fb:167f2d0f), async turns (fb:1df093dd), Money/Scope diagonal (fb:c0d3bfb8); Tom's two 10-29 ideas are in TODO, not designed. fb:75a8bfa3 is tracked nowhere yet. Needs Tom's TV: fb:5d7e02d9, fb:7fbea636.

## Flip after deploy
- None automatic.

## Suggested first move
Ask Tom how the round town looked on his TV after the deploy, before any stage-2 work.

## Suggested model for next session
Sonnet 5 for loose ends (sign-overlap test, trailer sign); Opus if stage 2 starts (panel split touches the phone panel rule).

## Reminders
- Tom deploys from PowerShell: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never run it yourself. Marking feedback resolved changes the live server: only on Tom's own yes.
- TV pack pictures and measuring scripts: `.tmp/tv-pack/` (`check.mjs` every visible change, `turn.mjs` the turn numbers). Round-town pictures: `.tmp/round-town-build/` (1a) and `.tmp/round-town-build-1b/` (1b; `turn.mjs` passes a turn on the server, `closeup.mjs` shoots every building). TV with no phones: start as PC, then open the same link with `mode=tv&role=tv`.
- The Vite watcher on D: missed edits several times: `curl localhost:3000/src/<file>` before trusting a browser check; restart the preview if stale.

## Other sessions (added by their /koniec)
- **dialogue-draft:** `.tmp/dialogue/conversation-lines-draft.csv` (182 lines, Sonnet 5.5) is superseded by dialogue-merge's merged sheet; nothing goes into the game until Tom reviews. Zero game source touched (typecheck = the same 9 old errors in `tests/`, build OK, no test suite).
- **dialogue-merge:** the merged conversation sheet (80 rows, 41 stops x first visit / coming back) now lives in `Mockups/dialogue-2026-10/` (`conversation-merged.csv`, `merge-notes.md`, plus copies of the draft and Tom's `conversation-lines-to-write.csv`). It waits for Tom's review; nothing goes into the game before that. Tom's rulings of 2026-10-30: the vendor speaks on return visits to Find an Architect / Find an Engineer (The Architect / The Engineer, not the PM); "Firing filing rep should hapen anywhere. hiring should only happen at the office"; and a city borough office is NOT an office. Follow-ups are in TODO ("Dialogue stage 3"). Zero game source touched (typecheck + build only, no test suite).
- **game-style (look rounds 1-3):** the mock-ups now live in `Mockups/look-2026-10/` (13 MB, see its README): the round-3 pages `turning-town.html`, `two-cutaways.html`, `phone-panel.html` (one-file copies) and their sources (`lazy.html`, `cutaway.html`, `phones.html?v=a|b`, `kit.js`, `iso.js`, `fonts/`), plus the three rounds' contact sheets, `research-notes.md` and Tom's two research PDFs. Tom's picks: the C model town as a turning table (now built as Round town); officials talk in bubbles on the TV board, while the phone keeps every number (phone version A, "No TV? Read here" for PC/Remote games); the flat cutaway first, with a hidden mouse-drag to the angled view (the mock-up shows the two side by side, so the drag is not drawn yet); Poppins + OpenDyslexic as a reader's choice ("Aa"). Later stages take the table and ring turn (transform-only, reduce-motion = instant, rim calendars, upright signs) from `lazy.html`, the full phone dashboard from `phones.html?v=a`, and the angled cut plus shared highlight from `cutaway.html`/`kit.js`. Zero game source touched (typecheck = the same 9 old errors in `tests/`, build OK, no test suite).
- **scope-drawings (mock-up, 2026-10-30, folder D:\Unravel\Current_Game\Game_Alpha, a side session of the Manager):** built a MOCK-UP only: three blueprint sheets (plumbing P-301, sprinklers SP-201, sidewalk shed EQ-101) and a 390x844 phone page where a "Drawing" button on a scope line opens a sheet. It lives in `.tmp/scope-mockup/` (git-ignored; `node build-sheets.mjs && node build-phone.mjs`; look at `contact-sheet.png` / `phone.html`). Nothing in `src/` changed. Tom's decisions are in TODO (the "drawings with each scope" item) and the memory note `project_scope_drawings.md`. The one game change is v3.9.12: W053's scope line now reads "NFPA 13", not "13R" (13R is residential only and the card pairs with any project type; `SCOPE_WORDING.csv` line 60 only; the other copies are deploy copies). Waiting on Tom: his reaction to the mock-up before anything is built; section numbers (P-301, 903.3.1.2, 3307...) came through a summarizer and need a check in the official code book; building all 13 common kinds is roughly 3-4% of a week. Zero other game source touched; typecheck = the same 9 old errors in `tests/`.
