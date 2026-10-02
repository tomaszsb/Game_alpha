# Next session starter — written 2026-10-02 by /koniec

## State at handoff
- **Version:** v3.2.98 — **pushed, NOT deployed.** Live is still v3.2.90 (`d8a07f9`); v3.2.91–98 are all waiting on Tom's deploy. Re-check `/health` before believing this.
- **Branch:** master, clean after the wrap-up commit (only `idea.txt` untracked — read it, never modify or commit it).
- **Last shipped (2026-10-02, eight versions):** fee rules (quotes wait for End Turn, 0.5% + 5-day push-back, 20% cap at End Turn, orange/red warnings), a dice-picked project type with `{project}` blanks on all 176 work packages (+ NEW tag, Owner line, log/discard wording), one-colour header / glow all game / "?" inside outlines / screen-size in header, a "What is this screen?" PC/TV/Phone question (Remote never remembered), in-game Screen menu, read-only spectators, finished games no longer offered back, TV loss headline.
- **Tests:** `npm test` 467 files / 7215 tests green; typecheck + build clean. `test:ghost` was still running at handoff — check `.claude/tmp/ghost.log` is gone (swept) so re-run `npm run test:ghost` if you need it.

## Top 3 open items
1. **Tom deploys v3.2.91–98, plays ONE real TV + phone game, then flip the reports.** Look at: fee warnings + a push-back at the engineer, NEW tag, "?" inside outlines on a real phone (light + dark), the "How are you using this screen?" question and Screen menu, a spectator link (watch-only). The exact flip list is the first item in TODO "Active".
2. **Tom reads the 176 reworded work packages** in `public/data/CLEAN_FILES/SCOPE_WORDING.csv` (`card_template` rows); reword in the file, no code.
3. **Spectator pass before a real class:** spectators are read-only in the player panels now, but the board's own clicks for a spectator are unchecked. Also: is there a real class + date for the 30-student scenario (load test: 30 and 100 spectators, 0 lost, local only)?

## Decisions waiting on the user
- Is there a real class + date for the 30-student scenario? If not, the per-device layout beyond PC/TV/Phone is scope creep.
- Keep "Remember what this screen is" ON by default? (Join-by-code on a PC/TV does not ask; the host's own screen is not asked.)
- Low-cash orange warning is 5% of scope — Tom said it sounds good; tune after real play.

## Flip after deploy
fb:feedback-1790939931163-adb1cc76, -1790512043564-612fbdc4, -1790939049674-a0cecb6a, -1790939744698-8cb652c4, -1790939218940-7fbea636, plus the older ones listed in TODO (glow: ae480630, 11662ac3, 95624c8e; phone-as-TV: 84b491f2, ec243622, a1260bfc, dc04ea53; and b38110f3, ef974f1c — both fixed in v3.2.98). Flip only after Tom confirms on a real device.

## Suggested first move
Ask Tom whether he deployed and played the TV + phone game, what he saw on the new screen question, and whether the fee warnings and NEW tag looked right. If yes, flip the list; then walk the decisions above.

## Suggested model for next session
Sonnet 5 — real-device follow-ups, small fixes and design questions.

## Reminders
- **Real cause of the 2026-10-02 "phone shows the TV view" report:** the host's setup toggle was on **Remote** (remembered from the 09-27 two-phone test); Remote mode shows board + controls on every device by design. NOT a v3.2.90 regression. v3.2.97 stops remembering Remote and adds the PC/TV/Phone question.
- **Deploy stays Tom's** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`); confirm with `/health`.
- **Commands for Tom go into Windows PowerShell:** no `grep`; use `curl.exe`.
- **Shell quirk:** long `python3 - <<'EOF'` / `cat <<'EOF'` scripts with apostrophes can die ("unexpected EOF") — write the script with the Write tool and run the file. `sed -i` on CRLF files flips them to LF — use a byte-level replace and `git diff --stat`.
- Pull feedback screenshots from `/api/feedback/<id>.json` BEFORE calling a report unclear (the public `open` endpoint never carries them).
