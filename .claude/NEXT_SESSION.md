# Next session starter — written 2026-06-11 by /koniec

## State at handoff
- **Version:** v3.0.70 (deployed 2026-06-09; no new version this session)
- **Branch:** master, clean after wrap-up commit
- **Last shipped:** v3.0.70 (Phase 2.2 TurnTransaction + smart-bot 90% calibration)
- **This session:** audit + bug triage only — no source changes. Produced `docs/technical/DEFICIENCY_AUDIT.md`; triaged 3 new dashboard reports into TODO.
- **Test suite:** 1628/1628 passing (re-confirmed). Pre-existing: 0 failures.
- **Build/typecheck:** clean. **Lint:** 386 errors (long-standing config issue, not a regression — DEF-4).

## Top 3 open items
1. **Bank-loan button mislabeled "Accept Owner Funding"** (fb:...06e5d66f) — real v3.0.70 bug, easy fix. `FinancesSection.ts:373` hardcodes the fallback for ALL funding draws; make it source-aware (draw_b→Bank Loan, draw_i→Investment). Wrong label is also in live data (migrated 2026-06-09) but the code-default fix lands on a normal deploy.
2. **Result modal flash-closes on fast click** (fb:...ac29b623) — apply the v3.0.9 modal-queue pattern to the shared DiceResultModal (currently a synchronous toggle; reopening mid-exit-animation swallows the new modal). Confirm with a fast-click repro first.
3. **Security gaps from the audit** (DEF-2, DEF-6) — WebSocket `subscribe` skips token auth (state readable without token); feedback-read endpoints unauthenticated + expose reporter PII. See DEFICIENCY_AUDIT.md.

## Test failures to address
(None — suite is green.)

## Decisions waiting on the user
- Whether to fix the 2 real bugs (#1, #2 above) now, and how far to go on the audit security findings (DEF-2/DEF-6) vs leave as documented. User was offered the fixes and chose to queue them in TODO instead.

## Suggested first move
The two playtest bugs (#1, #2) are the highest-value, lowest-risk work — #1 is a ~10-line source fix. Want to start there, or take on the audit's security findings (DEF-2 WebSocket auth is the sharpest)?

## Reminders
- Deploy command runs from a **Windows terminal**, not WSL (ssh `unraid` alias is Windows-only).
- Bug #1's data side is a casualty of the data-deploy gap — fix the code default, don't chase the CSV alone.
- Full deficiency list lives in `docs/technical/DEFICIENCY_AUDIT.md`; new bug reports are in TODO under "Dashboard reports — 2026-06-11 playtest".
