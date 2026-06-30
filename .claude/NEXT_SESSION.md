# Next session starter — written 2026-06-30 by /koniec

## State at handoff
- **Version:** v3.0.90 — **deployed + confirmed live 2026-06-30** (`aa1edba`). Nothing pending deploy.
- **Branch:** master, clean apart from the usual `.claude/settings.local.json`.
- **Last shipped:** ledger **cost drill-down** in "My numbers" (opt-in new panel). Tap a work package → its full cost (build + design 20% + filings 5% + safety buffer); "Total scope" collapses behind a drill-down (work packages hidden by default); a new "Full project budget" line reconciles scope with "Still to raise". Resolves the confusing "Still to raise > Total scope" + delivers the first accordion slice.
- **Test suite:** typecheck + build clean; targeted sweep (components/utils/services) **1738/1738 green** (+3 new). Full `npm test` hangs on Windows (known) — targeted sweep is the gate. (50-game ghost gates not run — opt-in-panel-only, no engine touch.)

## Top 3 open items
1. **Before→after outcome modal** — the next planned new-view piece (the "what just happened" / dice-result modal). Sketch below.
2. **Dark mode + glossary-link contrast for the V2 modals** — `ModalBase` body is hardcoded light-only (`panelPalettes.light`); blue glossary links on light-gray are hard to read and the modals ignore the panel's dark mode. Wire the panel light/dark theme into the modal bodies; ensure term-link contrast in both modes (redesign §4). NOTE for this work: a `TextWithTerms` term can live inside a clickable row — its click `stopPropagation`s (TextWithTerms.tsx:107), so it won't trigger the row.
3. **Remaining accordion slices** (lower priority) — the "Where your money's going" budget block + funding-gap line are still un-collapsed; give them the same treatment only if one-screen starts fighting again. Plus **Onboarding Phase C** (blocked on the maintainer writing the plain-English alias strings).

## Before→after outcome modal — the sketch
Goal: after an action resolves, show **what changed** in the new-view language.
- **Gate to the new panel** (`ucPanelVersion==='new'`) so the **shared, live** `DiceResultModal` stays untouched for classic (its restyle was deferred for exactly this risk).
- Render **before vs after** rows for the affected figures — cash, scope, days, and (the key ask) **which specific resource/expeditor was added or taken** — reusing `projectFinances.ts` (now with per-item `fullCost`/breakdown) + the ledger row styling so the two read identically. There's an existing `BeforeAfterBlock` to lean on.
- Resolves the cluster: fb:dc7652ec (before/after should look like "My numbers"), fb:0001f5df / fb:0fc63fc1 / fb:3aad5f84 ("which resource/expeditor did I lose?").
- Start by reading `DiceResultModal.tsx` (fired from `GameLayout` via AutoActionEvent) to find the cleanest new-view-gated seam.

## Decisions waiting on the user
- None blocking. (Trade-grouping still uses the raw 40 DOB work types; rolling them into ~5 buckets needs the maintainer's mapping calls — deferred. Construction-cost calc tightening also deferred per the v3.0.90 discussion.)

## Suggested first move
Start the before→after outcome modal (sketch above) — `projectFinances.ts` now exposes the per-item breakdown it can reuse — or pick the dark-mode/contrast follow-up if you'd rather finish the V2-modal polish first. Which?

## Reminders
- Deploy from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Commit + push BEFORE deploy.
- **Migrating to the new view** — don't invest in classic-only components (memory `migrate-to-new-view`).
- On the locked redesign surface, **read `docs/design/player-panel-redesign.md` before building** — jargon gets taught via `TextWithTerms` glossary links, not stripped.
- Local browser verify needs BOTH servers — Express (3001, start via Bash) + Vite (3000, preview MCP owns it).
