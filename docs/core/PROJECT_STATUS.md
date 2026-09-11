# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 11, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.57 — LIVE.** `/health` read `f926d5b` (= HEAD, v3.2.57) at 2026-09-11 10:54Z. Checked against `/health` itself, not a deploy log. **Trust `/health` over this line**: status lines have gone stale within hours more than once. 3.2.46 stays permanently skipped.

## Current sprint
**Onboarding Phase C, teaching a beginner the game**, is still the main arc. v3.2.50–54 named the tiles, wrote the button labels, and started the "What's this?" teaching layer. The tutorial, the micro-lessons and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows are still to do.

**v3.2.56–57 were a Workstream 6 detour: the second CSV-only-reskin audit.** Its real bug was that the same CSV condition got opposite answers depending on which code path read it. There were four evaluators, not two. The data was measured first (repo, server and live classroom): only `dice_roll_1..6` exist, all on auto rows, so the bug was latent and nothing live changed. Four cheap leaks were also fixed: DiceService's private NPC-name table (the funding character is now **"The Banker"** everywhere), a duplicated phase table, auto-roll keyed on the phase *name* (now an `auto_roll_dice` flag), and hand-playability hardcoded to `card_type === 'E'` in the UI (now `CARD_TYPES.is_playable_from_hand`). v3.2.57 deleted five dead `UI_STRINGS.csv` rows that logged five console errors on every page load. The remaining leaks, including the 14th (`min_w_cards_to_leave` counts the letter W), are ranked in TODO.md.

## Health
- **Tests (v3.2.57):** `npx vitest run`, the whole suite including ghost: **3162/3162 across 216 files**, green on the first attempt. Typecheck ✅, production build ✅. (v3.2.56's first full run failed 2 fixtures that expected the old "Bank:" label; both were updated.)
- **Flake note:** a lone `tests/server/**` failure is probably Windows temp-dir load (`EPERM`/`ENOTEMPTY`). Re-run before investigating. It did not occur this session.
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ✅ v3.2.57 live (see above). `bash deploy.sh` is Tom's to run, from a Windows terminal. A stock CSV change also re-bakes every classroom's `resolved/` copy on the next boot, so never hand-edit those.
- **Dashboard feedback:** fb:93449bf2 is still deliberately unflipped. It needs the maintainer's eyes on the real TV.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **The teaching layer: tutorial, micro-lessons, tooltip voice pass.** The largest remaining part of Phase C. Never put a glossary term inside an action button.
2. **The playtest robot still has zero real completions, and its first "win" (09-10) was probably a loss.** `Final score` also renders on the loss screen. The harness fix (tell a win from a loss, use the v3.2.55 `data-testid` hooks, clear `[role="dialog"]`) belongs to the Jarvis session. The game behaves correctly.
3. **Audit II leftovers, ranked in TODO.md.** The smallest is the 14th leak (`min_w_cards_to_leave` counts `startsWith('W')`). Whether to take it next is Tom's call.
