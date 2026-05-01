# Product Charter — Unravel Codes: The Game

**Status:** Beta (v2.58.0) — live at https://game.unravelcodes.com
**Last Updated:** April 30, 2026

## Mission

Unravel Codes is a multi-player turn-based board game that simulates the NYC construction project-management process — from owner scope-setting through architect/engineer design, regulatory review (DOB, FDNY, DCP), construction, and finish. Players take the role of project managers competing to complete their projects under real-world constraints around scope, money, time, and regulatory paths.

The game is designed to be playable both for entertainment and as an educational tool — schools and educators can edit per-space behavior via CSV data files (Workstream 6 invariant: engine is generic, all per-space variation lives in data).

## Core Mechanics

- **5 card types**: W (Work), B (Bank Loan), E (Expeditor), L (Life Events), I (Investor Loan)
- **Resources**: money, time spent, project scope (computed from W cards)
- **Phases**: SETUP → DESIGN → REGULATORY → CONSTRUCTION → FINISH
- **Multi-player effects**: cards that target other players, requiring negotiation
- **Try Again**: snapshot-based retry on negotiable spaces, with cost-ledger semantics (money paid sticks, cards drawn revert)
- **Multi-device play**: each player on their own device via QR code; HTTP + WebSocket sync

## Where to Look

- **Strategy & open work:** [TODO.md](../../TODO.md), [BETA_PLAN_V3.md](./BETA_PLAN_V3.md)
- **Architecture:** [ARCHITECTURE.md](../technical/ARCHITECTURE.md)
- **Per-version history:** [CHANGELOG.md](../../CHANGELOG.md)
- **User-facing changes:** [RELEASE_NOTES.md](../user/RELEASE_NOTES.md)
- **Foundational decisions:** [docs/archive/HANDOVER_REPORT-20251003.md](../archive/HANDOVER_REPORT-20251003.md)
