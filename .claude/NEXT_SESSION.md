# Next session starter — written 2026-09-04 by /koniec

## State at handoff
- **Version:** v3.2.50 — **deployed and live**, verified independently: `/health` → `b4765b5`, which is HEAD. Nothing awaits deploy.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** v3.2.50 — **12 of 27 board tiles shared a label with another tile.** `shortName()` strips the NPC prefix, so four spaces all read "Fee Review", three "Scope Check", three "Initiation", two "Plan Exam". Every space now carries a plain-English name in the maintainer's own words. Edited in `SOURCE_FILES/Spaces.csv` + `node scripts/regen-clean-files.mjs` — **never** `CLEAN_FILES/GAME_CONFIG.csv` directly, which is generated and guarded by `tests/server/pipelineFaithful.test.ts`.
- **Test suite:** v3.2.50 baseline — `npm test` **3091/3091 across 201 files**, `npm run test:ghost` **33/33 across 10 files**, 0 failures. **This session ran neither** (no `src/`/`server/`/data changes — docs only); typecheck ✅ and production build ✅ were re-run 2026-09-04 and are clean.
- **Held branch:** `hold/v3.2.46-session-log` still exists locally. Its commit **already landed** as v3.2.49 — the branch is now redundant, and deleting it is the maintainer's call.

## ⚠️ Read this before running the ghost gates
**The baseline changed and the old numbers are a trap.** `ghostPlayerSmartBot` at `baseSeed=100001` is now **50 wins / 0 failures / 0 hard / avgTurns 70.8** (win + hard-failure counts stable at seeds 200003 and 770077). The old **47/3/0/86.9 cannot return by construction** — v3.2.48 *removed* draws from the shared stream, which yields a new sequence rather than restoring a prior alignment. Anyone chasing 47/3/0/86.9 is chasing a ghost; a stale copy of that number was still in `PROJECT_STATUS.md` until today. `.claude/ghost-history.jsonl` now stamps each row with `head` + `tree`, so a run's code is identifiable.

## Top 3 open items
1. **Build the teaching layer — the rest of Onboarding Phase C.** The audience fork is **answered: beginners, not insiders** (maintainer, 2026-09-03), and the jargon evidence is **spent — build, don't gather more.** Tiles shipped in v3.2.50; **button labels, the tutorial and tooltips are still open.** Hard constraint: never put a glossary term inside an action button — `TextWithTerms` renders `<span role="button">` with `stopPropagation()`, so it swallows the click and the action never fires.
2. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** The bot burned 250 of its 272 days on that one space with no mention of a cost anywhere in its stated reasoning. The 50 days are intended (`SPACE_EFFECTS.csv:57`); this is about **disclosure, not balance**. Maintainer's call.
3. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are live but were never verified on real hardware — both only execute on a real panel.

## Test failures to address
None. Green on master at v3.2.50.

## Decisions waiting on the user
- **The ARCH-FEE-REVIEW 50-day disclosure question** (item 2) — the one that unblocks real work.
- **Delete `hold/v3.2.46-session-log`?** Its content shipped as v3.2.49; the branch is redundant.
- **Card library Stage 4, the group/school tier.** Deferred 2026-08-25 ("skip the middle shelf"), not rejected; `group` is a valid tier nothing writes, so adding it later is additive.
- **`DataEditor` is unreachable but deliberately still in the tree** as a fallback — delete once the merged screen is confirmed good in real use.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** v3.2.44 is live, but the whole point is that a browser cannot judge it: flip only after he confirms the TV reads well across a room. Rolled forward deliberately, not forgotten.

## Suggested first move
Item 1 is the only one that doesn't need him: button labels are the natural next slice of the teaching layer, and the decision authorising them is already recorded. Ask whether he wants that, or whether he'd rather settle the 50-day disclosure question first — that one is his alone and it's the smaller ask.

## Suggested model for next session
Sonnet 5 — item 1 is scoped content-and-copy work with an existing pattern to follow (`display_label_override` already proved the render path), and items 2–3 need the maintainer, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **Con-Initiation crash: do NOT attempt a harness repro.** Tom said 2026-09-04 he has no time to test it; it needs his own foregrounded browser. Automated browsers report `visibilityState: hidden` and produce false positives — this has burned three sessions. Leave it open.
- **Glossary pending count is disputed** — TODO said 6 since July; the manager session reports only **Crowdfunding** remains. Could not be re-verified here (`GET /api/candidates` is auth-gated). The dashboard is the authority.
- **Deploy runs from a Windows terminal, not WSL:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it over by default. Tom lifted his own standing "don't push" hold on 2026-09-03 — check `/health` and `git reflog show origin/master` before repeating any hold you read in an older note.
- **Verifying a deploy: grep the RIGHT chunk.** The build is code-split. `/health` gives the running commit; `grep -rl "<string>" dist/assets/*.js` finds the chunk locally; then fetch *that* chunk live. A zero hit in `index-*.js` is evidence of nothing.
- **Say which folder you are in, every time.** Two Claude sessions share repos and git cannot tell them apart. Fingerprint by test count: `npm test` ≈ 201 files/3091 tests (ghost excluded).
- **`npm test` ≠ the full suite** — it excludes `tests/ghost/**` by config.
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts and is destroyed.
- `io.open(path,'w')` truncates before writing; a patch script that raises mid-write leaves the file EMPTY.
