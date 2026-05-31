# Next session starter — written 2026-05-31 by /koniec

## State at handoff
- **Version:** v3.0.43 — deployed live. Two post-v3.0.43 admin-only commits also shipped: Bug Reports panel in the game admin area (`1afb17e`) + fb: ID chips in Command Center (`bb86923`).
- **Branch:** master, clean.
- **Last shipped:** Bug Reports as a standalone admin button (alongside Space Editor + Edit Board Layout in the password-protected admin section). Full modal, 3-session localStorage undo, search by fb: ID.
- **Test suite:** 1553/1553 (83 files, 13.8s). 11 more tests than prior handoff — all green.
- **Build/typecheck:** both clean.

## Top 3 open items
1. **PATCH-flip 4 confirmed-fixed dashboard items:** `fb:84da66be` (board/panel destinations, v3.0.29), `fb:776e3ba7` (groundwork check, v3.0.28), `fb:3a57d5d0` (design fee, v2.70.4), `fb:ed2eeebf` (test submission). Two minutes in the Bug Reports panel.
2. **PATCH-flip 4 confirmed-fixed dashboard items:** `fb:84da66be` (board/panel destinations, v3.0.29), `fb:776e3ba7` (groundwork check, v3.0.28), `fb:3a57d5d0` (design fee, v2.70.4), `fb:ed2eeebf` (test submission). Two minutes in the Bug Reports panel.
3. **Choose the next UX feature** — plain-English action log (`fb:91738221`, "highest-impact-per-hour") OR defer-movement-choice (`fb:55b6626f`, "show destinations only after other actions done"). Both were top-3 last session. Plain-English log touches log formatting + dictionary tie-in; defer-movement is a bigger refactor.

## Test failures to address
(None — green.)

## Decisions waiting on the user
- **Top-3 #1** — which accidentally-resolved report to re-open.
- **Top-3 #3** — UX direction: action log vs defer-movement.

## Suggested first move
Two-minute admin housekeeping: open Bug Reports in the game admin panel, re-open the accidental one, PATCH-flip the 4 confirmed-fixed ones. Then pick the UX feature.

## Reminders
- Deploy command runs from **Windows terminal**, not WSL.
- Full `npm test` hangs on Windows; use the targeted sweep.
- The new Bug Reports panel is at: Setup screen → unlock admin → "🐛 Bug Reports" button.
- Command Center (`dashboard.unravelcodes.com`) also now shows `fb:` short IDs on each row — searchable.
- Cluster A (cheat-space panel: `fb:46dd4a47` + `fb:89d9f101`) was never reached this session — still open and grouped in TODO.
