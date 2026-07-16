# Next session starter — written 2026-07-15 by /koniec

## State at handoff
- **Version:** v3.0.142 **shipped, pushed, pending deploy**. v3.0.141 is deployed and confirmed live by the maintainer (commit `8b5bf45`).
- **Branch:** master, clean (only pre-existing session-state files uncommitted — `.claude/fixloop/*`, `.claude/settings.local.json` — not part of this session's work).
- **Last shipped:** an entirely reactive real-hardware TV bug-triage thread — the maintainer tested last session's TV fix on a real 75" Hisense 4K TV and reported back across several rounds. Fixed: the setup screen's 4 player tiles not fitting without scrolling (a `vh`-vs-zoom mismatch + a grid-packing bug); a foreign-game text alert falsely firing on the maintainer's own PC (residential IPv6 has no NAT — fixed to compare by /64 prefix); the same TV misdetected as a phone twice over (`isPhoneScreen()` + `detectDeviceType()` both fooled by TV-specific traits); a stuck-loading screen given a visible 10s hint. Then, once the TV's *real* resolution came in via feedback metadata (960×540), the player tile was redesigned — dropped the 8-swatch color picker for a tap-to-cycle dot — which is what actually closed the fit gap. Full detail in CHANGELOG v3.0.138–142.
- **Test suite:** **2374/2375 passing, 1 skipped, 0 failures** (all 5 ghost gates green, 699s).
- **Build/typecheck:** clean.
- **Dashboard:** NOT swept this session (no monthly trigger, not `/start full`). 4 reports ready to flip once v3.0.142 deploys — see below.

## Top 3 open items
1. **Deploy v3.0.142, then flip 4 dashboard reports resolved.** Code fixes are done and verified via live DOM measurement at the TV's actual 960×540 resolution — just needs the deploy + PATCH sweep (recipe in TODO.md).
2. **CSV-portability lift** (ApprovalService.ts + characters.ts + theme.ts) — scoped 2026-07-12, ~half a day; blocks the maintainer's long-term content-only reskin goal. Not touched this session.
3. **Architecture parking lot, all trigger-gated** — TurnService (2191 lines/16 methods) worth eventually splitting into a staged pipeline; PlayerSetup.tsx (2090 lines, touched directly again this session) worth decomposing; a domain-event architecture is the most interesting long-term direction but needs a dedicated design pass first.

## Decisions waiting on the user
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.
- **Homeowner starting scenario** — direction decided, needs a design pass on the mechanic itself.

## Flip after deploy
Once v3.0.142 is confirmed live, PATCH these resolved (recipe in TODO.md "Dashboard PATCH recipe"):
- fb:3f9f2831, fb:e121c34e — original "resolution is crap" / "can't go back up" reports (v3.0.130).
- fb:dca292b8 — "Why is TV detected as phone" (v3.0.138), fixed v3.0.140.
- fb:28512320 — "Still can not see all four players" (v3.0.138), fixed v3.0.142.

## Suggested first move
Get v3.0.142 deployed (command below) and confirm live, then flip the 4 reports above. After that, nothing else is blocking — pick between the CSV-portability lift or one of the parking-lot architecture items.

## Suggested model for next session
**Sonnet 5** — normal scoped work; nothing in the top-3 is architecturally ambiguous enough to need Opus.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- This session corrected a wrong ISP guess mid-session (said Comcast/Xfinity, was actually Verizon) — verify specific IP/ISP claims via a real lookup (ARIN RDAP or whois), never assert from general prefix-range memory. See CLAUDE.md TACTICAL for the reusable pattern.
- If touching TV-mode UI again: don't assume 1920×1080 is a safe floor. This real TV reported 960×540. Design/test down to that size when it matters.
