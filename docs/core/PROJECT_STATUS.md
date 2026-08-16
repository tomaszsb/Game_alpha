# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 16, 2026 (continued)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.9** — deployed and confirmed live. No app version shipped in this session's continuation (infra/ops only).

## Current sprint
**2026-08-16 continued — finished the Docker-side IPv6 fix, then an unplanned incident-response detour.** `game-net` recreated with `--ipv6 --subnet`, confirmed live: `game_alpha` now auto-detects its real home IPv6 address. The multi-session false-foreign-alert fix (host networking earlier the same day, this piece now) is fully closed end to end. Along the way: an attempt to also set IPv6 via Docker's `daemon.json` collided with flags Unraid's own `rc.docker` already passes to dockerd, briefly crashing Docker and taking every container on Tower down — recovered via a pre-made backup (full trap + the safer fix in CLAUDE.md TACTICAL). That recovery surfaced an unrelated, pre-existing bug: `cloudflare-tunnel` had a literal unfilled `YOUR_TOKEN_HERE` placeholder token and had been crash-looping, silently taking `game`/`dashboard`/`api`/`photos.unravelcodes.com` offline from outside — fixed with a real token, all four confirmed reachable again.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. No test run this continuation (zero-game-source session — only `TODO.md`/`deploy.sh` changed); last full-suite baseline **2747/2747** (187 files) from earlier the same day, unaffected.
- **Lint:** not touched this session.
- **Deploy:** v3.2.9 unchanged/still live. Today's real changes were host-level (Tower's Docker networking) and a `deploy.sh` future-proofing line, not a new app version.
- **Dashboard feedback:** not touched this session.
- **Dictionary-scraper (separate repo/deploy):** unchanged this session — though its public dashboard/API were briefly unreachable from outside during the tunnel outage above, now restored.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **G160 restore-picker + hover-highlight (v3.1.95)** — code-complete and deployed, just needs the maintainer's own real-browser confirmation it feels right.
2. **D&D-reskin engagement-data question** — real signal still thin (9 real games in 13 days); current read points at join-friction over board theme. Revisit after another 2-3 weeks of traffic.
3. **Con-Initiation crash + next-action-button highlight** — both still open, no telemetry exists to confirm or rule out either; need a direct real-play repro.
