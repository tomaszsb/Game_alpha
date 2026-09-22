# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 22, 2026 (v3.2.73)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.73 — pending deploy.** `/health` = `b5187ba` (v3.2.72, checked 2026-09-22 ~17:40). Run `curl -sS https://game.unravelcodes.com/health` before believing this.

## Current sprint
**Onboarding Phase C, teaching a beginner the game,** replanned by Tom 2026-09-19: **no new tutorial or tip layer** — one help look for the whole game, voiced by one recurring mentor, reusing existing wording (four slices, full text in TODO). **Slice 1 shipped v3.2.71.** **Slice 3 mostly shipped (v3.2.72–73, 2026-09-22):** closed the top 2 confusions from the 2026-09-21 playtest report — the press-and-hold control's hint is now a real instruction plus its own "?"; the four glance boxes share one "?" explaining Money/Time/Expeditors/Scope, including "deficit"; every "?" in the game shrank from a 44px touch-target floor to 26px (Tom's direct feedback); the "Rules" header/title renamed "How to play". Only Slice 3 gap left: the 24 movement-choice tooltip rows (`TooltipService.getMovementTooltip`, zero callers today) and the RULES modal's body content (still raw space IDs, "Determine Outcome", "snapshot" — a real rewrite needing Tom's voice pass). Next: Slice 2, the mentor (Tom picks who), then polish. The evidence behind the whole plan: of 37 real outside games (robot and maintainer removed) 49% never passed their first two spaces and only 22% opened any help at all — a pointer, not proof.

## Health
- **Tests (v3.2.73):** `npm test` **219 files / 3317 tests green**. Ghost gates not re-run this session — both v3.2.72 and v3.2.73 are presentation-only (help text, button sizing, one label rename), no game logic/dice/movement/effects touched. Typecheck ✅, build ✅.
- **Deploy:** ⏳ v3.2.73 built and tested, not yet deployed. v3.2.72 is live and was confirmed via `/health` mid-session. `bash deploy.sh` is Tom's, from a Windows terminal.
- **Nightly robot:** blind at its start step since v3.2.64 (waits for "THINGS YOU CAN DO"; the header is now "This turn"). The fix is in the Jarvis repo, not here.
- **Dashboard:** fb:93449bf2 deliberately unflipped (needs Tom's eyes on the real TV). fb:ae480630 and fb:11662ac3 (commit highlight, Lender Review) **not flipped — they need a live look.**

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.2.73** and confirm live via `/health`.
2. **Slice 2, the mentor** — needs Tom to pick who; bring three candidates with a sample line each.
3. **The playtest robot** needs its Jarvis-side fix. **Audit II leftovers** (win condition, closed card-family union) are each a dedicated session and Tom's call. **Accessibility** is research-only until Tom asks.
