# Next session starter — written 2026-07-05 by /koniec

## State at handoff
- **Version:** v3.0.96 — **pending deploy** (committed + pushed as `dfecc87`).
- **Branch:** master, clean (wrap-up commit pushed).
- **Last shipped:** `/challenge` reworked from on-a-real-phone feedback — phone vs big-screen split (phone → reminder-first + "Play anyway" warning; tablet/desktop/TV → play-first, fixing tablets mis-treated as phones), one unified "pick how → pick when" reminder flow with a custom date/time, email/text now truly scheduled (`reminderScheduler.js`), a `GameTour` screenshot carousel (drop PNGs into `src/playtest/tour/`), uniform buttons + real SVG share glyph.
- **Test suite:** full suite green this session (exit 0), incl. the E2E-AllPaths tests that were flaky last session. +18 new tests (`tests/playtest/`).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.96, then live-verify on the user's iPhone 16** — the phone view, "Phone alert" → Add-to-Home-Screen flow, carousel, and "Play anyway" warning have only been seen in the headless preview. Deploy: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (Windows terminal).
2. **Finish the screenshot carousel** — user wants more shots. Captured 6; still wanted: mid-game, **won game**, **lost game** (reachable via the state-injection recipe in CLAUDE.md TACTICAL "Capturing a transient modal"/"Live verification by cheating state"), **teacher edit-spaces** (needs the teacher password from the user), a money-deducted modal; re-shoot `01-player-setup` from production (local QR says "localhost only") and swap the rough `12-a-word-explained.png`. `node scripts/capture-game-screenshot.js` regenerates the reachable ones.
3. **Demo video** — script + storyboard were drafted this session (in chat, not a committed file — re-draft from CHANGELOG/this handoff if needed). Needs real footage before the "Watch demo" button goes live.

## Decisions waiting on the user
- **Teacher password** — needed to auto-capture the teacher edit-spaces screenshot (item 2). Otherwise the user captures it by hand and drops it in `src/playtest/tour/`.

## Suggested first move
Deploy v3.0.96 and open `game.unravelcodes.com/challenge?src=vehicle` on the iPhone to check the whole phone funnel for real. Then knock out the remaining carousel shots (won/lost/mid-game via state injection) if the user still wants them.

## Suggested model for next session
**Sonnet 5.** Next session is deploy + real-device verification + straightforward screenshot capture (state-injection is well-documented) — no long-horizon or architecturally ambiguous work. Raise effort to `xhigh` before reaching for Opus.

## Reminders
- Deploy runs from a **Windows terminal**, not WSL.
- Screenshot capture needs BOTH servers up (Express 3001 + Vite 3000) and works against local; for production shots pass `GAME_URL=https://game.unravelcodes.com/`.
- Adding a carousel photo = drop a numbered PNG in `src/playtest/tour/` (caption comes from the filename); no code edit.
