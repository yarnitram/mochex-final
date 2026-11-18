---
title: "Core3A Saved Chart Architecture"
type: architecture
status: draft
created: 2026-11-19
updated: 2026-11-19
ai_access: internal
ai_generated: true
review_status: draft
---

# Chart documents and rendering

Single MEXC USDT perpetual chart. Four tools: horizontal line, trend line, rectangle and Fibonacci retracement. Drawings store UTC-second anchors and positive finite prices, never screen coordinates. A DPR-aware clipped canvas projects those anchors through the active Lightweight Charts axes on animation frames, keeping drawings aligned with pan/zoom/resize/price-scale changes. Cursor mode retains normal chart interaction; tool mode captures pointer-up coordinates and disables scrolling/scaling. This avoids the chart library's rapid double-click suppression of a second drawing point.

Objects are selected/edited in the object panel. Name, color, time/price geometry, visibility and lock state are supported. Locked objects require unlocking before geometry edit/deletion. Numeric geometry and UTC-date editing replace on-canvas drag handles in this first slice. Tool selection/Escape resets a partial drawing. Maximum100 drawings;50-step undo/redo is session history, not persisted.

## Actual Mochex extraction

Clean Mochex source HEAD5642f5c, src/lib/chart/drawing-math.ts:
- FibLevelConfig/FibLevel/default levels/calculateFibLevels retained.
- extrapolateCoordinateToTime and extrapolateTimeToCoordinate retained.
- DrawingHistoryState/pushDrawingHistory/performDrawingUndo/performDrawingRedo retained with local Drawing type.
- New exported aliases historyPush/historyUndo/historyRedo provide the core API.

Original coordinate helper parameter names/comments use milliseconds. Their arithmetic is unit-agnostic; all inputs here consistently use seconds and selected timeframe duration in seconds. The document schema rejects millisecond timestamps. Original Mochex uses symbol-scoped localStorage; this project intentionally saves per account+symbol+timeframe in PostgreSQL. No source repository edits.

npm run compare:chart executes clean pinned source pure helpers and compares actual Fibonacci output, coordinate projection and60 history pushes/undo/redo. It fails if source HEAD or selected file changes. Optional sibling-source check, not required for a standalone clone.

SMA20/50 and Wilder RSI14 are newly implemented pure functions, with warmup and known-value tests; they are not claimed as extracted Mochex code. EMA/precision extraction remains in CORE-CHART-PROVENANCE.md. RSI renders in a dedicated0..100 pane with30/70 guides.

## Persistence and security

Migration006 creates core_chart_layouts, primary key owner/symbol/timeframe and forced owner RLS with indexed scope. Its rows contain strict version1 document, increasing revision, last request UUID and document fingerprint. Runtime has no owner bypass or deletion grant. Existing migrations were not edited.

GET /api/core/chart?symbol=BTC_USDT&timeframe=15m requires a session and returns default document/revision0 only when that owner/context has no saved row.

POST /api/core/chart requires session, exact Origin, size-bounded JSON and strict {symbol,timeframe,revision,requestId,document}. Document schema bounds drawing IDs/types/geometry/colors/labels/indicators/viewport; unknown fields and duplicate drawing IDs fail. Symbol native normalization is MEXC perpetual only.

A per-owner/context advisory lock plus row lock serializes saves. Expected revision must match; update increments it. An exact last-request retry returns the same revision; changed retry content or stale revision returns409. Actual DB constraint failure leaves the prior row intact. No scanner/ledger tables are mutated.

## Draft behavior

Save layout manually persists drawings, indicators/volume and current logical viewport. Status distinguishes loading, unsaved changes, saving and saved revision. Saving is not automatic. Layout loading failure leaves editing disabled, with an explicit error/reload option. A save conflict/failure retains the current draft; Reload saved asks before discarding it.

Unsaved drawing/indicator changes guard navigation, symbol/timeframe changes and browser unload. Layout responses carry context identity; a request epoch prevents delayed old-context loads/saves from replacing the current document after fast navigation. Browser tests deliberately delay one market response and release it after switching markets.

Viewport is captured at Save time, using logical bar positions relative to the fetched500-candle window. It does not promise an absolute historical replay window as that rolling feed advances. Panning alone is not labeled as a drawing/indicator draft change; Save remains available to capture the new zoom.

## Limits

No on-canvas drag handles, full14-tool parity, chart grids, scripts, replay, journal analytics or automatic execution. No production migration or persistent runtime is provisioned. REST feed freshness and Core2 observed-price monitoring remain unchanged; no fresh live-browser soak or performance/24-hour claim is made. Test screenshots use synthetic candles/trades. Publication authorization covers Git source, not deployment.
