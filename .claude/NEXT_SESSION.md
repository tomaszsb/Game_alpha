# Next session starter — written 2026-06-06 by /koniec

## State at handoff
- **Version:** v3.0.68 — code in `98a6d23` + version bump in this /koniec commit. ⚠️ **The user deployed `98a6d23`, which still read 3.0.67 in package.json** — the live build is labeled 3.0.67 but contains the 3.0.68 work. A re-deploy after this wrap-up commit syncs the label.
- **Branch:** master, clean after the /koniec commit (only `.claude/settings.local.json` left local).
- **Last shipped:** Cleared all 8 open dashboard reports in three threads — Life Event modal v2 (newspaper bulletin + realized-outcome receipts + 14 de-jargoned L-cards), board/tile editor (tile rename via `display_label_override`, content-aware buffer ghost, Button Labels moved to bottom), dice-space board edges (cheat→FDNY arrow). Plus 2 latent bugs: dead approval-revoke receipt + the silently-broken E2E-01 test.
- **Test suite:** 1623/1623 targeted koniec sweep (components + utils + services). Pre-existing: `try-again-happy` ghost red (known, not run this session).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Phase 2.2 — TurnTransaction boundary.** Last big parallel-systems merge (state TEMP/REAL + log sessions → one transaction). Closes 5 of 7 audit items. Dedicated-session work.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66). Game-level tutorial; the bigger product lever. Design work.
3. **`try-again-happy` ghost gate** — pre-existing red (32/50 wins, overruns 15-min timeout). Recalibrate threshold/timeout, or investigate the regulatory-loop balance behind it.

## Test failures to address
(None new — the koniec sweep is green. `try-again-happy` ghost remains pre-existing red, not a regression.)

## Decisions waiting on the user
- **Re-deploy now?** — to sync the live version label from 3.0.67 → 3.0.68 (functionally identical; cosmetic).
- **Phase 2.2 timing** + **try-again-happy approach** — both carried over.

## Suggested first move
Ask: "Want to re-deploy to bump the live label to v3.0.68, or pick a direction?" The board/tile + Life Event work is best validated in live play — trigger a Life Event (1-in-6 at dice spaces) to see the newspaper modal, and try renaming a tile in the editor. Then choose Phase 2.2 (architectural) / onboarding (product) / try-again-happy (cleanup).

## Reminders
- Deploy runs from **Windows PowerShell**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Confirm the build log `Version:` reads 3.0.68.
- **Follow-up bug (TODO):** CardEffectHandler's non-dice L-draw receipt path snapshots `before` AFTER `drawCards`, so the shared diff's `-1` over-subtracts → possible spurious "lost 1 resource". The common dice-piggyback path (fixed v3.0.68) is correct.
- **Buffer ghost is non-destructive:** existing hand-placed tile layouts may still overlap until re-spaced against the now-larger dashed guides; tiles are not auto-moved.
