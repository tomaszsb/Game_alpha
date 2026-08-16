# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 16, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.9** — pending deploy at session start; user deployed and confirmed live mid-session (build log verified `Version: 75cbbee`) before the final v3.2.9 fix, which is pending its own deploy.

## Current sprint
**2026-08-16 — playtest-stats analysis + two live admin bugs traced and fixed, plus the host-level root cause of the IPv6 false-foreign-alert bug.** Pulled `visitors.log` for the ~3 weeks since the admin stats dashboard shipped and used it to close two TODO items explicitly gated on real playtest signal (D&D-reskin engagement question — real signal thin but points at join-friction, not board theme; two items with no telemetry either way). Investigated and fixed the Site Stats double-login (v3.2.8 — `noopener` was severing `sessionStorage` inheritance into the new tab). A live SMS alert arriving ~16h late led to timestamping the alert text (v3.2.9) and, along the way, actually enabling real IPv6 on Tower's host network (`eth0→bond0→br0`, `accept_ra=2` for the forwarding quirk — full recipe in CLAUDE.md TACTICAL) with the user driving every host-affecting step directly. The game container's own Docker-side IPv6 (`game-net` network + daemon config) is NOT done yet — that's next session's pickup.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2747 passed / 0 failed** (187 files), run twice this session (once per shipped version).
- **Lint:** not touched this session.
- **Deploy:** v3.2.8 + v3.2.9 both confirmed live — user-supplied deploy log verified `Version: 75cbbee` (v3.2.9's commit) running. Host IPv6 change is live on Tower directly (not a game deploy — an Unraid/Docker host config change, persisted via `/boot/config/go`).
- **Dashboard feedback:** not touched this session.
- **Dictionary-scraper (separate repo/deploy):** unchanged this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Docker-side IPv6 for the game container** — host networking is live and persisted; the `game-net` Docker network itself still needs `--ipv6` + a subnet, and `daemon.json` needs IPv6 config (requires stopping the whole Docker service — every container on the box, not just the game — so needs a deliberate maintenance window).
2. **D&D-reskin engagement-data question** — real signal still thin (9 real games in 13 days); current read points at join-friction over board theme. Revisit after another 2-3 weeks of traffic.
3. **Con-Initiation crash + next-action-button highlight** — both still open, no telemetry exists to confirm or rule out either; need a direct real-play repro.
