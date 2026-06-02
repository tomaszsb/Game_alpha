# Next session starter — written 2026-06-01 by /koniec

## State at handoff
- **Version:** v3.0.55 — **pending deploy.** v3.0.52–55 committed + pushed to GitHub. Run deploy from Windows terminal.
- **Branch:** master, clean. Untrackers only: `.playwright-mcp/`, `Mockups/`, `editor-snapshot.yml`, `.claude/fb-fc65c217.png`.
- **Last shipped:** v3.0.55 — Web Audio turn chime fallback for Comet, BoardCanvas + ledger pill tests (9+3), PATCH-flip 3 reports, PlayerLogSection verified clean.
- **Test suite:** 1588/1588 (86 files, targeted sweep). +12 tests vs session start.
- **Build/typecheck:** both clean.

## Top 3 open items
1. **Deploy v3.0.52–55.** `ssh unraid "cd /mnt/user/appdata/Game_alpha && git pull && docker compose build && docker compose up -d"` — run from Windows terminal, not WSL.
2. **Verify Comet audio cue after deploy.** The double-beep chime (`primeAudio()` + `playTurnChime()`) was implemented but not live-tested on Comet. On the next Comet play session: tap to enter → take a turn → confirm you hear two short tones. If still silent, the AudioContext may be suspended between tap and WS-triggered turn-start (the gap is ~100ms–2s depending on server round-trip). Next step if silent: audio context resume on every `turnNotification` call instead of just at prime time.
3. **Pick the next feature cluster.** Several clean TODO items remain: (a) Workstream 3 Phase B+ board editor enhancements (`fb:d27a73d0` — per-edge show/hide + waypoint redirect); (b) HTTP polling fallback while disconnected (TODO line 217); (c) cross-device bug capture (TV aggregates phone log buffers on WS heartbeat, TODO line 236).

## Test failures to address
(None — 1588/1588 green.)

## Decisions waiting on the user
- **Top-3 #2** — does the audio cue land on Comet, or is a different approach needed (audio context re-resume on every vibrate call)?
- **Top-3 #3** — which cluster next: board editor, HTTP polling, or cross-device bug capture?

## Suggested first move
Deploy v3.0.52–55 first (one command), then do a quick Comet playtest to verify the chime. After that, if the chime works, flip `fb:6e1e8ac4` on the dashboard and pick from the feature backlog.

## Reminders
- Deploy command runs from **Windows terminal**, not WSL.
- **Push before deploy** — `git log origin/master..master --oneline` should return empty before handing over the deploy command (bit us in v3.0.44).
- Full `npm test` hangs on Windows; use targeted sweep: `tests/components/ tests/utils/ tests/services/`.
- `money_effect` encodes E-card activation cost (not `card.cost`). Both must be checked for affordability — see CLAUDE.md TACTICAL 3.26.
- `scripts/check-sync.sh` now compares local/remote/live in one command.
