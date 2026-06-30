# Next session starter — written 2026-06-29 by /koniec

## State at handoff
- **Version:** v3.0.89 — **deployed + confirmed live 2026-06-29** (`df64213`). Nothing pending deploy.
- **Branch:** master, clean apart from the usual `.claude/settings.local.json`.
- **Last shipped:** the **new-view ledger** ("My numbers") — scope grouped by trade, spent-vs-budget per area, funding gap, glossary-taught terms; shared `projectFinances.ts` helper. Opt-in new panel only; classic untouched.
- **Test suite:** typecheck + build clean; full sweep **1734/1734 green**. (50-game ghost gates not run — opt-in-panel-only, no engine touch.)

## Top open items
1. **Before→after outcome modal** — the next planned piece (the "what just happened" / dice-result modal). See the sketch below.
2. **New-view ledger follow-ups (logged in TODO this session):** accordion/progressive-disclosure to stay one-screen; clarify the confusing "Still to raise $3.1M vs Total scope $2.2M" (it's total project cost incl. soft costs + contingency, not a bug, but it misleads); dark mode + glossary-link contrast for the V2 modals (light-only today — blue links on light-gray are hard to read).
3. **Onboarding Phase C** (plain-English tile/button aliases) — blocked on the maintainer writing the alias strings.

## Before→after outcome modal — the sketch (the user wanted this written down)
Goal: after an action resolves, show **what changed** in the new-view language. Approach:
- **Gate to the new panel** (`ucPanelVersion==='new'`) so the **shared, live** `DiceResultModal` is untouched for classic (its restyle was deferred for exactly this risk).
- Render **before vs after** rows for the affected figures — cash, scope, days, and (the key ask) **which specific resource/expeditor was added or taken** — reusing `projectFinances.ts` + the ledger row styling so the two read identically. There's an existing `BeforeAfterBlock` component to lean on.
- Resolves the cluster: fb:dc7652ec (before/after should look like "My numbers"), fb:0001f5df / fb:0fc63fc1 / fb:3aad5f84 ("which resource/expeditor did I lose?").
- Start by reading `DiceResultModal.tsx` (fired from `GameLayout` via AutoActionEvent) to find the cleanest new-view-gated seam.

## Decisions waiting on the user
- None blocking. (Trade-grouping currently uses the raw 40 DOB work types; rolling them into ~5 high-level buckets — GC/plumbing/electrical/HVAC/FDNY — needs the maintainer's mapping calls, deferred.)

## Suggested first move
Confirm v3.0.89 is live, then start the before→after outcome modal (sketch above) — or pick a new-view ledger follow-up if you'd rather tidy the ledger first. Which?

## Reminders
- Deploy from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Commit + push BEFORE deploy (done).
- **Migrating to the new view** — don't invest in classic-only components (see memory `migrate-to-new-view`); the TODO change-legibility P2–P5 framing is stale classic-speak.
- On the locked redesign surface, **read `docs/design/player-panel-redesign.md` before building** — jargon gets taught via `TextWithTerms` glossary links, not stripped.
