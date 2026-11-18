---
title: "ADR-002 Private Workspace Foundation"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# ADR-002: private pilot account and workspace baseline

Selected during authorized M1 continuation, subject to owner review.

## Baseline

Next16.4.6/React19.3.1, Node26.8.1 local pin, PostgreSQL17.12 pinned by image digest. Domain calculations remain separate from web and database code. All package versions are pinned.

Local accounts are explicitly provisioned with the CLI; no public signup/default password/test-account bypass exists. This avoids attaching a pre-existing application's identity or database to an experimental workspace. External identity integration remains a future explicit design choice.

Passwords use salted scrypt (N32768,r8,p1,64-byte output); sessions use32 random bytes and only SHA256 digests are stored. Sessions expire after8h, rotate on successful login and revoke on logout. Login attempts share a PostgreSQL limiter (5 attempts per email/15min; generic failure). Mutations require the configured exact Origin. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS; local verification uses loopback HTTP.

## Persistence and ownership

Migration/provisioning use a separate administrator connection. Web runtime uses a non-superuser/non-BYPASSRLS login with membership in terminal_runtime. Auth tables remain server-only. User-owned workspace records require forced RLS with transaction-local owner context from the verified session. Both USING and WITH CHECK restrict updates; owner indexes support account queries.

The server is the trusted setter of that database context: runtime SQL access is not a client-facing API. A session/body user ID cannot select a different owner.

Migration001 is transactional, advisory-locked, versioned and checksum-checked. Repeating it is safe; changing an applied migration is rejected. The current uncommitted migration was refined only against new disposable databases.

## Testing and limits

The harness uses a unique disposable PostgreSQL container, generated credentials, loopback-only ephemeral port, no reusable volume and finally cleanup. It runs actual DB checks then production Next with Chromium. Fixtures are synthetic and never become default application accounts.

S1 provides workspace/auth only. Saved workspace records are an isolation fixture, not scanner setups. Connected scanner/setup/journal counts are empty-state placeholders until the corresponding S2-S5 stores exist. Production deployment, recovery email, MFA, external identity and scanner/trade integration are not established.

The PostgreSQL best-practices skill informed forced RLS, owner indexes, transaction scoping and testing under a role without bypass privileges.
