# Unravel Codes: The Game

A multiplayer board game that simulates the NYC construction-permitting process — from
initial design through regulatory approval and construction. Players move through spaces
representing real construction phases, juggle money and time, collect cards for work scope
and regulatory steps, and race to finish their project. Built as a React/TypeScript app with
an Express backend; supports single-device and real-time multi-device play.

**Play online:** https://game.unravelcodes.com

> This README is intentionally a thin pointer. Anything that changes often — version, status,
> feature list, test counts, architecture — lives in the docs below, so this file doesn't go
> stale. (Reviewed monthly by `/start`; see its "Monthly maintenance" step.)

## Run it locally

```bash
npm install
npm run dev          # frontend → http://localhost:3000, backend → http://localhost:3001
```

`npm run build` makes a production build. For tests, the deploy process, and other commands,
see the docs below — the full `npm test` can hang on Windows, so there's a batch runner.

## Where everything lives

| You want… | Look here |
|---|---|
| **Current version, status, health** | [docs/core/PROJECT_STATUS.md](docs/core/PROJECT_STATUS.md) |
| **Full version-by-version history** | [CHANGELOG.md](CHANGELOG.md) |
| **Open work & priorities** | [TODO.md](TODO.md) |
| **Beta plan & strategy** | [docs/core/BETA_PLAN_V3.md](docs/core/BETA_PLAN_V3.md) |
| **How the code is organized** | [docs/technical/ARCHITECTURE.md](docs/technical/ARCHITECTURE.md) |
| **How to run/write tests** | [docs/technical/TESTING_GUIDE.md](docs/technical/TESTING_GUIDE.md) |
| **AI session rules (Claude)** | [docs/core/CLAUDE.md](docs/core/CLAUDE.md) |
| **Player-facing notes** | [docs/user/USER_MANUAL.md](docs/user/USER_MANUAL.md), [docs/user/RELEASE_NOTES.md](docs/user/RELEASE_NOTES.md) |
| **All docs, by topic** | the doc-map table in [docs/core/CLAUDE.md](docs/core/CLAUDE.md) |

Solo project. License: MIT.
