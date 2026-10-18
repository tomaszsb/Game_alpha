# Next session starter — written 2026-10-18 by /koniec

## State at handoff
- **Version:** v3.8.16 **LIVE** (`/health` `9f6d182f`, deployed 19:02 UTC 10-18: TV loading tip fixed; v3.8.15 went out 18:50 on Tom's go "today only"; the deploy test gate ran on the Tower: 4001/4001). Re-read `/health`.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped 10-18 (one session, Manager briefs from the independent review):** 3.8.8-3.8.13 review bugs (last work package stays, push-back keeps life events, NPC wording, one bank-fee source + 20% warning on peakScope, deploy test gate, glossary fail-soft); 3.8.14 one "Move on" name (Tom kept press-and-hold); 3.8.15 certificate questions (3 fun + 2-3 "why" from the player's own trophy row and stops; answers print on the certificate; saved to `DATA_DIR/class-answers.jsonl` with name/game code/answers/date only; admin list in Site Stats) + PLAYTEST-2 fixes (Cut a Corner states its stakes, remove-list wording + prices, Favor Called In "-2 days", bank lends what you're short, debrief counts expeditors USED). Restore guide in ARCHITECTURE.md, untested.
- **Tests:** `npm test` 288 files / 4001 green; ghost 45 passed / 1 skipped; build clean. Typecheck: pre-existing errors only in `tests/server/dataGate.test.ts` (express types, since v3.8.5).

## Top 3 open items
1. **N3: PLAYTEST.md Part 2 design ideas, data first** (ranking in PLAYTEST-2.md: fix-or-steer at Site Inspection #1, TR8 test now/later at Trouble On Site #2, the forced owner expeditors + "Add a team member" taps). Also Q6 why-tips (cause + odds from data, max one paragraph, in the EXISTING tips/hover/help). All in TODO "From the 2026-10-18 independent review".
2. **Certificate step not seen on a real phone.** The form (3 Yes/Maybe/No buttons, 2-3 text boxes per section) was only type-checked and unit-tested; nobody reached a real end screen. Check at 360x640 and 390x844 (phone-panel rule) and on PC.
3. **Rest of the PLAYTEST UI list:** builder hire is one tap for $800K+ while signing needs a hold; pop-ups close with different words; optional and required actions look alike. Robot taps `commit-end-turn` and `builder-bid-hire`: making either a hold breaks it.

## Decisions waiting on the user
- **Samsung/LG TVs from 2021 or older can't run the game** (build target `es2020` needs Chromium 80+; Samsung 2021 = M76). The 10-s tip now tells them to mirror a laptop/phone. Lowering the target + `@vitejs/plugin-legacy` is Tom's call (bigger bundle, needs a real-TV test). Details: CHANGELOG 3.8.16.
- Backups: nothing copies `.env` or `server/data` off the Tower (ARCHITECTURE.md "If the server dies"). Teacher password resets.
- The old "Money/scope vanished" report (10-12) is probably the v3.8.8 cause; ask Tom whether to close it.

## Suggested first move
Check `/health`; ask Tom to play one game to the certificate on his phone; then N3.

## Suggested model for next session
Sonnet 5: N3 is mostly CSV rows plus small engine checks.

## Reminders
- Deploy: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never 02:45-04:45 EDT (Jarvis robot + update). Tom's deploy go was for 10-18 only.
- Reading live game records (games.json, visitors.log greps) and running extra containers on the Tower were refused by the permission check this session.
