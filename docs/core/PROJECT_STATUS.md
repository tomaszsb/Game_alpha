# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 22, 2026 (v3.2.71, no code shipped — investigation + planning session)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.71 — LIVE.** `/health` = `d4f4759` = current HEAD (checked 2026-09-22). Was flagged "pending deploy" at the 09-19 handoff and shipped sometime since with no further commits — deploy status and commit history are independent, check `/health` fresh each session rather than trusting this line. 3.2.46 stays permanently skipped.

## Current sprint
**Onboarding Phase C, teaching a beginner the game,** was replanned by Tom on 2026-09-19: **no new tutorial or tip layer** — the helpful wording already exists, so the job is **one help look for the whole game, voiced by one recurring mentor character, reusing the existing wording** (four slices, full text in TODO). **Slice 1 is built (v3.2.71):** the space's own help is now the same "?" as the action rows, one open card across the panel, and the Space Data Editor's preview mirrors it; no new wording. **2026-09-22: two Slice-3 items investigated and planned (not built)** — last night's playtest report's top two confusions (Owner's Money press-and-hold, 24 trips; "deficit", 12 trips) both turned out to be exactly the "four boxes" and "move-on/push-back control" gaps Slice 3 already named. Full file:line plan in TODO.md; two candidate sentences are waiting on Tom's ok/edit/no before building. Still next after that: the mentor (Tom picks who), the remaining Slice 3 gaps (move choices, Rules → "How to play"), then polish. The evidence behind it: of 37 real outside games (robot and maintainer removed) 49% never passed their first two spaces and only 22% opened any help at all — a pointer, not proof.

## Health
- **Tests (v3.2.71):** `npm test` **219 files / 3314 tests green**. Ghost gates (`npm run test:ghost`): **11 files / 43 tests green**; smart-bot seed 100001 **49/50 wins, avgTurns 70.1, 0 hard failures — identical to v3.2.68–70**, as expected (UI-only change). Typecheck ✅; lint 0 errors on the files touched (full `npm run lint` was 0 errors at v3.2.70). 34 tests added, each guard proven by sabotage.
- **Deploy:** ✅ v3.2.71 live, confirmed via `/health` = HEAD (2026-09-22). `bash deploy.sh` is Tom's, from a Windows terminal.
- **Nightly robot:** blind at its start step since v3.2.64 (waits for "THINGS YOU CAN DO"; the header is now "This turn"). The fix is in the Jarvis repo, not here.
- **Dashboard:** fb:93449bf2 deliberately unflipped (needs Tom's eyes on the real TV). fb:ae480630 and fb:11662ac3 (commit highlight, Lender Review) **not flipped — they need a live look.**

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Build the Slice 3 Owner's Money + deficit fix** — plan is ready (TODO.md), waiting on Tom's ok/edit/no on two candidate sentences before implementing.
2. **Slice 2, the mentor** — needs Tom to pick who; I bring three candidates with a sample line each.
3. **The playtest robot** needs its Jarvis-side fix. **Audit II leftovers** (win condition, closed card-family union) are each a dedicated session and Tom's call. **Accessibility** is research-only until Tom asks.
