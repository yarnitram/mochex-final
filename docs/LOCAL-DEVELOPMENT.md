---
title: "Local Workspace Development"
type: guide
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# Local development

## Reproduce without persistent accounts or data

Run npm ci --ignore-scripts, npm test, npm run typecheck, npm run build and npm run verify:workspace. Docker Desktop Linux engine and installed Playwright Chromium are required for the final command.

Install the browser once with npx playwright install chromium. The verifier starts its own isolated DB and web process, seeds generated test credentials, runs tests, captures screenshots and removes the temporary runtime. It does not leave a browsable service running.

## Use a persistent local workspace

Use a dedicated local PostgreSQL17 instance/database. Never point this prototype at an existing project database. Keep the instance bound to loopback and configure its credentials through your secret-management/process environment.

Set ADMIN_DATABASE_URL for migrations and account provisioning. Run npm run db:migrate; this applies all checksummed migrations (001 workspace/auth,002 scanner/event/fill/outbox storage,003 observation lifecycle,004 manual core workspace,005 market preferences/monitor state/events) and creates terminal_runtime as a NOLOGIN role. A database administrator must provision a separate non-superuser/NOBYPASSRLS login with membership in terminal_runtime; use that restricted login in DATABASE_URL. Do not use the administrator URL for the web runtime.

Set APP_ORIGIN=http://127.0.0.1:3021 and DATABASE_URL in a git-ignored .env file for Next. For CLI commands, pass settings through the process environment; the tsx scripts do not automatically load .env files. .env.example lists field names without credentials.

Set TERMINAL_ACCOUNT_EMAIL and TERMINAL_ACCOUNT_PASSWORD in the CLI process environment, then run npm run account:provision. The command creates a new account and does not reset existing passwords. Clear password environment values after provisioning.

Start with npm run dev or npm run build followed by npm start. Both bind only to127.0.0.1:3021. Sign in with the provisioned account. There are no default credentials.

Successful login opens /workbench: Watchlist / Trades / Journal / Charts. This is manual tracking; recorded entries/exits do not place exchange orders. Charts use public MEXC perpetual candles and visibly report unavailable/stale data. Earlier /workspace and scanner APIs remain preserved groundwork.

Core2 adds live MEXC perpetual watchlist quotes, contract discovery, account-saved columns/sorting and observed-price crossing events. Quotes must be<=30s old and no more than5s ahead of the app clock; synchronize the pilot host clock if rows report future timestamps. Browser polling runs every10s while open and does not provide24/7 coverage by itself.

Optional monitor CLI: set DATABASE_URL to the restricted runtime login and TERMINAL_MONITOR_OWNER_ID to the provisioned account UUID in the process environment, then run npm run monitor:core. Add -- --once for a one-shot check. CLI scripts do not automatically load .env. It monitors only that explicit owner, reuses persisted baselines and never creates trades/exits. Stop with Ctrl+C. No background service is automatically installed.

The verifier's public-market HTTP fixture and fetch preload apply only to its spawned test processes. Normal dev/start and monitor commands always use the pinned public provider URLs. See docs/CORE2-ARCHITECTURE.md for API and sampling limits.

Use HTTPS and a matching APP_ORIGIN before any remote pilot; no remote deployment or externally verified identity flow is included in S1.

S2 adds the API in docs/API-S2.md. Keep scanner credentials server-side. Use TERMINAL_INGEST_MODE=shadow for held outbox jobs; dry-run only queues simulated delivery. No delivery worker or external provider is enabled yet. Never edit an applied migration to update a persistent database; add the next numbered migration instead.
