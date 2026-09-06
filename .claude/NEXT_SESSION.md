# Next session starter — written 2026-09-04 by /koniec

## State at handoff
- **Version:** v3.2.51 — **LIVE.** Corrected 2026-09-05: `/health` → `e5cc6a0`, which equals master HEAD. This line said "pending deploy" for a day after it shipped and sent two sessions toward a pointless redeploy. **Check `/health` before believing any version claim in this file.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** v3.2.51 — **81 plain-English button labels**, the button half of Onboarding Phase C. A player was landing on the tile "Cut a Corner" and being asked to "Determine Fee Amount"; `Determine …` covered 31 of the 45 dice buttons. Under the wording sat the tiles' own defect: **0 of 80 manual rows had ever carried an authored `button_label`**. No schema change was needed — every label column already existed at 0% populated.
- **Test suite:** `npm test` **3096/3096 across 202 files**, `npm run test:ghost` **33/33 across 10 files**, 0 failures either way. Typecheck ✅ build ✅.
- **Ghost baseline re-confirmed:** smart-bot **50 / 0 / 0 hard / 70.8 turns / 21 long** — byte-identical on a **fourth** distinct tree. **Do not chase 47/3/0/86.9**; it belongs to the pre-v3.2.48 coupled era and cannot return by construction.
- **`hold/v3.2.46-session-log` is deleted** (2026-09-04), its source verified byte-identical to master first. Only `master` exists now, locally and on origin.

## The rule that governs the onboarding work
The maintainer set it 2026-09-04 and it decides the remaining Phase C work: **"buttons say what you're doing, in everyday words. No trade jargon on buttons."** The reason is structural, not stylistic — `TextWithTerms` renders `<span role="button">` with `stopPropagation()`, so a glossary link inside a real `<button>` swallows the click. **A button is the one surface where a hard word can never explain itself.** Teach vocabulary in story prose and the glossary. This took "expeditor" off every button including `return_e` — v3.2.47's "Let one expeditor go" fixed the direction problem but left 8 hits of *"I don't know what an expeditor is."*

## Top 3 open items
1. **Build the teaching layer — the rest of Onboarding Phase C, and the bulk of it.** Tiles (v3.2.50) and buttons (v3.2.51) were the mechanical half. **Tutorial, tooltips and micro-lessons are unbuilt.** Hard constraint above: never put a glossary term inside an action button.
2. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** The bot burned 250 of its 272 days on that one space with no mention of a cost anywhere in its stated reasoning. The 50 days are intended (`SPACE_EFFECTS.csv:57`); this is **disclosure, not balance**. Maintainer's call.
3. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are live but were never verified on real hardware — both only execute on a real panel.

## Test failures to address
None. Green on master at v3.2.51.

## Decisions waiting on the user
- **The ARCH-FEE-REVIEW 50-day disclosure question** (item 2) — the one that unblocks real work.
- **`formatDiceRollButton` is dead code — delete it?** 74 lines in `src/utils/buttonFormatting.ts`, zero call sites; six `DICE_BUTTON` keys reachable only through it are dead too. Surfaced during v3.2.51 rather than folded into a wording change.
- **One malformed row in `SOURCE_FILES/DiceRoll Info.csv`** — blank `space_name`, `die_roll` set to the literal string `button_label`. Renders no button; makes dice-row counts read 47 instead of 46.
- **Card *type* names were deliberately left alone.** Renaming "Work Package"/"Bank Loan"/"Expeditor" globally (via `getCardTypeName`) would reach the log, card details and outcome banners — a wider change than buttons and its own decision.
- **Card library Stage 4, the group/school tier.** Deferred 2026-08-25, not rejected; `group` is a valid tier nothing writes, so adding it later is additive.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** The whole point is that a browser cannot judge it: flip only after he confirms the TV reads well across a room. Rolled forward deliberately, not forgotten.

## Suggested first move
v3.2.51 needs deploying before anything else — the labels are data-file changes, so verify with `/health` **and** `/data/CLEAN_FILES/SPACE_EFFECTS.csv`, not by grepping a JS chunk. Then ask whether he wants the tutorial/tooltips started, or would rather settle the 50-day disclosure question first — that one is his alone and is the smaller ask.

## Suggested model for next session
Sonnet 5 — the teaching layer is scoped content-and-copy work with two shipped precedents to follow (`display_label_override` for tiles, `button_label` for buttons), and items 2–3 need the maintainer, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **An authored CSV value is inert if the RENDERER reads a different column than the generator writes.** This bit v3.2.51: all 46 dice labels were parsed, stored, regenerated and did nothing, with no error, because the generator wrote only `description` and the dice branch deliberately ignores that column. **Author ONE value, regenerate, and grep for the column the renderer names** before writing 81 of anything. Full entry in CLAUDE.md TACTICAL.
- **Con-Initiation crash: do NOT attempt a harness repro.** It needs the maintainer's own foregrounded browser; automated browsers report `visibilityState: hidden` and produce false positives. This has burned three sessions.
- **Glossary pending count is disputed** — TODO said 6 since July; the manager session reports only Crowdfunding remains. Unverifiable from here (`GET /api/candidates` is auth-gated). The dashboard is the authority.
- **Deploy runs from a Windows terminal, not WSL.** Hand it over by default.
- **Say which folder you are in, every time.** Two Claude sessions share repos and git cannot tell them apart. Fingerprint by test count: `npm test` ≈ 202 files/3096 tests (ghost excluded).
- **`npm test` ≠ the full suite** — it excludes `tests/ghost/**` by config.
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts and is destroyed.
- `io.open(path,'w')` truncates before writing; a patch script that raises mid-write leaves the file EMPTY.
