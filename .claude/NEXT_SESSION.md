# Next session starter — written 2026-10-20 by /koniec

## State at handoff
- **Version:** v3.8.27 **pushed (`63897bef`), PENDING DEPLOY.** Live is v3.8.26 (`/health` `0f360f74` at 10-19 16:03 UTC). Re-read `/health`.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Last shipped (built, not deployed):** SUNY Farmingdale classes (Manager brief 10-19): `/class` names Farmingdale (courses 350/409) with plain steps (finish one whole game, win or lose; leave one comment with the red bug button, a sample button is drawn; check course + print); certificate step has Course 350 / Course 409 buttons plus a bug-button reminder (no anti-cheat, Tom: cheating does not matter); printed page shows both boxes, chosen one ticked; `course` saved in `class-answers.jsonl`; Site Stats lists it and counts each course. Course is chosen only at the certificate (Tom confirmed).
- **Tests:** `npm test` 299 files / 4042 green; build clean; typecheck only the pre-existing `tests/server/dataGate.test.ts` express-types errors. Ghost: 45 passed, 1 skipped.
- **Verified by eye:** `/class` and the printed certificate at 360 wide (no sideways scroll, check mark draws). NOT seen: the form on a real end screen/phone, a real saved PDF.

## Top 3 open items
1. **Deploy v3.8.27 (Tom), then one real run:** `/class` on a phone, play to the end, tick a course, print to PDF; read it under Admin > Site Stats > Class answers. Same run covers the old "certificate step not seen on a real phone" item (360x640, 390x844).
2. **N3 rest (not started):** Inspector sign-off, expeditor pick fork, TCO vs final CO, bad expeditor cards firing on draw. Watch real games for the 8 new fork spaces (tiles x=1020 y=350-680, x=1220 y=130-460). Q6 why-tips: more spaces, Fire Dept. Review wording, the end page. All in TODO "From the 2026-10-18 independent review".
3. **Rest of the PLAYTEST UI list:** builder hire is one tap for $800K+ while signing needs a hold; pop-ups close with different words; optional and required actions look alike. Robot taps `commit-end-turn` and `builder-bid-hire`: making either a hold breaks it.

## Decisions waiting on the user
- **Farmingdale:** student count and start date unknown. A per-course "who finished" list for Kossi would be a small Site Stats addition, but Kossi has no admin access; told the Manager, not built.
- **Samsung/LG TVs from 2021 or older can't run the game** (build target `es2020`). Lowering the target + `@vitejs/plugin-legacy` is Tom's call (CHANGELOG 3.8.16).
- Backups: nothing copies `.env` or `server/data` off the Tower. Teacher password resets.
- The old "Money/scope vanished" report (10-12) is probably the v3.8.8 cause; ask Tom whether to close it.
- Untriaged feedback: 14 open reports are in neither TODO nor CHANGELOG (count on 10-19); `/start full` or triage.

## Suggested first move
Check `/health`; if v3.8.27 isn't live, ask Tom to deploy it, then ask him to run one student path on his phone.

## Suggested model for next session
Sonnet 5: N3 is mostly CSV rows plus small engine checks.

## Reminders
- Deploy: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never 02:45-04:45 EDT. Tom's deploy go is per deploy.
- Reading live game records (games.json, visitors.log greps) and running extra containers on the Tower were refused by the permission check on 10-18.
