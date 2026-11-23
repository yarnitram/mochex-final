# Mochex Charts workstation frontend

Status: implemented and verified 2026-11-23. Design reference: Mochex Charts source `5642f5c`, `src/app/chart/page.tsx`, `src/components/terminal/TacticalHeader.tsx`, `DrawingRail.tsx` and `RightSidebar.tsx`. Original source remained unchanged.

## Acceptance

- CF-01: Charts opens as a focused workstation with a compact market/timeframe header, left drawing rail, central candlestick canvas and right inspector for supported indicators and drawing objects.
- CF-02: All existing drawing, undo/redo, indicator, Save/reload, symbol/timeframe and four pane actions keep their behavior and account scoped layout persistence.
- CF-03: Desktop rail and inspector become stacked controls on narrow screens without horizontal page overflow.

The adaptation includes only tools implemented by the terminal. It does not display the original app's replay, script studio, paper order, alarm or other panels as working controls. The feed remains MEXC USDT perpetual; no spot data or new database migration is introduced.

## Verification

The CF-01 browser workflow covers workstation regions, drawing activation, indicators and 390px width. The existing chart and grid browser workflows cover drawings, Save/reload, conflict handling and pane contexts. Full validation: 53 unit, 36 PostgreSQL, 9 browser/API workflows, both TypeScript checks and production build. Desktop candlestick and mobile screenshots inspected.
