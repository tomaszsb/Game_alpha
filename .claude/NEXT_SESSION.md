# Next session starter — written 2026-08-19 by /koniec

## State at handoff
- **Version:** v3.2.16 — pushed to origin/master, **not yet deployed**.
- **Branch:** master, clean (only untracked scratch file `idea.txt` at repo root — a maintainer draft, not touched).
- **Last shipped:** v3.2.16 — clicking a Chronicle "What's happened" log entry now closes the modal and pans/pulses the board to the space that turn happened at, reusing the existing camera primitive the TV auto-focus already uses. Closes half of the "Change-legibility P1 remaining" TODO line.
- **Test suite:** full Golden-Rule coverage green — `npm test` 2801/2801 (189 files), `npm run test:ghost` 33/33 (10 files, ~13.4 min, all 3 bot batches at their win-rate floors, 0 hard failures).
- **Build/typecheck:** both clean.

## Top 3 open items
1. **G160 board-editing suite still has TWO unconfirmed rounds stacked up (v3.1.95 and v3.2.15).** Automated browser tooling in this environment renders zero React Flow board edges at all — confirmed pre-existing tooling limitation, not a regression — so every connector-visual fix was verified via unit tests + code review only, never seen live. Biggest "needs your eyes" item.
2. **Con-Initiation "Determine Outcome" crash** — unchanged from prior handoffs; still needs a direct repro in your own foregrounded browser, same tooling limitation applies.
3. **TV-persistent feed (the other half of the P1 line)** — investigated this session: `NotificationService.ts` has no selective-subscription mechanism to build on, and `TVDisplay.tsx` doesn't wire up notifications at all currently. This needs a product decision (what should it look like on a TV screen?) before it's buildable — not just an implementation pass.

## Test failures to address
None. Full suite green (2801/2801 + 33/33 ghost).

## Decisions waiting on the user
- **TV-persistent feed design** — see item 3 above. What should a "persistent notification feed" look like on the TV screen (always visible vs. open-on-demand, how many recent items, where it sits in the layout)?
- **dnd.unravelcodes.com D&D-reskin experiment** — still ON HOLD per the standing engagement-data recommendation (join-friction is the real blocker, not board theme). Revisit only if you want to proceed anyway, or after a few more weeks of traffic firms up the signal.
- **6 glossary terms in Purgatory** — drafted by the nightly auto-sync robot, awaiting your approve/reject on the dashboard's candidates page.

## Flip after deploy
- fb:feedback-1781190420890-5a155a1a — fixed in v3.2.13, carried forward unconfirmed again this session (never checked whether that version is actually live); PATCH resolved once confirmed.

## Suggested first move
Deploy v3.2.16 when convenient (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`), then either confirm the G160 board-editor fixes live, or make the TV-persistent-feed design call so it can be built next session.

## Suggested model for next session
Sonnet 5 — the top-3 is real-browser confirmation work + a design decision, no deep architectural judgment needed.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand this to the maintainer — don't run it yourself (deploy-handoff rule).
- `idea.txt` at repo root is an untracked maintainer scratch file (an old D&D-reskin system-prompt draft). Left alone, not part of any shipped work.
- This session was a `/loop /fixloop` autonomous pass (2 iterations: 1 landed, 1 found nothing eligible) followed by `/koniec` — no interactive back-and-forth, so nothing else notable to carry forward.
