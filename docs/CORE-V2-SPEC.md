# Core v2: EXMOCHEX workflows + Mochex Charts

Active scope reset requested2026-11-18. Supersedes the scanner-first roadmap for current work.

This is the completed Core1 baseline. Core2 extends it with discovery, live watchlist columns and observation-only crossing monitoring; see CORE2-SPEC.md. Full chart extraction remains Core3, and recorded entries/exits remain manual.

## First working slice

Watchlist -> manually record open trade -> record partial/full exit -> review journal, with a linked MEXC perpetual chart. Existing login/owner isolation is retained. Earlier scanner code/tests are preserved as deferred work, not part of navigation.

- C-01: own-account watchlist CRUD/archive includes symbol, direction, trigger, EP/SL/TP, timeframe, strategy and notes; reject invalid directional plans.
- C-02: open a recorded trade from a setup, or manually. Margin/leverage determine base quantity once; no exchange API order is placed. Opening from the same setup twice is idempotent.
- C-03: partial/full exit records are immutable and request-idempotent. Locked trade updates prevent overclosing. PnL uses base quantity*price difference minus recorded fees, without a second leverage multiplier.
- C-04: trades view shows open records and remaining quantities; journal shows closed records with entry/exit history, PnL/R, strategy, notes and editable review.
- C-05: primary navigation is Watchlist / Trades / Journal / Charts. Each row can open its matching symbol chart. Real empty states, search/filter and useful desktop/mobile layouts.
- C-06: chart baseline extracts Mochex Charts EMA/precision modules and its Lightweight Charts5.2.1 candle/volume/EMA design. Add symbol/timeframe selection, EP/SL/TP overlays and fullscreen. Full drawings/multi-chart/custom scripts/replay parity is a later extraction slice.
- C-07: default market is MEXC USDT perpetual, matching EXMOCHEX. Use the actual futures candle endpoint; do not substitute another venue/spot or fabricated data. Failure/empty/stale states must be visible.
- C-08: owner-bound APIs, exact-Origin mutations, forced RLS, scoped FKs, size/schema validation and transaction rollback tests continue.
- C-09: test-first domain and actual PG tests plus browser setup->trade->exit->journal workflow, chart fixture rendering, non-owner rejection, typecheck/build and visual inspection.

## Source boundaries

EXMOCHEX b2996ed: watchlist-utils/types/calculations and watchlist/trades/journal UX as references.
Mochex Charts5fad2a6: clean EMA calculator, price-precision helper and candlestick/volume/EMA rendering settings. The large existing container is tightly coupled to auth, alerts, replay and scanner modules; extraction is incremental.

No original repository, existing database or production service is changed. Manual recorded trades are not exchange-confirmed fills. Live watchers/trigger execution, notifications, scanners, bot adapters, mobile and public sharing are deferred.
