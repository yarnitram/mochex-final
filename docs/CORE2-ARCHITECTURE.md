---
title: "Core2 Market and Monitor Architecture"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# Market boundary

The public MEXC contract catalogue and ticker endpoints supply active visible USDT perpetual instruments and last traded prices. Discovery excludes disabled/hidden contracts and keeps multiplier bases. Ticker amount24 is USDT turnover; riseFallRate is multiplied by100 for display percent. Invalid quotes become missing. Duplicate native ticker identities fail the response.

src/core/market-provider.ts pins the provider URLs. Per-process single-flight caches hold catalogue data for5min and tickers for5s; errors back off5s without presenting a previous success as live. Separate processes/replicas do not share those caches; coordinated rate limiting is a later deployment concern. No production fixture switch exists. The test verifier explicitly preloads fixtures/market-fetch.cjs to redirect only the two exact public URLs to a disposable loopback fixture server.

## Freshness and crossing

Use provider millisecond timestamp. Valid age is<=30s, allowing at most5s ahead of the application clock. Future/stale/missing/unsupported samples break continuity. First valid observation, edited/restored setup revision or a gap>30s seeds a baseline without inferred crossing. Equal/older timestamps do not rewind a current baseline.

Above crossing: previous<level and current>=level. Below crossing: previous>level and current<=level. Trigger direction is independently selectable; legacy records default long=above/short=below. Trade stop/target directions follow side. These are sampled last-price observations, not mark-price or exchange liquidation guarantees. REST sampling can miss touches/reversals between samples; OHLC paths are not invented.

## Storage and concurrency

Migration005 adds core_preferences, core_monitor_state and immutable core_monitor_events. All force owner RLS using the existing transaction-local owner context. State has scoped watchlist/trade FKs; events reference scoped state. Owner/time and relationship indexes support queries. Preference schemas constrain columns/sort. No existing migration was edited.

Per-owner advisory transaction lock serializes monitor refreshes. Active setup and open trade rows are locked in stable ID order, matching the manual workflow's parent locking. State and events commit together. Event identity is owner+target+revision+kind: one trigger per setup revision, one stop and one target per trade. Failed event insertion rolls the sample back so retry can emit. Monitoring never inserts exits, creates trades or changes quantities; event data records the remaining trade size when observed.

Records without configured triggers still get quote/baseline state. Archived/opened setups and closed trades are excluded from new sampling. Historical events remain visible; initial event read is bounded to100 latest records and workspace lists remain500 records.

## Runtime

POST /api/core/monitor validates a strict JSON body, session and exact Origin; client quote values/owner IDs are rejected. It fetches trusted public data, samples the signed-in owner and returns their events and quote statuses. When provider loading fails it clears that owner's active continuity and returns503. Polling occurs every10s while workbench is mounted. A browser refresh is not a persistent24/7 service.

Optional npm run monitor:core uses DATABASE_URL and TERMINAL_MONITOR_OWNER_ID to sample one explicitly configured owner every10s. --once runs one iteration. The role remains restricted; no admin URL or owner enumeration is used. Process restart reuses database baselines subject to continuity/freshness checks. No daemon/service was installed.

## APIs

- GET /api/core/market?search=BTC: signed-in discovery; max40 matching contracts, total count and explicit provider identity.
- POST /api/core/monitor: body {} or {symbols:[nativeSymbol,...]} (max100 extra read symbols); returns exchange/market, owner quote states, sample time and up to100 owner events. No prices/owner ID accepted.
- POST /api/core/workspace: action preferences with data {columns,sort,descending}; schema-constrained and owner-scoped.
- Existing plan actions accept optional triggerDirection above/below.

Workbench columns and sort persist per account in PostgreSQL. Preference changes are optimistic and roll back the UI on failure. A symbol picker queries discovery; manual existing plans remain accessible during provider failure. Quote cells omit numeric values for stale/future/missing/unsupported data. Historical crossing badges never imply an order fill.

## Validation and limits

See validation/2026-11-18-core2.md. No production migration, persistent pilot, external notification, exchange execution or24-hour soak occurred. Clock synchronization matters: the independent live probe observed provider/HTTP dates about200s ahead of this machine, and affected quotes were correctly rejected as future-dated. No clock or freshness threshold was changed to force a pass.
