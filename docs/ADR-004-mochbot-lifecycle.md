---
title: "ADR-004 MOD-01E Observation Lifecycle"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# ADR-004: confirmed MOD-01E snapshots as versioned observations

Selected under the user's S3 continuation; available for owner review.

## Evidence and boundary

Pinned pure source: Mochbot271cc546191e70086791fa66aca8722a1996197b. Its runner emits Setup snapshots with stage, stable confirmed setup ID, effective timeframes, price levels and limit context. It does not emit durable revision/capture metadata. No existing source/runtime was edited or connected.

POST /api/ingest/mochbot accepts an explicit wrapper containing source identity, claimed source revision, full effective configuration, revision and capturedAt. Its producer must persist those values and resend the original wrapper on retry. This phase implements the adapter/gateway and an offline source comparison, not a live durable exporter.

## Semantic choices

Only confirmed BTC_USDT MOD-01E IDs enter the lifecycle. WATCH identities differ from confirmed CHoCH identities and are ignored. IDLE without a stable terminal setup and BLOCKED snapshots are ignored after authentication. Source terminal snapshots can lose their ID if overwritten by WATCH; the adapter cannot reconstruct absent source evidence.

Observation v2 adds config snapshot/hash, source setup identity, producer revision, proposed state and decimal price plan. SignalEvent v1 is unchanged. The source revision is a checked metadata claim, not proof of the code running on a remote producer.

ENTRY_READY is a proposed analysis state with fillStatus=unconfirmed. It never creates a fill, trade execution or legacy sync call. Preserve upstream binary-number spelling as decimal strings; lost source precision cannot be recovered. Direction/Fibonacci/configured-R geometry is checked with relative1e-12 tolerance and an absolute1e-20 floor.

Snapshot ts is the current market-minute boundary in seconds. It is converted to explicit UTC milliseconds; maxAge180s/5s clock-ahead tolerance remain enforced. Order plan expiry and observation envelope expiry are different fields.

## State ownership

The terminal creates a root only from revision0/ARMED, with complete non-expired geometry. First-seen entry-ready or terminal-only events are reconciled as missing-root; they do not silently skip context.

Logical identity is source + confirmed setup ID + full configuration hash. Revisions must be contiguous. Allow ARMED->ARMED/ENTRY_READY/EXPIRED/INVALIDATED and ENTRY_READY->ENTRY_READY/EXPIRED/INVALIDATED. Geometry is frozen, observation time cannot regress, and terminal states cannot reopen. Config changes produce separate identities; automatic invalidation of older config instances is not implemented.

Immutable rejected-observation history retains valid envelopes and reasons for conflict, gap, stale revision, bad transition, bad time, changed geometry, expired plan or freshness. Historical rejection records remain even if the missing revision is later supplied and an event is accepted on retry. No automatic gap replay occurs.

## Persistence

Migration003 adds geometry/config/observation time to setups and owner-scoped bindings, immutable observation history and reconciliation tables. PostgreSQL skill guidance informed short transactions, forced RLS, scoped FKs and indexes.

One authenticated source transaction locks the logical setup, validates a revision, creates immutable signal/history and held outbox rows, and updates the current setup. Failed history insertion rolls back the whole revision. Duplicate lookup precedes freshness. Consistent setup reads hold a short shared lock while loading current state/history.

Signal reads now include both original v1 signals and v2 revisions. Setup reads add geometry, last observation, history and reconciliation. Lists remain bounded; full UI pagination is S4.

## Limits

No daemon connection, source defaults change, account migration, provider send or execution. A live exporter with durable sequencing/capture/retry storage must be supplied before claiming live integration. Source/code pin upgrades require an explicit adapter/version migration. S4 owns visual inbox/chart context; S5 owns journal editing; S6/S7 own worker/final integration evidence.
