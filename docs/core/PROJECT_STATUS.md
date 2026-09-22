# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 22, 2026 (v3.2.72)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.72 — pending deploy** (built + tested this session, not yet pushed to production). Run `curl -sS https://game.unravelcodes.com/health` before believing this — deploy status and commit history are independent facts.

## Current sprint
**Onboarding Phase C, teaching a beginner the game,** was replanned by Tom on 2026-09-19: **no new tutorial or tip layer** — the helpful wording already exists, so the job is **one help look for the whole game, voiced by one recurring mentor character, reusing the existing wording** (four slices, full text in TODO). **Slice 1 is built (v3.2.71):** the space's own help is now the same "?" as the action rows, one open card across the panel, and the Space Data Editor's preview mirrors it; no new wording. **Slice 3, PARTIAL (v3.2.72, same day as the investigation, once Tom said to just build it):** closed the top 2 confusions from the 2026-09-21 playtest report — the press-and-hold control's hint is now a real instruction (was a 9.5px footnote) plus its own "?"; the four glance boxes share one "?" explaining Money/Time/Expeditors/Scope, including what "deficit" means. Also, live feedback mid-session: every "?" in the game shrank from a 44px touch-target floor to 26px to match the header toolbar's icon buttons. Still open from Slice 3: the 24 movement-choice tooltip rows, and Rules → "How to play". Next after that: the mentor (Tom picks who), then polish. The evidence behind the whole plan: of 37 real outside games (robot and maintainer removed) 49% never passed their first two spaces and only 22% opened any help at all — a pointer, not proof.

## Health
- **Tests (v3.2.72):** `npm test` **219 files / 3317 tests green** (+3 from v3.2.71, pinning the two new "?" behaviors). Ghost gates not re-run this session — the change is presentation-only (help text, button sizing), no game logic touched. Typecheck ✅, build ✅.
- **Deploy:** ⏳ v3.2.72 built and tested, not yet deployed. `bash deploy.sh` is Tom's, from a Windows terminal.
- **Nightly robot:** blind at its start step since v3.2.64 (waits for "THINGS YOU CAN DO"; the header is now "This turn"). The fix is in the Jarvis repo, not here.
- **Dashboard:** fb:93449bf2 deliberately unflipped (needs Tom's eyes on the real TV). fb:ae480630 and fb:11662ac3 (commit highlight, Lender Review) **not flipped — they need a live look.**

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.2.72** and confirm live via `/health`.
2. **Slice 2, the mentor** — needs Tom to pick who; I bring three candidates with a sample line each.
3. **The playtest robot** needs its Jarvis-side fix. **Audit II leftovers** (win condition, closed card-family union) are each a dedicated session and Tom's call. **Accessibility** is research-only until Tom asks.
