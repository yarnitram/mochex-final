# M1 S3: MOD-01E observation adapter and terminal lifecycle

Status: draft implementation specification,2026-11-18. Parent A-06/09/10/11.
Pinned source: Mochbot271cc546191e70086791fa66aca8722a1996197b. Existing daemon/source code stays unchanged.

## Scope and contracts

A strict wrapper supplies sourceId, claimed sourceRevision, full effective configuration, stable contiguous revision, capturedAt, InstrumentKey and the existing Setup snapshot. The exporter owns durable sequence/capture bookkeeping; Mochbot itself does not currently emit this wrapper. Retries must resend the same captured envelope.

An additive Observation v2 contract includes normalized price geometry, config hash/snapshot, source setup identity, proposed state and revision. Existing SignalEvent v1 ingestion remains supported unchanged. Reject unsupported source/strategy/market, malformed config, wrong direction, inconsistent Fibonacci/R targets and non-finite levels.

Confirmed setup IDs have symbol:01E:direction:CHoCH-time form. WATCH uses a different unstable identity and is ignored; no attempt is made to merge it with confirmed setups. Ordinary IDLE/BLOCKED without a terminal confirmed setup is ignored. Terminal expiry/invalidation snapshots can omit price levels and refer to the previous stored geometry.

## Acceptance

- S3-01: deterministic mapping preserves source numeric prices as decimal strings, Unix-seconds to UTC-ms conversion, native instrument, config/source version and LIMIT semantics. No synthetic fill is created.
- S3-02: validate direction, price order, Fibonacci level, configured target R, context/timeframes and confirmation identity. Source claim is checked against the pinned revision; this is provenance metadata, not remote-code attestation.
- S3-03: first confirmed revision must be0/ARMED. Subsequent revisions must be exactly previous+1. Allow ARMED->ARMED/ENTRY_READY/EXPIRED/INVALIDATED and ENTRY_READY->ENTRY_READY/EXPIRED/INVALIDATED. No backward/reopened terminal state.
- S3-04: exact duplicate returns original IDs even after expiry; changed same-ID content, stale revision, sequence gap, regressing time, geometry change and invalid transition are recorded in immutable reconciliation history and leave state unchanged.
- S3-05: active observations must precede planned expiry; EXPIRED must be observed at/after planned expiry. Freshness checks use snapshot market-minute timestamp (not exact tick time). Already accepted retries bypass freshness. Invalid new observations cannot arm/enter a stale setup.
- S3-06: accepted revision atomically creates immutable signal/history, updates one logical setup, and creates held outbox work. Forced DB failure rolls back all changes; concurrent revision application occurs once.
- S3-07: credential/owner binding, RLS and scoped parent FKs extend to bindings/history/reconciliation. Private read API exposes current geometry/history safely.
- S3-08: actual pinned pure evaluator output is compared offline with the adapter on deterministic synthetic candles; repeat mapping/replay gives identical events. Existing source/daemon is not modified.
- S3-09: strict Bearer HTTP ingestion defaults/forces shadow; unknown envelope/version, spoofed owner/source, stale data and disabled credentials fail. Ignored snapshots still require authentication.

The adapter ignores volatile snapshot fields such as sizing, reason and current price. A changed observation timestamp still needs a new exporter revision. Native binary-number precision cannot be recovered; the adapter preserves the source number spelling as decimal and validates geometry with relative tolerance.

## Completion

Test-first contract/domain checks, real PG revision/order/rollback/isolation checks, actual source comparison, API/browser regression, typecheck and production build. No live scanner connection, execution, delivery, strategy profitability or deployment is claimed.
