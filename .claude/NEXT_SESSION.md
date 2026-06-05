# Next session starter — written 2026-06-05 by /koniec

## State at handoff
- **Version:** v3.0.67 (deployed 2026-06-05, user-deployed, commit `c455813` pushed; doc/TODO follow-ups in `62f6e9a` + this /koniec sweep).
- **Branch:** master, clean (this /koniec's doc sweep is committed).
- **Last shipped:** Final Review "Accept does nothing" crash fix — v3.0.66 Phase 2.1 reintroduced the v3.0.61 crash by deleting v3.0.62's inline gate override; `MovementExecutor` now reconciles a stale `moveIntent` against the live resolver. Plus bug-reporter console-log fix (stale-closure + default-on + toast confirms).
- **Test suite:** 1602/1602 canonical sweep, 1663/1663 broad. Pre-existing: 0 in those sweeps.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Phase 2.2 — TurnTransaction boundary.** The last big parallel-systems merge (state TEMP/REAL + log sessions → one transaction). 5 of 7 audit items closed after this. Dedicated-session work, "DO NOT do casually."
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66). Game-level tutorial; the bigger product lever. Design work.
3. **`try-again-happy` ghost gate (NEW, pre-existing red).** 32/50 wins vs ≥40 needed + overruns its 15-min timeout. Verified identical on v3.0.66 baseline — NOT a regression. Recalibrate threshold/timeout, or investigate why ~36% of aggressive-Try-Again games loop in the regulatory cluster. See TODO "Ghost win-rate tracking."

## Test failures to address
(None — green.)

## Decisions waiting on the user
- **Phase 2.2 timing** — when to schedule the dedicated block.
- **try-again-happy** — recalibrate the stale gate vs. investigate the regulatory-loop balance issue.

## Suggested first move
Ask: "Anything off from the v3.0.67 Final Review fix in live play, or ready to pick a direction?" The highest-value validation is to reach `REG-DOB-FINAL-REVIEW` missing an approval and hit Accept — it should bounce you back cleanly, no red error. Then choose Phase 2.2 (architectural) / onboarding (product) / try-again-happy (cleanup).

## Reminders
- Deploy runs from **Windows PowerShell**: `ssh root@192.168.86.57 "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **Strict ghost gate is the authoritative movement gate** (~13 min, `-t "strict"`). The `try-again-happy` variant is pre-existing red — don't block a ship on it; it also needs a >17-min timeout to even finish.
- Bug reports: the `/api/public/feedback/open` summary strips screenshots/console/gameState — fetch the full `curl https://game.unravelcodes.com/api/feedback/<id>.json` record (screenshot diagnosed this session's crash).
- `package.json` bump before tagging: `package.json` + both `package-lock.json` entries. Push before deploy.
