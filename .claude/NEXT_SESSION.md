# Next session starter — written 2026-07-13 by /koniec

## State at handoff
- **Version:** v3.0.125 built. Last maintainer-confirmed deploy was v3.0.115; **v3.0.116–125 likely pending deploy** (confirm against live before assuming).
- **Branch:** master. **Uncommitted WIP left in tree by a concurrent fixloop session** — `src/components/player/PlayerPanelV2.tsx`, `src/utils/costPreview.ts` (its in-progress cost-preview "Varies" fix), plus intermixed TODO items and `.claude/fixloop/*`. This /koniec did NOT touch or commit them.
- **Last shipped (this session):** no game version — glossary auto-sync in the sibling **dictionary-scraper** repo (commit `452e76c`, pushed) + 19 construction terms now live in-game.
- **Test suite:** typecheck clean. Full suite NOT re-run — zero game-source this session (glossary work was in the scraper repo). Baseline 2368/2369 (1 skip), from v3.0.120.
- **Build/typecheck:** typecheck clean; build skipped to avoid colliding with the concurrent fixloop.

## Top 3 open items
1. **⏸️ Glossary auto-sync is blocked on Anthropic credits** — the nightly robot is built + deployed + verified end-to-end EXCEPT drafting 400s on "credit balance too low." Add credits at console.anthropic.com → Plans & Billing and it self-runs (or `POST /api/glossary/autosync` with `X-Sync-Token: $FEEDBACK_TOKEN`). Detail: memory `project_glossary_autosync` + CLAUDE.md TACTICAL.
2. **Cost-preview toggle shows "Varies" after the roll already resolved** (fb:49395e17) — the concurrent fixloop is mid-fix on this (uncommitted `costPreview.ts`/`PlayerPanelV2.tsx`). Full context in TODO.md.
3. **Deploy v3.0.116–125**, then dashboard PATCH sweep for any fb reports closed in that range.

## Decisions waiting on the user
- **Try Again button vs. cost-preview toggle** (fb:f453b1f3) — proposed short-tap=switch / long-press=commit interaction merge; needs a design call before building.
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.

## Suggested first move
Is the priority to activate the glossary auto-sync (add Anthropic credits, then trigger a run to confirm it stages the ~6 pending terms), or to let the concurrent fixloop finish its cost-preview fix first? If the fixloop is no longer running, its uncommitted WIP in `costPreview.ts`/`PlayerPanelV2.tsx` needs committing or reverting before other game work.

## Suggested model for next session
Sonnet 5 — the open items are normal feature/bug work (glossary activation is config + one trigger; cost-preview is a scoped fix).

## Reminders
- Deploy command runs from Windows terminal, not WSL.
- Glossary edits go to the scraper's `master_glossary/GLOSSARY.csv`, NOT this repo's `public/data` copy (fallback only). See CLAUDE.md TACTICAL.
