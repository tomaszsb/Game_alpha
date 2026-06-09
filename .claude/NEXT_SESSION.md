# Next session starter — written 2026-06-08 by /koniec

## State at handoff
- **Version:** v3.0.70 — **committed + pushed, PENDING DEPLOY** (not yet live).
- **Branch:** master, clean after the /koniec commit (only `.claude/settings.local.json` local).
- **Last shipped:** Phase 2.2 TurnTransaction boundary + smart-bot calibration (90% goal met) + cheat-space fb:89d9f101(b) verified-already-fixed-and-locked + 3 `any` narrowings. Internal hardening only — no player-facing change.
- **Test suite:** 1628/1628 koniec sweep (components + utils + services) green. 0 failures. Smart-bot ghost gate deterministic 47/50 (floor ≥43).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.70** — committed + pushed, not yet live. Low risk (internal only); after deploy, spot-check a normal turn + a Try Again.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66) — game-level tutorial; the biggest remaining product lever (recurring "overwhelming for newcomers" theme).
3. **Game-length watch** — smart-bot avgTurns=149. Not urgent. Trigger to trim mechanics/space requirements: when a *real* playtest game runs past ~40 min (a class period).

## Test failures to address
(None — sweep is green.)

## Decisions waiting on the user
- **`.claude/ghost-history.jsonl`** — new untracked file (per-run ghost numbers). Decide: gitignore (per-machine) or commit (cross-machine baseline). Left untracked for now.
- Optional: surface the last ~5 ghost-history runs at `/koniec` + `/start` so the win/avgTurns trend is visible session-to-session.

## Suggested first move
Deploy v3.0.70 first (`ssh unraid ...` from a **Windows** terminal — confirm the build log reads `3.0.70`), then either start the onboarding package or pick from the dashboard backlog. Want to deploy + spot-check, or jump straight into onboarding?

## Reminders
- Deploy runs from **Windows PowerShell**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The smart-bot ghost test now runs ~25 min (was ~17) — `perGameTimeoutMs=120000` lets games finish for a deterministic count. Results auto-append to `.claude/ghost-history.jsonl`. Still NOT in the koniec sweep — run explicitly.
- If the smart-bot floor (≥43) ever flakes low, suspect host load/a slower machine (timeouts) before a balance regression.
