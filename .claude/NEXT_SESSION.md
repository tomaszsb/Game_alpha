# Next session starter — written 2026-06-07 by /koniec

## State at handoff
- **Version:** v3.0.69 — **deployed 2026-06-07**.
- **Branch:** master, clean after the /koniec commit (only `.claude/settings.local.json` local).
- **Last shipped:** Dashboard housekeeping (8-report flip) + ghost `try-again-happy` gate split (coverage vs smart-bot) + two Life-card fixes (receipt off-by-one + fb:931a55de voice/L049-draw).
- **Test suite:** 1634/1634 targeted koniec sweep (components + utils + services + card-integrity) green. 0 pre-existing failures.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Finalize the smart-bot win floor** — the new `try-again smart-bot` test floor is a placeholder `≥32`; its calibration run got interrupted by machine sleep. Re-run `npx vitest run tests/ghost/ghostPlayer.test.ts -t "smart-bot"` (~17 min), set floor = measured − ~4, fill the two `<!-- CALIBRATE -->` markers (CHANGELOG + ghost test), remove the TODO finalize item. Smart ≥ blind(32) so the placeholder is safe meanwhile.
2. **Phase 2.2 — TurnTransaction boundary** — last big parallel-systems merge (state TEMP/REAL + log sessions → one transaction). Dedicated-session work.
3. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66) — game-level tutorial; the bigger product lever.

## Test failures to address
(None — sweep is green.)

## Decisions waiting on the user
- (None pending.) v3.0.69 deployed 2026-06-07. Optional: validate the Life-card fixes in live play — trigger a Life Event (receipt should show no phantom "lost 1 resource"); draw L049 "Permitting Process Overhaul" to confirm an *expeditor* is granted (not a Work Package).

## Suggested first move
Quick win: re-run the smart-bot calibration (item #1) to close out the ghost-gate work cleanly, then pick between Phase 2.2 (architectural) and the onboarding package (product). v3.0.69 is already live, so the Life-card fixes can be spot-checked in play whenever.

## Reminders
- Deploy runs from **Windows PowerShell**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Confirm the build log `Version:` reads 3.0.69.
- The ghost `negotiate-coverage` + `smart-bot` tests each take ~17 min — NOT in the koniec sweep; run explicitly. A frozen output mtime = machine slept, not a hang (every game is 30s-capped).
- `try-again-happy` is gone — replaced by `negotiate-coverage` (blind, 0-hard-failures) + `smart-bot` (rational, win-rate).
