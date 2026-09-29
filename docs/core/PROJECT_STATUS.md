# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 28, 2026 (v3.2.84)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.84 — LIVE.** `/health` → `68fce80`, checked 2026-09-28 ~21:17 EDT, matches HEAD exactly. Trust `/health`, never this line.

## Current sprint
**Real-device feedback triage, following Tom's TV+phone test of v3.2.82.** This session: a full feedback sweep (26 untracked reports triaged, Manager set the fix order), then the top-priority item — a contractor's dice roll could end the whole game instantly, before the player saw the price (fb:ab383e78). Root-caused to `checkBankruptcy()` firing synchronously mid-effect-processing; fixed generically across every mandatory-fee dice space (v3.2.83), not contractor-specific, per Tom's own "maybe the function can be reused" instinct. Also shipped v3.2.84 (Tom's idea, prompted by a fb:4c7a3628 dead end): the corner version badge now names PC/TV/Remote, so a feedback screenshot always says which mode it was taken in.

## Health
- **Tests (v3.2.84):** `npm test`-equivalent full suite **234 files / 3533 tests green**, including all four long-running ghost-bot gates (strict 50-game, smart-bot Try Again, aggressive-negotiate, full-board coverage). Typecheck ✅, build ✅. Lint not re-run this session.
- **Deploy state:** v3.2.84 confirmed live (`/health` matches HEAD exactly).
- **Weekly allowance (read 2026-09-28):** Pro plan, ~11% used (reset Monday 2026-09-28 already happened this morning). Plenty of headroom.
- **Feedback backlog:** dashboard had 34 open at session start; 26 were untracked in TODO/CHANGELOG. All 26 now sorted — 4 folded into the fb:ab383e78 fix (deployed, needs a flip once Tom confirms), 1 flipped resolved already (fb:3196fe42, already fixed by v3.2.78), the rest triaged into TODO's active/parking-lot sections with clear next steps. See TODO.md for the full list.
- **Nightly robot:** its `TAB_SUFFIX_RE` regex in the Jarvis repo still needs to accept both "tap to compare" and "tap to see the cost" (cosmetic; not this repo).
- **GitHub:** no open PRs.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Flip fb:ab383e78 (+ possibly fb:ef974f1c/fb:1ef35f42/fb:b38110f3) once Tom confirms v3.2.83's fix on a real device** — the contractor-bankruptcy bug is fixed and deployed; the TV/phone-screen-disagreement reports are only a hypothesis pending confirmation.
2. **TV screen-size follow-up cluster** (5 reports from the 2026-09-27 real-TV test: sleep-during-play, wrong auto-center, Bigger/Smaller/Keep panel positioning, no resize option pre-game, Remote resetting saved size) — ready to bundle as one sprint.
3. **fb:4c7a3628** (destination picker with no list) — investigated deeply, backend confirmed correct via a new regression test; needs a live repro with the new mode badge to pin down further. **fb:612fbdc4** (scope wording mixes building types) — confirmed real, needs Tom's direction on which fix (soften wording vs. constrain card draws).
