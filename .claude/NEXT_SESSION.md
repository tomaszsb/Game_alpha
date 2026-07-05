# Next session starter — written 2026-07-05 by /koniec

## State at handoff
- **Version:** v3.0.95 — **pending deploy** (production still runs v3.0.94; the `.env` on the server already has the new SMTP + VAPID keys, added this session via scp+ssh, so deploy just needs the code)
- **Branch:** master, clean (this session's wrap-up commit pushed)
- **Last shipped:** Playtester Acquisition landing page at `/challenge` — real calendar/bookmark/PWA-install/browser-push/email-text reminders, a Share button (Web Share API + clipboard fallback, tags shares `?src=friend`), device-aware copy with a Jackbox Games analogy for phone visitors, plus three live-playtest bug fixes (bookmark did nothing, PWA install grayed out, campaign source missing from reminder links + then visibly ugly once added).
- **Test suite:** 2,290/2,294 passing this session's official run — the 3 failures were 30-60s timeouts in `E2E-AllPaths.test.ts` (unrelated dice/movement paths, not playtest code); confirmed non-regression by re-running that file alone: 10/10 passed in 3.46s. This machine ran dev servers + browser preview + several full suites concurrently all session — same pattern seen twice earlier in the session on different tests each time.
- **Build/typecheck:** clean throughout.

## Top 3 open items
1. **Deploy v3.0.95.** Code is committed/pushed; production `.env` already has the SMTP/VAPID keys. Just run the deploy command below, then live-verify the whole `/challenge` flow on an actual phone — nothing in this feature has been checked on a real device yet (all verification this session was via the browser preview, which lacks `navigator.share` and blocks clipboard writes without a trusted gesture, so the Share button's real behavior is unconfirmed).
2. **Confirm the glossary tap fix on a real tablet** (carried over from 2026-07-02 — cursor:pointer fix is desktop-verified only, hypothesis for fb:baa01a70).
3. **Standalone bug pair, likely related** (carried over): Move button disappeared after the bug-report popup (fb:bf8bf19a) and buttons gone after zooming the board (fb:45cb8b0c) — both "panel controls vanished mid-game."

## Test failures to address
(Green after isolated re-run — see note above. Nothing to fix.)

## Decisions waiting on the user
- **Real mobile-preview mini-puzzle** — "Quick game" currently aliases to the real game (placebo test). A genuine 30-60s phone demo is design work; scope it separately once there's a concrete idea of what to show.
- **QR code logo overlay** — the 5 generated PNGs (`Mockups/qr-codes/`) are plain URLs, no logo. PRD asks for one; add in image software before printing, or ask if it's worth scripting.

## Suggested first move
Deploy v3.0.95, then open `game.unravelcodes.com/challenge?src=vehicle` on an actual phone to check the whole funnel for real — the Jackbox copy, Share button, and PWA install prompt in particular have never been seen outside this session's headless browser preview.

## Suggested model for next session
**Sonnet 5.** Next session is deploy + live device verification + triage of whatever a real phone/tablet turns up — straightforward debugging and coding work, not long-horizon autonomous execution or unusually hard reasoning. Only reach for Opus if a real-device bug turns out to need deep architectural surgery.

## Reminders
- Deploy command runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- Gmail SMTP silently drops mail sent back to the *same* authenticated account (no Sent-folder copy, not in Inbox/All Mail/Spam) — confirmed via direct IMAP inspection this session, not a bug. Cross-account delivery works fine; don't re-diagnose if it resurfaces.
- `main.tsx` pathname-branch pattern (mount a new top-level page before `<App/>`, bypassing its auto-create effect) is now documented in CLAUDE.md TACTICAL — reuse it for any future "before the game" surface.
