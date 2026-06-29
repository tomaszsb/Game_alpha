# Next session starter — written 2026-06-29 by /koniec

## State at handoff
- **Version:** v3.0.87 — **PENDING DEPLOY** (built + pushed; deploy command handed to the user this session — confirm it actually went live).
- **Branch:** master, clean apart from the usual `.claude/settings.local.json` + untracked `.claude/ghost-*` scratch (now gitignored).
- **Last shipped:** Cluster B leftovers (glossary dup-key, roll-result clarity, expeditor-replace phase chip) + a full **no-game-language copy sweep** (no die number/🎲/🃏 in player copy; Life Event=📰, generic=📄). Touches the live default game.
- **Test suite:** typecheck + build clean; targeted sweep (components/utils/services) **1719/1719 green**; ghost fast unit tests green. ⚠️ The 50-game ghost gates were NOT run this session (~50 min) — run them if touching engine/movement/cards.
- **Build/typecheck:** clean.

## Top 3 open items
1. ~~Land the teacher card-insertion feature.~~ **RESOLVED 2026-06-29 — it was already merged + deployed live** (the "built but unmerged" note was stale; feature code is in `server/instanceStore.js` + `server/server.js`, live since pre-v3.0.87). The `phase-4a-card-insertion` branch was a fully-merged leftover and has been deleted. No action remains.
2. **Onboarding Phase C** — plain-English aliases for tile/button labels (newcomer mode). Core to the non-DOB-savvy-player goal; blocked only on the maintainer writing the alias strings. (Plus the fuller Project Chronicle P2–P5.)
3. ~~Dashboard PATCH sweep~~ **DONE 2026-06-29.** Flipped 5 resolved reports to `resolved` (v3.0.87 Cluster B: 31e5c4b8, 76fa69c7; v3.0.88 batch: 44df6d5d, 341475d7, f4d0e327) — open count 37→32. The "glossary one" was a console-only React dup-key warning with no feedback report, so nothing to flip. ⚠️ The PATCH endpoint is now **token-gated** (was open when the old recipe was written): `?token=<FEEDBACK_TOKEN>` required.

## Test failures to address
Green — targeted sweep 1719/1719. (Full ghost gate not run; not a known failure.)

## Decisions waiting on the user
- **New panel default — DECIDED 2026-06-29: not yet** (panel not ready; stays opt-in). No longer open.
- ~~Merge the phase-4a teacher card-insertion branch?~~ **Moot — already merged + deployed live (resolved 2026-06-29).**

## Suggested first move
First confirm v3.0.87 is live (the deploy was handed over this session) — check the version badge / `docker logs`. Then: do you want to **land the teacher card-insertion feature** (merge + deploy the phase-4a branch), or pick up **onboarding Phase C** (you'd supply the plain-English alias strings)?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Commit + push BEFORE deploy (done this session).
- The Parking lot at the bottom of TODO.md is deferred-not-active — don't treat it as the backlog.
