# Core2: live watchlist and observed-price monitoring

Owner continuation2026-11-18. Current branch phase/core2-market-monitoring preserves the uncommitted bootstrap; no base commit exists and no commit/push is authorized.

## Acceptance

- Q-01 Discovery: searchable active, visible MEXC USDT-settled perpetual catalogue, including multiplier bases. Exact native symbol identity; suspended/hidden/other markets excluded. Manual existing plans remain readable when an instrument is unsupported. Catalogue unavailable is explicit.
- Q-02 Quotes: last traded price,24h percentage change and24h USDT turnover, correct MEXC perpetual identity and exchange timestamp. Fresh means age<=30s and no more than5s in the future. Shared bounded caches: detail5min, ticker5s, single-flight and short error backoff. No alternate venue/spot/generated data fallback.
- Q-03 Watchlist: live quote cells, trigger distance, price/change/turnover/symbol sorting and selectable columns; persist preferences per account. Stale/missing/unsupported prices display unavailable status and cannot be used to monitor. Show last quote time.
- Q-04 Explicit trigger direction: above or below independent of trade side. Older plans without it default long=above, short=below. A crossing means previous<level and current>=level (above), or previous>level and current<=level (below). First observation establishes a baseline and emits no event even if already beyond the level.
- Q-05 Monitoring: server accepts only its fetched catalogue/ticker observations. No client-supplied prices. Per-record baselines, plan revision reset, monotonic provider times and30s max continuity gap. Stale, future, missing, disabled or unsupported quotes clear continuity; delayed/duplicate samples never rewind it. First fresh observation after a gap resets baseline without inferred crossing. Crossing can be missed between REST samples: do not reconstruct intrabar paths.
- Q-06 Events: one immutable trigger event per setup revision; one stop/target event of each kind per active trade. Active trades use remaining quantity and initial SL/TP. Long stop crosses below, target above; short reverse. One owner-scoped transaction serializes concurrent refreshes and writes state/events atomically. Archived/opened setups and closed trades cannot emit new monitoring events. Events never create fills, change trade quantities or close positions.
- Q-07 Runtime: authenticated exact-Origin POST refresh runs while workbench is open; optional CLI loop can monitor one explicitly configured owner without an open browser. Expose last successful sampling time and newest event records. No claim of24/7 monitoring when no runner/browser is active. No external notification/exchange integration.
- Q-08 Verification: failing meaningful domain/provider tests first; deterministic direction/equality/reversal/gap/stale/replay tests; actual PostgreSQL concurrency/RLS/rollback/ledger-unchanged checks; browser discovery/quote/preferences/event/failure flow; regression typechecks/build and prior tests.

## Boundaries and sources

Public endpoints and field meanings verified against [MEXC contract docs](https://mexcdevelop.github.io/apidocs/contract_v1_en/#get-contract-information) and [ticker contract](https://mexcdevelop.github.io/apidocs/contract_v1_en/#get-contract-trend-data). EXMOCHEX clean b2996ed watchlist-types.ts and watchlist-utils.ts inform column/sort/trigger-distance UX. Its polling/auto-entry logic is not copied. Prices use lastPrice, not mark/index price. Turnover uses amount24, not raw contract volume24.

Original repos and data remain unchanged. Deferred chart drawings/layout and journal depth stay Core3/4. No persistent runtime, migration against an existing DB, commits, pushes or deployment.
