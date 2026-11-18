---
title: "ADR-001 Domain Ownership"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# ADR-001: selected M0 integration boundaries

Status: selected by the implementation agent under authorization to start M0; subject to owner review. No claim of explicit owner approval for each technology choice.

| Domain | Authoritative writer | Boundary |
| --- | --- | --- |
| Accounts | Terminal authenticated API | Source credential resolves owner/source; body claims cannot grant access |
| Instruments | Terminal registry/adapters | Exact exchange, market, native symbol, base, quote, settlement and multiplier tuple |
| Setup state | Terminal setup service | Scanner submits observations; terminal validates revisions/transitions |
| Execution provenance | Explicit fill recorder | M1 paper/manual only; signal never establishes confirmed exchange execution |
| Journal/positions | Terminal ledger | Unique append-only fills, derived positions, base quantities and quote fees |
| Delivery state | Terminal transactional outbox/worker | Record logical jobs and attempts; provider acknowledgement differs from display |
| Scanner internals | Existing Node/Python workers | Keep algorithms/runtime behind versioned contracts |

M0 baseline: TypeScript5.9.3, Zod4.6.7, decimal.js10.6.0, tsx4.23.15 and Node test runner, pinned lockfile. M1 selects web/auth baseline and uses PostgreSQL transaction/uniqueness semantics; no database was provisioned. Existing Supabase services remain a candidate.

Initial integration: BTC_USDT MEXC linear USDT perpetual, MOD-01E with explicit configuration and source revision. Matching futures feed must pass before chart extraction.

## Contract conventions

Strict version1 objects; UTC timestamps with milliseconds and Z; decimal financial input strings up to30 characters. Internal precision80. R output rounds to18 decimal places; amounts are not silently truncated. Derived values outside contract bounds fail.

Native contract quantities must convert to base units exactly once. Equal numeric multiplier spellings share identity. Event and fill keys are collision-safe JSON source/identity tuples.

Reference ledger supports one initial entry and subsequent partial exits, quote fees, linear quote-settled positions and deterministic timestamp replay. Scale-ins, inverse markets, amendments, funding and fee conversion require later specs.

Setup schemas describe structure, not authorization or a transition service. M1 must enforce source binding, account isolation, freshness, state revisions and database transactions. Existing legacy ledgers remain independent records and cannot become a second authoritative writer for terminal trades.

Combining database tables or legacy watchers directly would retain conflicting state ownership and whole-position-only sync. Adapters preserve existing applications while introducing one terminal ledger.
