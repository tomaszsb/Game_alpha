# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 19, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.16** — pushed to origin/master, not yet deployed.

## Current sprint
**2026-08-19, second session — autonomous `/loop /fixloop` shipped v3.2.16.** Clicking a Chronicle "What's happened" log entry (or its turn-block header) now closes the modal and pans/pulses the board to the space that turn happened at, reusing the same `setCenter`/`computeFocusCenter` React Flow primitive the TV auto-focus camera already uses — not a new camera system. Closes half of the "Change-legibility P1 remaining" TODO line; the TV-persistent-feed half stays open, and was found this session to need a product decision (NotificationService has no selective-subscription mechanism to build on, and TVDisplay doesn't wire up notifications at all currently) before it's engineerable. A second fixloop iteration found no further eligible work — everything else in TODO's Active section is gated on the maintainer's own confirmation, an external/human action, or is a completed investigation with a standing recommendation.

*(Earlier the same day, first session: replaced the resume/join flow (v3.2.14) — swapped the "Resume your last game?" prompt and hidden Join-by-Code drawer for one always-visible "New game"/"Join" selector — then a long batch of live-playtesting-driven fixes (v3.2.15): Board Layout Editor connector naming/ordering/self-loop/hover-picker/color/shadow fixes, End Turn glow, expeditor glow, player-panel border removal, and the End Turn cost preview showing real results instead of going blank.)*

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite (`npm test`) — check the wrap-up line below for this session's result. `npm run test:ghost` backgrounded this session — check `.claude/NEXT_SESSION.md` for its result.
- **Lint:** not touched this session.
- **Deploy:** v3.2.16 pushed to origin/master, not yet deployed — maintainer deploys manually.
- **Dashboard feedback:** no fb-tracked reports closed this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **G160 board editor's v3.2.15 connector fixes need the maintainer's own real-browser confirmation.** This session's automated browser environment renders zero React Flow edges at all (confirmed via a git-stash A/B test — a pre-existing tooling limitation, not a regression), so the naming/ordering/self-loop/hover-picker/color/shadow fixes were verified via unit tests + code review only, never seen live.
2. **Con-Initiation crash** — unchanged; still needs the maintainer's own foregrounded-browser repro, same tooling limitation applies.
3. **TV-persistent feed (Change-legibility P1's remaining half)** — needs a maintainer product decision on what it should actually look like before it's buildable; NotificationService and TVDisplay don't currently support it.
