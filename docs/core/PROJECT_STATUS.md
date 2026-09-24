# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 24, 2026 (v3.2.75)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.75 — live.** `/health` = `71162a1` (checked 2026-09-24 ~21:36 UTC, after Tom's deploy; the live bundle and the live `SPACE_CONTENT.csv` were verified too). Run `curl -sS https://game.unravelcodes.com/health` before believing this.

## Current sprint
**Onboarding Phase C, teaching a beginner the game,** replanned by Tom 2026-09-19: **no new tutorial or tip layer** — one help look for the whole game, voiced by one recurring mentor, reusing existing wording (four slices, full text in TODO). **Slice 1 shipped v3.2.71; Slice 3 mostly shipped (v3.2.72–74).** This session (2026-09-24, Manager brief): the press-and-hold hint now says what a tap shows ("Tap to see the cost · press & hold to confirm", **v3.2.74**), **real push-backs are counted** (`pushBacks` in `/api/admin/engagement-stats`, split home / foreign / unknown), and **v3.2.75** made pushing back cost days at Investor Review (15), Hire a Builder (5) and Final Approval (1) — the last three places it was free (their time is a dice roll; the prices are new `try_again_days` data, Tom-approved, unplaytested). Still open in Slice 3: the 24 movement-choice tooltip rows and the RULES modal body rewrite. Next: Slice 2, the mentor (Tom picks who); Tom's "go" on putting every "?" inside its button's outline (needs his phone).

## Health
- **Tests (v3.2.75):** `npm test` **220 files / 3371 tests green**. Ghost gates run this session (game logic changed): **11 files / 43 tests green**; the smart-bot's numbers are unchanged (49/50 wins, 70.1 avg turns) — proves nothing broke, not that the new prices feel fair. Typecheck ✅, build ✅.
- **Deploy:** ✅ v3.2.75 live. (The previous status and handoff wrongly said v3.2.73 was "pending" while it was already live — caught by `/start`'s `/health` check.)
- **Nightly robot:** its start-step fix is in the Jarvis repo, not here (status as of 2026-09-22, not re-verified). **New heads-up for that session:** `game_playtest.py` `TAB_SUFFIX_RE` strips the old "— tap to compare…" ending from tab labels; v3.2.74 reworded it, so captions carry the new ending until the regex accepts both wordings (cosmetic; `data-actionable` still works). Best fixed before the next 03:00 run.
- **Dashboard:** fb:93449bf2 deliberately unflipped (needs Tom's eyes on the real TV). fb:ae480630 and fb:11662ac3 (commit highlight, Lender Review) **not flipped — they need a live look.** 9 of 17 open reports are not tracked in TODO/CHANGELOG — run `/start full`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's "go" on the "?"-inside-buttons work** — not started; needs his eyes on a real phone, light and dark.
2. **Slice 2, the mentor** — needs Tom to pick who; bring three candidates with a sample line each.
3. **Read the push-back counts** once real players have produced some (`pushBacks.foreign` only) — also the first test of the v3.2.75 prices. Then the leftover Slice 3 tooltips / RULES body, and the playtest robot's Jarvis-side fixes.
