---
title: "S2 Local API Reference"
type: guide
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# S2 API reference

All routes are local private-pilot functionality. Use the provisioned account session for owner operations and a scanner Bearer credential for ingestion. Do not paste actual passwords or credentials into documentation.

| Route | Authentication | Behavior |
| --- | --- | --- |
| GET /api/sources | Account session | List owned ID/name/enabled/created records, no key/hash |
| POST /api/sources | Account session + exact Origin | Strict JSON {name};201 returns generated source ID and one-time credential |
| PATCH /api/sources/:id | Account session + exact Origin | Strict JSON {enabled}; other owner404 |
| POST /api/sources/:id/credentials | Account session + exact Origin | Rotate; returns new credential once, revokes previous keys |
| DELETE /api/sources/:id/credentials | Account session + exact Origin | Revoke all credentials for owned source |
| POST /api/ingest/signals | Authorization: Bearer with scanner credential | Strict SignalEvent v1; credential source must match sourceId |
| GET /api/signals | Account session | Most recent100 owned signals with setup IDs/state |
| GET /api/setups/:id | Account session | Owned setup/evidence; unknown/non-owner404 |

JSON mutation bodies require application/json and are capped at65536 actual bytes. Missing/invalid auth401, source claim mismatch403, body/schema error400, media error415, oversize413, stale/expired/future new event422, changed duplicate409, unexpected database error503. Owner browser mutations require the exact configured Origin; scanner ingestion uses only explicit Bearer authentication.

Successful new ingestion returns202 with kind=created and signalId/setupId/outboxId. Identical retry returns200 with kind=duplicate and the same IDs. Changed same-ID content returns409 with kind=conflict and original IDs; no existing payload is replaced.

Use fixtures/contracts-v1.json as a structural example, replacing source identity and timestamps through a real adapter. Its historical timestamps are deliberately unsuitable as a new live observation. Never claim another owner in the body; strict v1 forbids that field.

TERMINAL_INGEST_MODE defaults to shadow (held jobs); dry-run queues simulated work only. No provider messages are sent. Source management UI, full setup inbox and journal editing remain subsequent slices.
