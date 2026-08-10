# Next session starter — written 2026-08-10 by /koniec

## State at handoff
- **Version:** repo/CHANGELOG at v3.1.102. **Live deploy is 4 commits behind** — `/health` reports commit `dce7bb0` (the pre-v3.1.100 focus-trap fix). v3.1.100 (real Bank Loan fee-dodge bug fix), v3.1.101 and v3.1.102 (reskin items 3–4: DOB/FDNY labels + CHARACTER_MAP now CSV-driven) are shipped in the repo but **not yet live**.
- **Branch:** master, clean, pushed (only an untracked scratch file `idea.txt` at repo root — a maintainer draft, not touched).
- **This session:** no code changes — pure `/koniec` wrap-up on top of prior sessions' work. Typecheck and build both re-verified clean; test suites skipped (zero game-source touched this session, per the `/koniec` skip rule).
- **Test suite:** not re-run this session (no source changed). Last known-good baseline: 2732/2732 per the v3.1.102 CHANGELOG entry.
- **Build/typecheck:** both clean, verified fresh this session.

## Top 3 open items
1. **Deploy v3.1.100–102 to production.** Three real fixes are sitting undeployed: a live scoring bug (Bank Loan cards were dodging loan-percentage fees, v3.1.100) plus two reskin-audit items. Hand the maintainer: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` — don't run it yourself, see Reminders.
2. **fb:feedback-1778327469678-d27a73d0 — still waiting on the maintainer's own live test.** The v3.1.95 anchor hover-highlight + distinct cursor shipped 2026-08-04 and has been live since; asked directly whether to flip it resolved, maintainer said "i need to test it." Still open as of this handoff — re-ask if it comes up, otherwise leave it.
3. **Workstream 6 reskin audit's two remaining BLOCKING findings, still open:** (a) 7 card mechanics gated on literal card IDs instead of the generic effect system — [CardService.ts:1161](src/services/CardService.ts:1161), [GameRulesService.ts:130](src/services/GameRulesService.ts:130), [EffectFactory.ts:48,978](src/utils/EffectFactory.ts:48); (b) Homeowner Violation logic is 100% hardcoded non-CSV — [violationRules.ts](src/utils/violationRules.ts). Full context: TODO.md → "Workstream 6 CSV-only-reskin audit."

*(Not top-3, but don't lose it: TODO.md's engagement-data item said "revisit `/api/admin/engagement-stats` in a week or two" as of 2026-08-04 — it's now 2026-08-10, about a week out. Worth a look next session before deciding whether the D&D-skin experiment is still worth building.)*

## Test failures to address
None known. Suite wasn't re-run this session (no source changed) — if the next session touches any source, run both `npm test` and `npm run test:ghost` fresh rather than trusting the v3.1.102 baseline blindly.

## Decisions waiting on the user
- **Home-IP false-foreign-alert** — root-caused v3.1.97 (container has no outbound IPv6 route, so `detectHomeIPv6()` always fails and every real home IPv6 session reads as foreign). Two fixes, both needing the maintainer's call: give the Docker network real IPv6 routing (infra risk, needs live testing on the Unraid box) vs. a manual `HOME_IP` override (simple but the ISP appears to rotate the delegated prefix). Full detail: TODO.md "Decisions waiting on the user" + CHANGELOG v3.1.97.
- **fb:feedback-1778327469678-d27a73d0** — see top-3 item 2 above.

## Suggested first move
Hand the maintainer the deploy command for v3.1.100–102 (top-3 item 1) — it's a real live scoring bug fix sitting unshipped. While that's out for confirmation, item 3 (the two remaining BLOCKING reskin findings) is the next-most-valuable use of time; it's a scoped code-read-then-design task, not blocked on anything.

## Suggested model for next session
Sonnet 5 — deploying is not code work, and the reskin findings (item 3) are a scoped refactor in familiar territory, not an architecturally ambiguous problem.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand this to the maintainer — don't run it yourself (deploy-handoff rule). PowerShell has no `&&` — one command per line if typing manually.
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- `idea.txt` at repo root is an untracked maintainer scratch file (a draft "system prompt" style doc about D&D-reskin collaboration style). Left alone — not part of any doc-sweep trigger, and it's plausibly intentionally kept out of git.
- If handing the user a `curl` command to run in their own PowerShell: PowerShell's `curl` is `Invoke-WebRequest` in disguise and chokes on `-s`/`-H`. Use `curl.exe` explicitly or write real PowerShell (`Invoke-RestMethod -Headers @{...}`).
