---
title: "S3 Mochbot Gateway Reference"
type: guide
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# MOD-01E shadow gateway

POST /api/ingest/mochbot requires a registered scanner Bearer credential and application/json (65536-byte bound). Owner/source still bind to the credential; wrapper sourceId must match it. Ignored snapshots also authenticate. All accepted revisions create held jobs regardless of TERMINAL_INGEST_MODE.

## Wrapper fields

envelopeVersion=1, sourceId, sourceRevision, revision, capturedAt, configuration, instrument and snapshot. See fixtures/mochbot-mod01e.json and fixtures/mochbot-observation.ts for synthetic examples. The static example's old timestamps are not valid as a new current observation.

- sourceRevision must equal271cc546191e70086791fa66aca8722a1996197b.
- configuration is the full effective MOD-01E configuration, including runner/per-coin killzone overrides; do not submit only the defaults label.
- instrument is explicit MEXC BTC_USDT linear USDT perpetual metadata, including the real contract multiplier supplied by the producer.
- snapshot matches the source Setup fields. Volatile sizing/current-price/reason extras are ignored; unknown wrapper/configuration fields are rejected.
- revision begins0 for an ARMED confirmed setup, then increments by1 per observation. capturedAt is fixed when the observation is created and retained on retries.

A producer must keep durable revision/capture/retry bookkeeping per source/setup/config identity. The gateway cannot reconstruct a missed ARMED snapshot from a later entry-ready event. This repo does not yet run a live producer/exporter.

## Responses

202 created/applied includes setupId,signalId,outboxId. 200 duplicate returns original IDs. 200 ignored stores nothing. 409 rejected returns a revision/transition reason and keeps a reconciliation record. Freshness rejection uses422. Invalid schema/version uses400; inconsistent source context uses422; missing/revoked auth401 and source mismatch403.

GET /api/setups/:id includes current state/revision, geometry,configuration_version,last_observed_at,history and reconciliation. payload is the original root event; use current fields/history for later state. GET /api/signals lists accepted revisions mapped to their logical setup. Both require the owning account session.

## Offline verification

npm run compare:mochbot inspects only the pinned clean pure-source files in the sibling mochbot checkout (override MOCHEX_SOURCES_ROOT for another parent). It runs a deterministic synthetic fixture and compares actual ARMED/ENTRY_READY output against the adapter. This does not start the daemon, fetch market data, send events to a service or validate profitability.
