# Next session starter — written 2026-07-12 by /koniec

## State at handoff
- **Version:** v3.0.120 built, **v3.0.115 deployed** (commit `b46cb30`, confirmed by maintainer). v3.0.116–120 pushed to master, awaiting the next `deploy.sh` run.
- **Branch:** master, clean after this session's wrap-up commit.
- **Last shipped:** v3.0.120 — closes the entire 10-item 2026-07-11 blind code review batch. No new version this session; this was a docs/decisions-only follow-up (zero `src/`/`server/`/`tests/` diff).
- **Test suite:** 2368/2369 passing, 1 skipped, 0 failures — baseline from commit `157b385`, confirmed unchanged this session (`git diff --stat 157b385..HEAD -- src/ server/ tests/ public/data/` is empty). Full suite was NOT re-run (zero-game-source session, see CLAUDE.md `/koniec` rule) — re-run if picking up with source changes already in flight.
- **Build/typecheck:** clean (verified this session).

## Top 3 open items
1. **Deploy v3.0.116–120**, then run the standard dashboard PATCH sweep (likely nothing to flip — `.claude/fixloop/flip-queue.txt` is empty).
2. **Push-back/Lock-the-scope buttons: build the cost preview** (fb:feedback-1783080349985-a3dc215f) — **spec is now locked, no decision pending.** Hover-triggered per-button breakdown, 2-column × 5-row (Labor/Work/Expediting/Money/Time). Confirmed via code the two buttons genuinely cost different amounts (Lock = base cost once; Push back = extra day + reverts card draws). Ready for a build session.
3. **CSV-portability lift** (~half a day) — new item scoped this session. `ApprovalService.ts:37-74`, `src/constants/characters.ts`'s `CHARACTER_MAP`/`PM_VOICED_SPACES`, `theme.ts` card-type labels, and 2 spots that string-match CSV flavor text all hardcode real-world names/strings that would block the maintainer's long-term goal of a content-only (e.g. fantasy) reskin. Full blocker list in TODO.md Active section.

## Test failures to address
(None — see baseline note above.)

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange once in the editor (drag-save persists now).
- **Bank/Investor/Lender character naming** — 6 spaces show phase-only labels; user is marinading. **Don't nudge.**
- **Homeowner starting scenario — direction decided, specifics still open.** Maintainer wants a distinct violation mechanic (not a reskin of `REG-DOB-AUDIT`, the closest existing analog). Still needs a design pass: what does facing the violation require the player to do, and how does it resolve? Not code-ready yet.

*(4 of the original 5 "Decisions waiting on the user" were resolved this session via a maintainer interview: Workstream 2 criterion → rewrite it, don't do the REAL/TEMP replacement (parked with a trigger); dictionary-scraper `ANTHROPIC_API_KEY` → keep AI-writing + label entries clearly; the push-back button spec (above); and the homeowner scenario's top-line direction (above). Full detail in TODO.md, commit `03e1cb7`.)*

## Suggested first move
Deploy v3.0.116–120 first — nothing blocking it. After that, the bug-hunting batch (10-item blind review) is **fully closed** — there isn't a queued next batch of bugs. The next loop of real work is the two now-scoped feature items above (push-back preview, CSV-portability lift), which are build-ready without further maintainer input. Good candidates for another `/loop /fixloop`-style pass, or a normal build session — your call.

## Suggested model for next session
**Sonnet 5** — the deploy is a human action, and both build-ready items (push-back preview, CSV-portability lift) are well-scoped UI/refactor work, not architecturally ambiguous.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- If touching anything in the TEMP/REAL turn-state system (`StateService`, `TurnStateManager`), read the CLAUDE.md TACTICAL entry on `updateTempState`'s fallback path and `realStates` staleness first.
- **If you suspect another Claude Code session is open on this same checkout** (files changing that you didn't touch, a commit landing with a different message than you wrote, `.claude/fixloop/state.json` updating itself) — that's a known, real scenario, not a bug. See the new CLAUDE.md TACTICAL entry "Two interactive Claude Code sessions sharing one working tree" for the diagnostic signals and what to do about it.
- Fixloop budget meter drifts behind the official `/usage` % over a long session — recalibrate with `/fixloop calibrate <pct>` whenever the user reports a mismatch.
