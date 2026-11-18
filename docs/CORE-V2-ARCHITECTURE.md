---
title: "Core v2 Manual Workspace Architecture"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# Core trading workspace

The current primary workflow is EXMOCHEX watchlist -> recorded trade -> journal, with Mochex Charts analysis. The scanner-first plan is deferred.

Existing private sessions/owner context are retained. Migration004 adds core_watchlist, core_trades and append-only core_exits with forced RLS and composite owner links. These tables do not require scanner/source/strategy registrations.

Opening from a watchlist locks the setup, creates at most one trade and marks it opened atomically. Manual opens use per-owner request identity. Exit writes lock the trade, validate remaining base quantity and append an idempotent exit; full closure makes that same trade appear in the journal. Reviews are part of the trade record. PnL/R uses initial entry/stop risk and recorded fees; quantity is derived from margin*leverage/entry once, rounded to18 decimal places.

The HTTP workspace endpoint uses authenticated sessions, exact Origin, strict JSON envelopes and domain validation. Each account sees its own records. Initial lists are bounded to500 setups/trades; pagination/advanced analytics remain later work.

The primary page is /workbench and successful login opens it. /workspace and prior scanner APIs are retained development groundwork, not primary navigation. No live producer, automatic trigger monitor, TP/SL daemon, provider delivery or exchange execution is enabled by the core remake.

The PostgreSQL best-practices skill informed the owner/FK indexes, restricted grants, forced RLS and row-locked transitions. EXMOCHEX supplies workflow/domain references; source repositories and existing databases remain unchanged.
