# M1 S1: private workspace foundation

Status: draft implementation specification, 2026-11-18. Parent: vault SPEC-001, especially A-05/R-05. This slice does not claim the complete M1 signal workflow.

## Selected baseline

Next16.4.6, React19.3.1, Node26.8.1 local runtime baseline, PostgreSQL17.12, pinned dependencies. Local provisioning and opaque PostgreSQL sessions form the private-pilot auth boundary. No signup/default account or external identity service is enabled. Evaluate external identity integration separately if required.

## Acceptance

- S1-01: / redirects to /workspace; anonymous workspace requests redirect to /login. Shell shows account identity and honest empty inbox/journal states, with no fabricated prices or trades.
- S1-02: provisioned users sign in with a password; wrong password, unknown account, malformed and expired/revoked sessions fail. Passwords are scrypt digests; only SHA256 session digests are stored. No default credentials.
- S1-03: HttpOnly, SameSite=Lax cookie; Secure for HTTPS. Login/logout reject cross-origin mutations; successful login rotates existing session; logout revokes it.
- S1-04: two users see only their workspace records; direct non-owner API request returns404; database RLS also denies non-owner access/update/owner reassignment.
- S1-05: local PostgreSQL harness uses a uniquely named disposable container, generated credentials, loopback-only ephemeral port and no reusable data volume. Schema migration is atomic and repeatable.
- S1-06: login failures are rate limited in shared DB state, not process memory. No password/session value is logged.
- S1-07: real browser tests cover anonymous redirect, login failure, two accounts, reload persistence, logout/revocation and cross-origin rejection against the production build and the isolated PostgreSQL database.

## Test-first and completion

Write auth and DB/browser acceptance tests before implementation. Capture a failing baseline then implement. Require existing M0 tests, auth unit tests, real PostgreSQL tests, typecheck, production build, browser acceptance and layout inspection at desktop/mobile sizes.

Production rollout, public registration, scanner events, charts, trade fills and provider notifications remain later M1 slices or later phases.
