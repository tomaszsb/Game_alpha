# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 5, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.96** — **pending deploy** (production runs v3.0.95's code once the earlier deploy landed; this session's `/challenge` rework is committed/pushed but not yet deployed). Phone-vs-big-screen split on the landing page, one unified reminder flow with true email/text scheduling, and a real game-screenshot carousel.

## Current sprint
**2026-07-05 (session 2) — `/challenge` reworked from on-a-real-phone feedback.** Two views chosen by physical screen size (`isPhoneScreen`): phone → reminder-first ("Play anyway" + warning, no Quick game); tablet/laptop/desktop/TV → play-first (fixes tablets being mis-treated as phones). One unified "pick how → pick when" reminder flow with a custom date/time; device-aware "Phone alert"/"Browser alert" with an inline iOS Add-to-Home-Screen path. Email/text are now **truly scheduled** — `pushScheduler.js` → `reminderScheduler.js` holds push+email+sms in one file-queue. `GameTour` carousel auto-discovers `src/playtest/tour/*.png` (drop a file, no code edit); seeded with 6 real in-game shots via `scripts/capture-game-screenshot.js` (Puppeteer). Uniform buttons + real SVG share glyph. +18 tests.

## Health
- **Tests:** typecheck ✅ + build ✅ clean. **Full suite ran this session: green (exit 0)** — including the E2E-AllPaths tests that were flaky last session.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.96 pending.** Committed + pushed (`dfecc87`). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.96**, then live-verify the `/challenge` funnel on the user's **iPhone 16** — phone view, "Phone alert" → Add-to-Home-Screen flow, and the carousel have only been seen in the headless preview.
2. **Finish the screenshot carousel:** capture the remaining requested shots — mid-game, **won game**, **lost game** (all reachable via the state-injection recipe in CLAUDE.md TACTICAL), **teacher edit-spaces** (needs the teacher password), and re-shoot the player-setup from production (local shot shows "localhost only" on the QR). Swap the rough term-popup shot (`12-a-word-explained.png` shows an AI-draft label). Drop files in `src/playtest/tour/`.
3. **Video demo** — script + storyboard drafted this session (in chat); still needs actual footage before the "Watch demo" button goes live.
