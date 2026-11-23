# Core3D: Mochex Charts grid

Status: implemented and verified on 2026-11-23. Source: Mochex Charts `src/lib/chart/multi-chart-grid.ts` at clean commit `5642f5c`; pure grid state adapted to native MEXC USDT perpetual symbols and the terminal's `1m`–`1d` candle intervals. Original Mochex source remains unchanged.

## Acceptance

- G-01: one, two vertical, two horizontal and four pane presets; each pane keeps its symbol and timeframe.
- G-02: selecting a pane makes its controls active. Symbol and timeframe synchronization are opt-in. Only native MEXC USDT perpetual identities are accepted.
- G-03: each pane uses the existing account/symbol/timeframe saved chart layout. Context changes, hiding a dirty pane, and leaving Charts guard unsaved drafts.
- G-04: watchlist/trade Chart opens in the active pane with its trade levels; ledger records remain untouched.

Crosshair sync from the original grid engine is deferred. The adapted default disables it and the UI does not show a nonfunctional control. This phase retains the terminal's existing indicators, drawing tools, manual Save, and exact-market feed checks. No database migration or exchange order path is added.

## SDD and evidence

The first G-01/G-02 run failed with missing grid module. After implementation, 52 unit tests, both TypeScript checks, production build, 36 disposable PostgreSQL checks, and 7 browser/API flows passed. G-03 browser coverage exercises four panes, independent and synced markets, collapse to one pane, unsaved change denial, Save, and symbol switch.
