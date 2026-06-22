# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 22, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.82** — **deployed live 2026-06-22 (commit `94f22b2`).** Ships the player-panel redesign behind an opt-in toggle, so live default behaviour is unchanged.

## Current sprint
**2026-06-22 — player-panel redesign, first build behind an opt-in toggle (v3.0.82).** A multi-round design collaboration (locked spec: [docs/design/player-panel-redesign.md](./../design/player-panel-redesign.md)) produced a redesigned player panel on the north star *teach, don't dumb down* — keep every domain term and explain it on demand via the existing glossary, not strip it. Built [PlayerPanelV2.tsx](../../src/components/player/PlayerPanelV2.tsx) (five zones: header w/ phase top-right · icon money/days + tiny conditional DOB/FDNY diodes · **purpose elevated** above the actions, full story tucked · things-you-can-do · influence w/ player-language card counts · single commit spine w/ counter→ready + green first-visit dot), reusing the classic panel's handlers + the `canEndTurn` rule (no logic drift). Light/dark via [panelTheme.ts](../../src/components/player/panelTheme.ts) (slate tokens; new-panel-scoped); classic/new + light/dark toggle in [PlayerPanelWrapper.tsx](../../src/components/player/PlayerPanelWrapper.tsx); glossary side panel goes dark too via an ~8-var override gated on `html[data-uc-dark]` ([DictionaryPanel.css](../../src/dictionary/components/DictionaryPanel.css)). **Off by default** — normal play untouched. **Verified live** in a running game (manual + dice actions, ready commit, dark/light) — caught + fixed a dice-effect routing bug (dice actions were sent to the manual handler). Surfaced a pre-existing glossary duplicate-key bug (tracked).

## Health
- **Tests:** targeted vitest sweep (components/utils/services) **1661/1661 green**; classic panel untouched. (Full suite not re-run this session — change is additive + behind a toggle; typecheck + build are the cross-file guard here.)
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.82 deployed live (`94f22b2`), badge confirmed.** Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev:** verify per-instance boards via Express (localhost:3001), not Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Player-panel redesign — continue the build.** Playable V2 + glossary dark landed (opt-in). Next: optional E-card play from the influence zone → detailed-card + outcome-modal restyle → shared scoreboard ("who" screen) → later app-wide dark mode + glossary flat-style alignment.
2. **Live post-deploy verification of authored spaces** — local + live dice-drift walk PASSED; the broader authored-space live walk (card + %-fee + dice gameplay) remains, user driving.
3. **Glossary duplicate-key bug** (pre-existing, surfaced this session) — ~24 React duplicate-key errors from repeated term ids in the dictionary data; de-dupe + add a uniqueness guard (spawned task).
