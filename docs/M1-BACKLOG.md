---
title: "M1 Implementation Backlog"
type: plan
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# Ordered M1 backlog

Historical/deferred after the owner's Core v2 refocus. Follow docs/CORE-V2-SPEC.md and the current vault PLAN.md for active work.

Authority: vault SPEC-001-SIGNAL-TO-JOURNAL.md. Effort is relative, not a calendar promise; re-estimate after S1.

| Slice | Work / source candidates | Acceptance gate | Effort |
| --- | --- | --- | --- |
| S1 | Select supported web/auth baseline; shell and isolated PostgreSQL harness; EXMOCHEX account/Charts layout references | Typecheck/build, two-user auth fixture, DB startup | Medium |
| S2 | Registry, source registration, signal/setup/fill/outbox/attempt migrations; TradeAlarm patterns | A-01/02/03/05/09 real DB uniqueness, concurrency, rollback and source binding | Large |
| S3 | One Mochbot observation adapter, versioned config, terminal transitions; types.ts/runner.ts/notify/mochex.ts | Contract tests, stale/expiry/revision rejection; no real sends | Medium |
| S4 | Inbox/detail plus matching futures chart; Charts components/datafeed, EXMOCHEX navigation | A-04/06 browser checks, venue/market provenance, ownership | Large |
| S5 | Persisted paper/manual fills and journal; terminal reference plus EXMOCHEX calculations/UI | A-07/09/10 partial exits, fees, duplicate fills, DB and browser | Medium |
| S6 | Dry-run outbox worker, retries, recovery and shadow guard; TradeAlarm patterns | A-03/08/11 persistent fault injection, zero provider calls | Medium |
| S7 | Full vertical-slice evidence and migration dry-run | All applicable A-01..A-11, typecheck/build, deterministic replay | Medium |

Dependencies: S1 -> S2 -> S3/S5 -> S4/S6 -> S7.

Freeze source revisions, preserve dirty/unborn work, capture exact strategy configuration, bind source credentials server-side, establish one state writer, preserve partial-fill identities and verify futures candle units/mappings before extracting UI.

S1/S2/S3 completed locally on2026-11-18. S3 adds the pinned MOD-01E wrapper adapter, v2 geometry, contiguous lifecycle/history/reconciliation and a shadow-only gateway. Actual clean pure evaluator output was compared on synthetic candle prefixes. Next: S4 visual inbox/detail and matching MEXC perpetual chart. Live export transport still needs durable sequence/capture/retry storage before claiming a live connection; include that in the S7 integration audit. Live delivery, mobile, production migration and deployment remain outside M1. Performance thresholds stay provisional until the full workflow exists.
