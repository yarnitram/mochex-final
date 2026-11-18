# Mochex Terminal

## Current focus — Core v2

The2026-11-18 owner direction replaces the scanner-first priority with EXMOCHEX watchlist, trades and journal plus Mochex Charts. See docs/CORE-V2-SPEC.md, CORE-V2-ARCHITECTURE.md and CORE-CHART-PROVENANCE.md.

Primary route: /workbench. Successful login opens the four-module UI. Earlier scanner code/tests and /workspace remain deferred groundwork. Git history now starts with the verified Core1/2 baseline6554fd8; Core3A is implemented on phase/core3-chart-workspace for integration into main under the owner\'s2026-11-19 push authorization.

The first core slice provides manual entries/exits, journal review and chart baseline. Core2 adds active-contract discovery, live columns, saved preferences and observed trigger/SL/TP crossings. Core3A adds four drawing tools, object editing/visibility/locking,50-step undo/redo, account-saved chart layouts, SMA overlays and RSI14. Trade entries/exits remain manual. Multi-chart, further tools/scripts/replay remain later slices.

See [Core3A spec](docs/CORE3A-SPEC.md) and [architecture/API](docs/CORE3A-ARCHITECTURE.md). Save layout captures drawings, indicators and current zoom per account+symbol+timeframe; conflicts preserve your draft. Local setup: [LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md). No production runtime/deployment is included.

Core3A verified:42 unit tests,33 PostgreSQL checks,6 browser/API workflows, typechecks/build and actual source-helper parity. See [Core3A validation](docs/validation/2026-11-19-core3a.md). Browser captures use synthetic data; source push does not provision an account or deploy the app.

Core2 verified locally:39 unit tests,30 PostgreSQL checks,5 browser/API workflows, monitor CLI smoke, typechecks/build and desktop/mobile inspection. See [Core2 spec](docs/CORE2-SPEC.md), [architecture/API](docs/CORE2-ARCHITECTURE.md) and [validation](docs/validation/2026-11-18-core2.md). Browser polling runs every10s while open; an optional CLI can monitor one configured owner. No persistent runtime installed. The public probe detected local/provider clock skew and correctly rejected affected future-dated quotes.

Core1 verified locally:35 unit tests,24 PostgreSQL checks and4 browser/API workflows passed, plus typechecks/build and desktop/mobile inspection. See [validation record](docs/validation/2026-11-18-core-v2.md). Local setup: [LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md). No persistent account/runtime or deployment is provisioned by the test harness.

The older milestone notes below are historical background, not the current implementation sequence.

Combined Mochex workspace, starting with a tested domain foundation.

Remote: git@github.com:yarnitram/mochex-final.git. Prior scanner milestones M0/S1-S3 are preserved; their remaining roadmap is deferred under Core v2.

Planning authority: CommandCenter/02 - Projects/Active/Mochex-Terminal.

## Verification

Node>=22.13 declared; verified on Node26.8.1/npm12.2.0. Pin a deployment runtime during M1.

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
```

Normal tests use offline synthetic fixtures. Optional read-only source comparisons:

```powershell
npm run compare:sources
```

Expects sibling Mochex, mochbot, EXMOCHEX and Emalert directories. Override MOCHEX_SOURCES_ROOT for another parent directory. Python is needed only for Emalert's isolated standard-library calculation modules. No legacy service is started.

## Contents

- src/contracts.ts: six strict version1 contracts.
- src/domain.ts: closed-candle normalization, EMA and reference partial-exit ledger.
- fixtures/: valid/invalid payloads and golden synthetic calculations.
- tests/: contract and domain behavior.
- docs/SOURCE-AUDIT.md: bounded source evidence.
- docs/ADR-001-domain-ownership.md: selected domain boundaries.
- docs/M1-BACKLOG.md: ordered implementation slices.
- docs/validation/2026-11-18-m0.md: test-first evidence and gate verdict.

Historical S2 status: the private workspace, account sessions, scanner registration/credentials, atomic signal/setup/outbox ingestion, paper fill repository and isolated PostgreSQL/API/browser harness were implemented. No existing scanner was connected. The current Core1 workbench adds manual watchlist/trades/journal and chart visualization independently; provider delivery, mobile and deployment remain deferred.

See docs/LOCAL-DEVELOPMENT.md for local setup and docs/validation/2026-11-18-m1-s1.md for S1 evidence. Run npm run verify:workspace after a production build to reproduce the temporary two-user test environment; it removes its resources afterward.

S2 interfaces are documented in docs/API-S2.md and docs/ADR-003-scanner-ingestion.md; acceptance evidence is in docs/validation/2026-11-18-m1-s2.md. The S2 milestone passed26 unit tests,14 PostgreSQL tests and2 API/browser workflows. HTTP ingestion defaults to shadow; it never sends notifications.

Historical S3 adds POST /api/ingest/mochbot, a pinned MOD-01E wrapper/v2 observation contract, frozen price geometry, contiguous lifecycle revisions and reconciliation history. See docs/API-S3.md and ADR-004. S3 verification at completion:31 unit tests,19 PG tests and3 API/browser workflows. npm run compare:mochbot also checks actual clean pinned pure-source output on synthetic candles. The running bot is not connected; its durable wrapper/export transport is deferred.
