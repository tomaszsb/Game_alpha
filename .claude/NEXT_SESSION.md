# Next session starter — written 2026-07-27 by /koniec

## State at handoff
- **Version:** v3.1.61 — **pending deploy** (last confirmed-live: **v3.1.60**, maintainer-deployed 2026-07-27, commit `93261a`).
- **Branch:** master, clean (after this wrap-up commit).
- **Last shipped:** after the maintainer deployed v3.1.60 and confirmed the new avatars live, follow-up feedback: the avatars were too subtle at the setup screen's small circular size, so they're now also shown on board tiles and the TV scoreboard (previously plain color dots) — plus 3 more leftover emoji swept for icon consistency (floating bug button, in-game footer message, personal light/dark toggle, which now shows a sun/moon icon instead of bare text).
- **Test suite:** fast suite 2479/2483 on the full run (3 failures: `E2E-AllPaths`, `E2E-Multiplayer4P` timeout, a tight-timing perf assertion — all 3 re-ran clean in isolation, matching this project's well-documented full-suite resource-contention flake pattern, likely worsened by the Vite+Express dev servers running concurrently for browser verification; not a regression). Ghost gates 33/33 (0 hard failures) from the earlier /koniec pass this session, not re-run for v3.1.61 (presentation-only changes, no game-logic touched). Typecheck + build both clean.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.1.61** — pushed to master, `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` whenever ready. Separately, the `dictionary-scraper` repo's glossary-autosync model fix (commit `0278955`) is still undeployed there too — needs `scp` of `dashboard/backend/main.py` + `src/process.py` to `/mnt/user/appdata/dictionary-scraper/` + `docker restart dictionary-scraper-backend`. Independent of each other.
2. **Homeowner violation mechanic — needs a real design conversation before any engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work, not urgent. Needs: what triggers it, what the player does turn-by-turn, what unlocks after filing.
3. **CSP/HSTS/Permissions-Policy headers still deferred.** Real regression risk this app's jsdom-based test suite structurally can't catch (inline `style={{...}}` everywhere + a live cross-origin iframe). Needs a full inline-style/iframe survey + live-browser verification, not a quick pass.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** — marinating. **Don't nudge.**
- **Homeowner violation mechanic** — see top item 2.
- **PixelLab.ai key rotation** — maintainer explicitly declined this session ("just use the current one"); still genuinely exposed via git history whenever that calculus changes.

## Suggested first move
Nothing is blocked on a decision — deploying v3.1.61 (and the separate dictionary-scraper fix) is the natural next step whenever convenient. If you'd rather do design work instead, the Homeowner-mechanic conversation is the only open item that isn't a quick build/deploy.

## Suggested model for next session
Sonnet 5 — the top-3 items are deploy-mechanical (no model complexity) or a design conversation needing the maintainer's own judgment, not model horsepower.

## Reminders
- Deploy commands run from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (game) — the dictionary-scraper deploy is a separate `scp` + `docker restart`, see item 1 above.
- **Local dev verification needs BOTH servers running**: Vite (port 3000, via the preview tool) AND the Express backend (`npm run server`, port 3001) — without the backend, "Start Game" fails with "Couldn't start a new game (Failed to fetch)" and you only see the setup screen, never the actual board.
- The PixelLab.ai API key used this session (10 avatars + 1 logo test, ~$0.074 total) is the same one flagged in TODO.md as leaked/needing rotation — maintainer explicitly chose to keep using it. If more art generation is wanted later, it's already available; no new setup needed.
- If regenerating any AI art again: lock the ENTIRE prompt template (pose/framing/background) identically across every image in a batch, and use `no_background: true` — see the CLAUDE.md TACTICAL entry for why a looser first attempt came back visually inconsistent.
- `ModalBase`'s generic `emoji?: string` prop (used by many modals, including the bug-report form's header) was deliberately left alone this round — widening it to accept an icon component is a shared-component API change, out of scope for the specific "red button" fix that was asked for.
