# Next session starter — written 2026-07-27 by /koniec

## State at handoff
- **Version:** v3.1.60 — **pending deploy** (last confirmed-live: v3.1.51, 2026-07-26).
- **Branch:** master, clean (after this wrap-up commit).
- **Last shipped:** a fixloop tail closing the last 3 card-effect gaps (E020/E037/E034/E044), a real glossary-autosync root-cause fix (retired Claude model, not credits — fixed in the sibling `dictionary-scraper` repo, not yet deployed there either), and a full visual-design arc replacing setup-screen emoji with a custom icon set, then real PixelLab-generated player avatars, with the logo reverted to the actual real `logo.png` (not a regenerated version) after maintainer correction.
- **Test suite:** fast suite 2482/2483 (1 pre-existing skip, 0 failures) + ghost gates 33/33 (10 files, 0 hard failures, 572.96s) — no regressions.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Two separate deploys are queued, neither done yet.** (a) This game: v3.1.60 pushed to master, `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` whenever ready. (b) The `dictionary-scraper` repo's glossary-autosync model fix (commit `0278955`) — needs `scp` of `dashboard/backend/main.py` + `src/process.py` to `/mnt/user/appdata/dictionary-scraper/` + `docker restart dictionary-scraper-backend`. These are independent — either can go first.
2. **Homeowner violation mechanic — needs a real design conversation before any engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work, not urgent. Needs: what triggers it, what the player does turn-by-turn, what unlocks after filing.
3. **CSP/HSTS/Permissions-Policy headers still deferred.** Real regression risk this app's jsdom-based test suite structurally can't catch (inline `style={{...}}` everywhere + a live cross-origin iframe). Needs a full inline-style/iframe survey + live-browser verification, not a quick pass.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** — marinating. **Don't nudge.**
- **Homeowner violation mechanic** — see top item 2.
- **PixelLab.ai key rotation** — maintainer explicitly declined this session ("just use the current one"); still genuinely exposed via git history whenever that calculus changes.

## Suggested first move
Nothing is blocked on a decision — the two pending deploys are the natural next step whenever convenient, in either order. If you'd rather do design work instead, the Homeowner-mechanic conversation is the only open item that isn't a quick build/deploy.

## Suggested model for next session
Sonnet 5 — the top-3 items are deploy-mechanical (no model complexity) or a design conversation needing the maintainer's own judgment, not model horsepower.

## Reminders
- Deploy commands run from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (game) — the dictionary-scraper deploy is a separate `scp` + `docker restart`, see item 1 above.
- The PixelLab.ai API key used this session (10 avatars + 1 logo test, ~$0.074 total) is the same one flagged in TODO.md as leaked/needing rotation — maintainer explicitly chose to keep using it. If more art generation is wanted later, it's already available; no new setup needed.
- If regenerating any AI art again: lock the ENTIRE prompt template (pose/framing/background) identically across every image in a batch, and use `no_background: true` — see the new CLAUDE.md TACTICAL entry for why a looser first attempt came back visually inconsistent.
