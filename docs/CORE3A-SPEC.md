# Core3A: saved chart workspace

Owner continuation and Git push authorization:2026-11-19. Dedicated phase/core3-chart-workspace branches from the newly committed Core1/2 baseline6554fd8 on main. Push only after verification/review.

## Acceptance

- A-01 Draw tools: horizontal line (one point), trend line, rectangle and Fibonacci retracement (two points), anchored by UTC-second time and price. Reuse Mochex Fibonacci/history/math helpers from clean source5642f5c; adapt its millisecond interfaces explicitly. No original project modification.
- A-02 Object management: list/select, rename/color/geometry edit, hide/show, lock/unlock and delete; locked objects cannot be accidentally edited/deleted. Drawing history supports50 undo/redo steps, redo cleared on new edits. Cancel partial drawing with Escape.
- A-03 Layout: save drawings, EMA/SMA/RSI/volume choices and current logical viewport per account+native MEXC perpetual symbol+timeframe in PostgreSQL. Empty default is explicit; no cross-market/cross-account leakage.
- A-04 Writes: forced owner RLS, strict versioned schema/size bounds, unique drawing IDs, finite coordinates, optimistic revision compare-and-swap and idempotent exact retry.409 conflicts preserve local draft and offer explicit reload. Failed load/save never silently replaces a draft. Unsaved-draft navigation/reload is guarded.
- A-05 Indicators: retain Mochex EMA20/50/100/200; add SMA20/50 and Wilder RSI14 pane (known reference tests), volume toggle. Saved choices hydrate on remount.
- A-06 Chart behavior: drawings follow pan/zoom/resize and price scaling; chart remains navigable in cursor mode; drawing mode prevents accidental scrolling. Market feed/auth/last-price monitoring invariants remain. No automatic trade execution.
- A-07 Verify: meaningful failing geometry/history/validation/indicator tests before implementation; real PostgreSQL CAS/concurrency/idempotency/isolation; browser draw/edit/undo/lock/save/reload/context/viewport/indicator/conflict and mobile checks; prior regressions, typecheck/build.
- A-08 Publish: review staged file list and credential/artifact exclusions; commit phase, integrate verified branch into main, push to authorized yarnitram/mochex-final, verify remote commit and clean source state. No vault/private runtime/credentials included. Deployment remains separate.

## Scope limits

Single chart with four drawing tools and manual save. No on-canvas drag handles, arbitrary scripts, multi-chart, replay, full14-tool Mochex parity or journal analytics. Objects can be edited using the object panel. Symbol/timeframe isolation is stricter than the original symbol-only localStorage persistence. Initial schema allows100 drawings, bounded labels,50 undo steps; history stacks remain session-only.

Layout saves include zoom at Save layout time. Chart saves do not alter linked trade levels. Mochex baseline helper provenance and market rules remain in CORE-CHART-PROVENANCE.md.
