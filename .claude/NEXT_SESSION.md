# Next session starter — written 2026-08-14 by /koniec

## State at handoff
- **Version:** v3.2.3 — repo and live deploy both confirmed in sync (deploy log bundle-hash check: `4ab06be`).
- **Branch:** master, clean, pushed (only an untracked scratch file `idea.txt` at repo root — a maintainer draft, not touched).
- **This session:** closed the entire 2026-08-03 Workstream 6 CSV-only-reskin audit end to end — both BLOCKING findings (card mechanics gated on literal IDs → `card_mechanic` CSV column, v3.1.103; hardcoded Homeowner Violation tier/fee numbers → `VIOLATION_RULES.csv`, v3.1.104) plus all three Moderate findings (`REG_PREFIXES` space-name filter → phase-based lookup, v3.1.105; ~47 button/notification strings → `UI_STRINGS.csv`, v3.2.1; RulesModal.tsx prose + literal space-name refs → same CSV, v3.2.2). Then housekeeping: adopted a patch-caps-at-99 versioning convention (user request) and patched 4/8 `npm audit` high-severity findings (v3.2.3, the 4th left deliberately unpatched — see TODO.md).
- **Test suite:** 196/196 files, 2762/2762 tests, clean — last full run right after the v3.2.3 dependency bump, same code that's now deployed.
- **Build/typecheck:** both clean, re-verified fresh this `/koniec` pass.

## Top 3 open items
1. **fb:feedback-1778327469678-d27a73d0 — still waiting on the maintainer's own live test.** The v3.1.95 restore-picker + hover-highlight/distinct-cursor shipped 2026-08-04 and has been live since; asked directly whether to flip it resolved, maintainer said "i need to test it." Unchanged since the last 2 handoffs — re-ask if it comes up, otherwise leave it.
2. **Engagement-data revisit is now overdue.** The 2026-08-04 verdict ("not enough real post-launch data yet... revisit in a week or two") is 10 days past that window as of this handoff. This is the actual gate for whether the D&D-skin reskin experiment is worth building — worth an actual `/api/admin/engagement-stats` pull next session rather than deferring again.
3. **Every engine-side blocker for a CSV-only reskin is now fixed** (this session closed the last 4 of 6 findings). If item 2's data says "build it," the D&D-skin reskin is now purely a content-authoring task (write the D&D CSVs) plus the already-scoped infra step (`dnd.unravelcodes.com` second instance, TODO.md "Active — infra/deploy/data") — no remaining code changes block it.

*(Not top-3, but don't lose it: TODO.md's "Dependency major-version jumps" section now also tracks the 4 deliberately-unpatched `npm audit` findings (puppeteer/extract-zip chain) — re-check next time `puppeteer` gets bumped for any other reason.)*

## Test failures to address
None. `tests/server/instanceResolver.test.ts` flaked twice today under the full suite's parallel load (`ENOTEMPTY` then `EPERM`, different sub-tests each time) but passed cleanly alone both times and cleanly again in the final full run — a Windows temp-dir race in the test's own setup/teardown, not a regression. Full detail: TODO.md.

## Decisions waiting on the user
- **Home-IP false-foreign-alert** — root-caused v3.1.97 (container has no outbound IPv6 route). Two fixes, both needing the maintainer's call: give the Docker network real IPv6 routing (infra risk) vs. a manual `HOME_IP` override (simple but the ISP rotates the delegated prefix). Full detail: TODO.md "Decisions waiting on the user" + CHANGELOG v3.1.97. Unchanged this session.
- **fb:feedback-1778327469678-d27a73d0** — see top-3 item 1 above.

## Suggested first move
Quick-check item 1 (30 seconds, if it comes up naturally) — otherwise open with item 2: pull `/api/admin/engagement-stats` fresh and see whether there's now enough real post-launch traffic to make the D&D-skin go/no-go call. That answer determines whether item 3's content-authoring work is worth starting.

## Suggested model for next session
Sonnet 5 — reviewing engagement stats and a go/no-go conversation isn't demanding, and if the answer is "build the D&D CSVs," that's content-authoring work in familiar territory, not an architecturally ambiguous problem.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand this to the maintainer — don't run it yourself (deploy-handoff rule). PowerShell has no `&&` — one command per line if typing manually.
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- **New this session:** patch version numbers now cap at 99 — `X.Y.99`'s next bump is `X.(Y+1).0`, not `X.Y.100`. Rule + rationale in `docs/core/CLAUDE.md`, right after the existing "bump package.json when releasing" rule.
- `idea.txt` at repo root is an untracked maintainer scratch file (a draft "system prompt" style doc about D&D-reskin collaboration style). Left alone — not part of any doc-sweep trigger, and it's plausibly intentionally kept out of git.
- If handing the user a `curl` command to run in their own PowerShell: PowerShell's `curl` is `Invoke-WebRequest` in disguise and chokes on `-s`/`-H`. Use `curl.exe` explicitly or write real PowerShell (`Invoke-RestMethod -Headers @{...}`).
