# M1 S2: scanner-bound persistence

Status: implementation draft, 2026-11-18. Parent SPEC-001 A-01/02/03/05/09/11.
This slice implements storage/API boundaries, not the Mochbot adapter, chart UI, lifecycle rules, notification delivery or journal screens.

## Acceptance

- S2-01: checksummed migration002 upgrades existing S1 data and is repeatable;001 remains unchanged.
- S2-02: authenticated account registers/lists/disables sources and rotates/revokes credentials. Secrets are returned once, stored only as hashes, and omitted from list responses. Wrong account receives404.
- S2-03: Bearer credential binds owner/source. Unauthenticated, revoked, expired or disabled sources cannot ingest. Body source mismatch or owner claims are rejected.
- S2-04: one valid signal creates its canonical instrument, signal, detected setup and dry-run outbox atomically. Freshness/expiry/future observations are enforced for new events.
- S2-05: concurrent identical retries produce one logical signal/setup/outbox and original IDs. Duplicate replay remains possible after expiry; changed content returns409 and an immutable conflict audit without mutating the original.
- S2-06: database failure during outbox insertion rolls back all earlier writes. Reconnecting clients can read committed work.
- S2-07: forced RLS and composite FKs prevent cross-owner reads/updates and parent-child links. Outbox/attempt/source credentials are never exposed to other owners.
- S2-08: pending paper trades and append-only fills preserve exact base quantities, identity and provenance. Duplicate fills are idempotent; conflicting fills, overfills, mismatched owner/source/instrument and exchange-confirmed fills are rejected. Ledger storage is derived from the tested reference reducer.
- S2-09: shadow mode holds outbox work; ingestion sends zero external messages. Attempts schema has unique(outbox,attempt), scope constraints and immutable entries; S6 owns its worker.
- S2-10: strict HTTP JSON routes cap request size, require browser Origin for account mutations, use source Bearer auth for ingestion, return consistent status codes, and never log credentials.

## API

GET/POST /api/sources: owner session; POST {name}.
PATCH /api/sources/:id: owner session + Origin; {enabled}.
POST /api/sources/:id/credentials: rotate; DELETE: revoke all. Owner session + Origin.
POST /api/ingest/signals: Bearer scanner credential; existing strict SignalEvent v1 body.
GET /api/signals and GET /api/setups/:id: owner session.

Signal v1 currently stores strategy/feed evidence, not entry/SL/TP geometry. S3 specifies the scanner adapter and lifecycle versioning. Paper trade/fill repository methods are tested directly; public trade editing remains S5.

## Concurrency and identity

Use one client/transaction, source/credential revalidation with consistent lock order, per-event transaction advisory locks and unique constraints. Canonical instrument metadata is shared public market metadata; owner records are not shared.

Freshness checks apply only after authenticated duplicate lookup. An exact old retry returns the original; a new stale/expired/future event returns422. Same-ID changed content returns409 even when stale. Credentials default to90-day expiry and are immediately revocable.

Versioned signal fingerprints include canonical multiplier spelling, stable object keys and the complete validated envelope. Source identity is server-generated UUID. Trade/fill changes serialize on the owning trade row, with unique source fill IDs as the final duplicate guard.

## Done gate

Existing unit/build/browser gates plus real PostgreSQL concurrency, rollback, duplicate/conflict, source binding, RLS/FK, paper-fill and reconnection tests. No external provider is used.
