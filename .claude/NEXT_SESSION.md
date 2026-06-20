# Next session starter — written 2026-06-20 by /koniec

## State at handoff
- **Version:** v3.0.80 — **deployed + live, commit `9666140`**. No bump this session (no source changed).
- **Branch:** master, clean (only `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`; wrap-up committed + pushed).
- **Last shipped:** nothing new — this was a **verification + finding** session. Walked a Phase 4b authored space in a LOCAL running app and confirmed all four capabilities work end-to-end.
- **Test suite:** unchanged from green baseline (no source touched) — ~2166 pass / 1 skip, modulo 3 confirmed-flaky env failures. **Typecheck + build clean** (re-run this session).

## What got verified (so you don't redo it)
Authored "City Inspection Roulette" on the `OWNER-FUND-INITIATION → PM-DECISION-CHECK` edge (card draw + 10%-of-scope fee + 6-face dice), baked, walked via Express `localhost:3001`:
- **Splice routing** ✓ (FUND rerouted through the authored space; edge + tile rendered, auto-midpoint placement)
- **Card draw** ✓ (auto-dealt 1 E card, Expeditors 3→4)
- **`SCOPE_PERCENTAGE` fee** ✓ (cash $2.3M→$2M, ~$277K = 10% of $2.77M scope; not tied to the 20% cap, as designed)
- **Dice routing** ✓ (rolled 6 → LEND-SCOPE-CHECK, matching the configured face)

Recipe for repeating a local walk is in CLAUDE.md TACTICAL ("Walking an authored space locally"). classroom-1 config + resolved board were restored to clean stock afterward.

## Top 3 open items
1. **LIVE-prod walk** — the user is driving this themselves (game.unravelcodes.com → Admin Tools → 🏫 Classroom Setup → author a space on a fixed edge → start a game → walk it). Local is done; this is the last real-running-app confirmation.
2. **Fix the validator/engine dice-detection drift** (found this session, in TODO) — `validateInsertions` uses `requires_dice_roll` where the engine uses `die_roll='Next Step'`, so splicing onto the fixed edge of a card/time/fee-rolling space is wrongly rejected with a misleading error. Fix: align `isDice` to `die_roll==='Next Step'`. Low severity, has a workaround.
3. **UI redesign — player panel + scoreboard** (deploy-independent; design handoff ready) + the mobile board-bleed-through bug.

## Decisions waiting on the user
- **Authored scope fees + the 20% cap** — shipped *not* tied to the design-fee game-over cap (so no teacher-made instant-loss spaces). Re-open only if you want authored fees to count toward that cap.

## Suggested first move
The user said they'd do the live walk themselves — so either pick up the **validator-drift fix** (small, scoped, ~30 min) while they do that, or jump to the deploy-independent **UI redesign / mobile board-bleed bug**. Which appeals?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **Verify per-instance/authored boards via Express (`localhost:3001`), NOT Vite (`3000`)** — Vite serves `/data` from `public/` (stock). Local-walk + clean-reset recipe is in CLAUDE.md TACTICAL.
