# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 19, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.15** — pushed to origin/master, not yet deployed.

## Current sprint
**2026-08-19 — replaced the resume/join flow (v3.2.14), then a long batch of live-playtesting-driven fixes (v3.2.15).** v3.2.14 swapped the earlier "Resume your last game?" full-screen prompt and the hidden Join-by-Code drawer for one always-visible "New game"/"Join" selector, auto-added the first player, gave a spectator on a not-yet-started game a proper read-only waiting screen instead of the full editable host setup screen, and unified the four header chips to one look. v3.2.15 worked through a real batch of maintainer live-testing feedback: Board Layout Editor connector naming (now discipline-prefixed, since phase alone doesn't disambiguate Architect vs Engineer), an alphabetized restore-picker, self-loop connectors no longer drawn, hidden edges excluded from the hover "pick which line" popup, phase-colored connector lines, a shadow-matching spacing-guide ghost, and a real bug fixed along the way (a compound `"A or B or C"` dice outcome wasn't split for the board display). Also: End Turn's first-visit glow (only when Negotiate isn't offered), an expeditor "choose this one" glow, the live player panel's border/width-cap removed, and — the biggest single fix — the End Turn cost preview now shows the real result once an action completes ("+1 Work Package (+$2,200,000)") instead of going blank, closing two real timing bugs in the action log along the way.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite (`npm test`) **2798/2798** passing (189 files). `npm run test:ghost` backgrounded this session — check the wrap-up line / `.claude/NEXT_SESSION.md` for its result.
- **Lint:** not touched this session.
- **Deploy:** v3.2.15 pushed to origin/master, not yet deployed — maintainer deploys manually.
- **Dashboard feedback:** no fb-tracked reports closed this session (all fixes came from live in-chat feedback, not dashboard reports).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **G160 board editor's v3.2.15 connector fixes need the maintainer's own real-browser confirmation.** This session's automated browser environment renders zero React Flow edges at all (confirmed via a git-stash A/B test — a pre-existing tooling limitation, not a regression), so the naming/ordering/self-loop/hover-picker/color/shadow fixes were verified via unit tests + code review only, never seen live.
2. **Con-Initiation crash** — unchanged; still needs the maintainer's own foregrounded-browser repro, same tooling limitation applies.
3. **D&D-reskin engagement-data question** — unchanged; real signal still thin, current read points at join-friction over board theme.
