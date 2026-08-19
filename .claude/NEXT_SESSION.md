# Next session starter — written 2026-08-19 by /koniec

## State at handoff
- **Version:** v3.2.15 — pushed to origin/master, **not yet deployed**.
- **Branch:** master, clean, pushed (only untracked scratch file `idea.txt` at repo root — a maintainer draft, not touched).
- **Last shipped:** v3.2.14 (New game/Join selector, spectator waiting screen, header chip consistency) then v3.2.15 (Board Layout Editor connector naming/ordering/self-loops/hover-picker/color/shadow fixes, End Turn glow, expeditor glow, player-panel border removal, End Turn cost preview shows real results instead of going blank).
- **Test suite:** full Golden-Rule coverage green — `npm test` 2798/2798 (189 files), `npm run test:ghost` 33/33 (10 files, ~14 min, all 3 bot batches at their win-rate floors, 0 hard failures — finished after the wrap-up commit, confirmed clean here).
- **Build/typecheck:** both clean.

## Top 3 open items
1. **G160 board-editing suite now has TWO unconfirmed rounds stacked up (v3.1.95 and today's v3.2.15).** Today's automated browser tooling renders zero React Flow board edges at all — confirmed via a git-stash A/B test to be a pre-existing environment limitation, not something today broke — so every connector-visual fix (discipline-prefixed naming, alphabetized restore picker, self-loop removal, hidden-edge picker exclusion, phase-colored lines, shadow-matching spacing ghost) was verified via unit tests + code review only, never seen live. This is the single biggest "needs your eyes" item right now.
2. **Con-Initiation "Determine Outcome" crash** — unchanged from prior handoffs; still needs a direct repro in your own foregrounded browser, same tooling limitation applies.
3. **D&D-reskin engagement-data question** — unchanged; real signal still thin (9 real games in 13 days as of the last pull), current read points at join-friction over board theme.

## Test failures to address
None. `npm test` full suite green (2798/2798).

## Decisions waiting on the user
None new this session.

## Flip after deploy
- fb:feedback-1781190420890-5a155a1a — fixed in v3.2.13, carried forward unconfirmed (never checked this session whether that version is actually live); PATCH resolved once confirmed.

## Suggested first move
Deploy v3.2.15 when convenient (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`), then spend a few minutes in the real Board Layout Editor — that's where the biggest pile of implemented-but-unverified work is sitting (item 1 above).

## Suggested model for next session
Sonnet 5 — the top-3 is real-browser confirmation work + normal backlog triage, no deep architectural judgment needed.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand this to the maintainer — don't run it yourself (deploy-handoff rule).
- `idea.txt` at repo root is an untracked maintainer scratch file (an old D&D-reskin system-prompt draft). Left alone, not part of any shipped work.
- Prior game-archive location saved to memory this session: `D:\Unravel\Projects\Game_Archive` — useful for "did X used to work differently" questions.
