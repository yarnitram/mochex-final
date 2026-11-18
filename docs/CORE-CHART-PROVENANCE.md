---
title: "Core Chart Extraction Provenance"
type: architecture
status: draft
created: 2026-11-18
updated: 2026-11-19
ai_access: internal
ai_generated: true
review_status: draft
---

# Mochex Charts baseline extraction

Core3A adds a separately audited extraction from clean source5642f5c: Fibonacci, coordinate projection and drawing history helpers, verified by npm run compare:chart. See CORE3A-ARCHITECTURE.md; the earlier baseline below records its original source observation.

Source: C:/Users/Samjie/ProjectCenter/Mochex, HEAD5fad2a6. The original worktree has unrelated unfinished EMA radar work; the selected EMA and precision source files were clean. No original code was modified.

## Reused modules

- src/lib/indicators/mtf-ema/ema-calculator.ts: calculateEma and getEmaAlpha extracted into src/core/chart/ema.ts with the EmaPeriod union. Index non-null assertions adapt it to this project's strict TypeScript configuration; the SMA-seed/recurrence is unchanged.
- src/lib/chart/price-precision.ts: extracted into src/core/chart/price-precision.ts with one strict array-index assertion.
- TradingViewContainer.tsx candle/volume/EMA rendering design: Lightweight Charts5.2.1, Mochex dark palette, independent volume scale, EMA20/50/100/200 colors, price precision, crosshair and time scale form the initial renderer.
- The new client adds linked EP/SL/TP price lines, fit-to-plan scaling, timeframe controls and fullscreen.

The original TradingViewContainer is331KB and imports auth, alerts, replay, strategy/radar, drawings and many surrounding UI components. This first slice does not copy or claim full workstation parity. Drawings, object tree, saved layouts, custom scripting, multi-chart and replay need separate dependency extraction/tests.

## Feed compatibility

Original Mochex Charts used spot data. EXMOCHEX worklists use MEXC USDT perpetuals. The new core renderer therefore uses only the public futures kline endpoint, explicit symbol/timeframe, sorted UTC-second candles and no other-venue/spot fallback.

Provider arrays are validated for shape, finiteness, positive OHLC, volume and unique timestamps. Empty/provider failure is visible. Candles older than two selected intervals are marked stale. Last receive time is labeled as receive time, not exchange tick time.

Source references: [MEXC futures API](https://mexcdevelop.github.io/apidocs/contract_v1_en/#k-line-data), [Lightweight Charts](https://tradingview.github.io/lightweight-charts/).

Browser rendering uses clearly synthetic intercepted fixtures; a separate public endpoint probe verifies actual provider shape. Screenshots show fixture values, not account performance or market prices.
