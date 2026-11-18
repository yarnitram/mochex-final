---
title: "ADR-003 Scanner Persistence Boundaries"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# ADR-003: authenticated source observations and atomic persistence

Selected for S2 under the user's continuation request; subject to owner review.

## Identity and access

Sources are owner-bound UUID records. Credentials contain32 random bytes, are returned once, SHA256-hashed at rest, expire after90 days and can be rotated or revoked. Rotation revokes previous credentials in the same transaction. Source enable/disable, rotation and ingestion use a consistent source-before-credential lock order.

Credential discovery uses a transaction-local credential hash; after verification, the server binds transaction-local owner context. Source/credential validity is rechecked while locked. The application database role has no superuser/bypass privileges. Credentials are never listed, logged or put in URLs.

Forced RLS protects all9 private tables in migration002; composite parent/owner FKs independently reject cross-account links. The instrument registry contains only shared public market identity metadata. Lists are bounded (sources200, signals100); pagination is a later UI concern.

## Event identity and transactions

Signal fingerprints cover the validated v1 envelope with sorted JSON keys and canonical multiplier spelling. Identity is (source_id,source_event_id). A transaction advisory lock serializes that event; database uniqueness is the final guard.

One client/transaction registers the instrument and creates signal, detected setup and one dry-run outbox job. Exact duplicates return original IDs, including after expiry. Changed content reusing identity returns409 and commits a deduplicated fingerprint conflict audit; it does not overwrite the original. The audit stores identity/fingerprint, not a full incoming payload or lifecycle reconciliation history.

New events must be unexpired and within configured maxAgeSeconds; clock-ahead observations tolerate at most5 seconds. Duplicate lookup precedes freshness checks so response loss/retry cannot create a second event. Outbox insertion failure rolls back all earlier writes.

HTTP ingestion defaults to shadow, which holds the outbox job. An operator can select dry-run, which queues only simulated delivery. No provider adapter or worker is implemented in S2.

## Fill persistence

Paper trade headers link to an owned setup, source and instrument. The reference ledger permits one initial entry plus partial exits in exact base quantities, quote-currency fees and one consistent simulated/manual provenance. No exchange-confirmed execution can enter through this repository.

Fill writes lock source fill identity before trade row state. This makes concurrent reuse across different trades a409 conflict rather than an unclassified unique violation. Fill records are append-only; the ledger snapshot is derived atomically. Public trade editing and journal screens remain S5.

Delivery-attempt records have unique(outbox,attempt), composite ownership FKs and append-only grants. The S6 worker will add delivery behavior and fault handling.

## Limits

Signal v1 has strategy/feed evidence but no entry/SL/TP geometry. S3 must define a compatible observation adapter/lifecycle contract before connecting Mochbot. S2 read APIs do not constitute the visual inbox or chart integration.

The PostgreSQL skill guided RLS predicates, owner/FK indexes, constrained privileges and real non-superuser tests. No existing project or production database was migrated.
