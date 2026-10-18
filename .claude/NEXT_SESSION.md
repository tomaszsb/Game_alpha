# Next session starter — written 2026-10-18 by /koniec

## State at handoff
- **Version:** v3.8.22 **LIVE** (`/health` `0a16d4fb`, deployed 22:13 UTC 10-18: 3.8.22 Hire a Special Inspector fork after the builder, 3.8.21 push-back at The Audit / Fire Dept. Review spends an expeditor instead of days (`try_again_e_cost`); 3.8.20 at 21:25: owner hands 1 expeditor, forced taps cut (Tom "Cut them"; smart-bot 44/50, avg 78 turns); 3.8.19 at 20:49: 3.8.18 Site Inspection fork fix/steer, 3.8.19 Trouble On Site fork test now/later (smart-bot 43/50, avg 66 turns, was 98); 3.8.17 "why this happens" help at Trouble On Site / Site Inspection / The Audit; 3.8.16 TV loading tip 19:02; v3.8.15 went out 18:50 on Tom's go "today only"; the deploy test gate ran on the Tower: 4001/4001). Re-read `/health`.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Shipped 10-18 (one session, Manager briefs from the independent review):** 3.8.8-3.8.13 review bugs (last work package stays, push-back keeps life events, NPC wording, one bank-fee source + 20% warning on peakScope, deploy test gate, glossary fail-soft); 3.8.14 one "Move on" name (Tom kept press-and-hold); 3.8.15 certificate questions (3 fun + 2-3 "why" from the player's own trophy row and stops; answers print on the certificate; saved to `DATA_DIR/class-answers.jsonl` with name/game code/answers/date only; admin list in Site Stats) + PLAYTEST-2 fixes (Cut a Corner states its stakes, remove-list wording + prices, Favor Called In "-2 days", bank lends what you're short, debrief counts expeditors USED). Restore guide in ARCHITECTURE.md, untested.
- **Tests:** `npm test` 288 files / 4001 green; ghost 45 passed / 1 skipped; build clean. Typecheck: pre-existing errors only in `tests/server/dataGate.test.ts` (express types, since v3.8.5).

## Top 3 open items
1. **N3 rest (not started):** Inspector sign-off (full report vs sign today), the expeditor pick fork (veteran / junior / yourself), TCO vs final CO, bad expeditor cards firing on draw. Done today: fix/steer, TR8, forced expeditors cut, send-your-expeditor, Special Inspector. Watch real games: 8 new spaces (tiles x=1020 y=350-680, x=1220 y=130-460) never seen on a real TV or phone. Fix/steer and TR8 are LIVE (v3.8.18/19); watch real games for the new fork spaces (tiles at x=1020 y=350-680). Q6 why-tips STARTED (v3.8.17, 3 spaces: one `why,<SPACE>` row each in ACTION_TOOLTIPS.csv; odds auto from DICE_OUTCOMES); next: more spaces, Fire Dept. Review wording, the end page. All in TODO "From the 2026-10-18 independent review".
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
