# Next session starter — written 2026-09-28 by /koniec

## State at handoff
- **Version:** v3.2.84 — **deployed.** `/health` → `68fce80`, checked 2026-09-28 ~21:17 EDT, matches HEAD exactly. Re-check `/health` before believing this line.
- **Branch:** master, pushed, clean (only `idea.txt` untracked — read it, never modify or commit it).
- **Last shipped (2026-09-28):** v3.2.83 — a contractor's dice roll could end the whole game instantly, before the player saw the price; fixed generically across every mandatory-fee dice space (not contractor-specific), by moving `checkBankruptcy()` from "immediately after any charge" to "once, at turn-commit." Then v3.2.84 — the corner version badge now names PC/TV/Remote, so a feedback screenshot always says which mode it was taken in.
- **Tests:** full suite 234 files / 3533 tests green (typecheck ✅, build ✅), verified twice this session at the exact shipped commits.
- **GitHub:** no open PRs.
- **Allowance:** ~11% of the week used as of 2026-09-28 evening (reset Monday morning already happened). Plenty of room.
- **Memory-graph MCP tool is broken this session** (schema-validation error on every call — `search_nodes`, `create_entities` both failed identically). Not something a session can fix; if it's still broken next time, skip step 2 again and mention it.

## Top 3 open items (full backlog in TODO.md)
1. **Flip fb:ab383e78 once Tom confirms the contractor fix on a real device** — fixed and deployed in v3.2.83, but the flip needs his say-so per the dashboard-PATCH convention. Also check whether fb:ef974f1c/fb:1ef35f42/fb:b38110f3 (TV/phone screen-disagreement at game-end) are the same root cause — that link is a hypothesis, not confirmed.
2. **TV screen-size follow-up cluster** — 5 reports from the 2026-09-27 real-TV test (sleep-during-play with no wake-lock code anywhere, wrong auto-center target, Bigger/Smaller/Keep panel positioning, no resize option before the game starts, Remote mode resetting a saved screen size). Ready to bundle as one sprint — see TODO.md "📺 Active."
3. **fb:612fbdc4** (scope wording mixes incompatible building types — confirmed real: a player's project scope sums whatever W cards they draw, each authored as its own independent building) needs Tom's direction on fix shape: soften each card's wording, or constrain draws to one building type per player. **fb:4c7a3628** (destination picker with no list) — backend confirmed correct via a new test; needs a live repro, ideally now that the mode badge exists to say which device/mode it happens on.

## Decisions waiting on the user
- fb:612fbdc4's fix direction (see above) — a real design call, not a technical one.
- The "?" placement work (onboarding item, carried over from before this session — still needs Tom's eyes on a real phone).

## Flip after deploy
- **fb:ab383e78** (+ possibly fb:ef974f1c/fb:1ef35f42/fb:b38110f3, unconfirmed link) — fixed and confirmed LIVE (v3.2.84 deployed, `/health` matches HEAD). Only needs the flip once Tom has actually re-tried the contractor-negotiate flow himself and confirms it no longer ends the game unexpectedly — code-confirmed-deployed is not the same as player-confirmed-fixed.

## Suggested first move
Ask Tom whether he's had a chance to re-try the contractor/negotiate flow that used to end games unexpectedly (fb:ab383e78) — if yes, flip it resolved. Otherwise pick up the TV cluster or the fb:612fbdc4 wording-direction question directly.

## Suggested model for next session
Sonnet 5 — the top-3 items are follow-ups from real-device feedback and one design-direction question, not deep architecture work.

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`; `curl` is aliased to `Invoke-WebRequest` — use `curl.exe` explicitly, or run read-only checks yourself.
- **Deploy is Tom's:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm with `/health`.
- **Pull feedback screenshots from the per-id endpoint BEFORE writing up any report as unclear or "no mechanism found"** — the public `/api/public/feedback/open` endpoint never carries one, same gap as the `extra` field. Cost a full dead-end investigation this session until Tom asked directly. Recipe in memory `feedback_screenshot_autoview.md` and `.claude/commands/start.md`.
- **A leftover local `node server/server.js` process was reaped this session** — if verifying UI changes needs both servers again, start Express fresh via Bash and remember to let `/koniec` step 0 reap it next time too.
