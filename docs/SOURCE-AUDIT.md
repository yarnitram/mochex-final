---
title: "M0 Source Audit"
type: audit
status: draft
created: 2026-11-18
updated: 2026-11-18
ai_access: internal
ai_generated: true
review_status: draft
---

# Bounded source audit

Root: C:/Users/Samjie/ProjectCenter. Observation date:2026-11-18. Source and handoffs do not establish deployed state.

| Project | Branch / HEAD / working tree | Language, runtime and storage | Reuse decision and evidence |
| --- | --- | --- | --- |
| Mochex | feat/ema-20-50-100-200-radar-alarms / 5fad2a6 / dirty | TypeScript, Next15.1.7/React19, PocketBase plus JSON alerts | Chart UI behind matching futures adapter; pure EMA executed, app not rerun |
| EXMOCHEX | master / b2996ed / clean | TypeScript, Next16.3.6/React19.2.8, Supabase PostgreSQL | Journal flows and calculation validation; pnlDollars executed, DB/auth/watcher not run |
| mochbot | main / 271cc54 / clean | TypeScript, Node>=22.13, SQLite | First scanner adapter; preserve worker. Source has11 active strategy IDs; pure EMA executed |
| CryptoRadar | main / a87b9a3 / clean | Python>=3.12/FastAPI, Next16.4.5, PostgreSQL17/Redis8 | Keep Python research APIs for M4; source/config and context inspected, runtime not verified |
| Emalert | main / 8db078d / clean | Python>=3.12,<3.14/FastAPI; SQLite outbox documented in handoff | Prefer ClosedEMA over legacy helper; both pure calculation files executed |
| Futures-EMA-Radar | phase/m1-candle-engine / no commits / untracked implementation | Python asyncio/FastAPI, React, PostgreSQL | Preserve MEXC discovery-only rule and actual candle venue; source/prior notes inspected, no runtime test |
| TradeAlarm | phase/m1-scanner-auth / 153ddbb / dirty | TypeScript Expo/Fastify; Supabase schema/outbox | Later mobile consumer with contract adapter; contract/package inspected, no device test |
| Phantom-SMC | feat/phantom-visual-indicators / no commits / untracked implementation | Pine v6 plus local validation tools | Research rules until compiler/model parity established; location/status/context inspected, no Pine run |

New terminal: origin was empty. phase/m0-foundation is an unborn local bootstrap branch; main is intended after authorized initial integration.

## Selected source boundaries

- Mochex/src/lib/indicators/mtf-ema/ema-calculator.ts: SMA seed.
- Mochex/src/lib/alerts/server-alerts-store.ts: JSON persistence/default-trader fallback; replace with owner-bound persistence.
- Mochex/src/lib/alerts/auto-ema-engine.ts: unfinished multi-venue work; preserve uncommitted state.
- mochbot/src/types.ts and src/strategy/indicators.ts: catalog, candle units, pure EMA/aggregation.
- mochbot/src/engine/lifecycle.ts: partial TP1 and runner accounting.
- mochbot/src/notify/mochex.ts and src/engine/runner.ts: existing bridge; TP1 updates SL/TP without partial-fill quantity.
- EXMOCHEX/src/lib/calculations.ts and trade-calc.ts: quantity/fee and whole-position math.
- EXMOCHEX/src/lib/bot-trade-api.ts and src/app/api/trades/webhook/route.ts: current open/update/close/watchlist/journal actions.
- Emalert/app/indicator.py: Decimal ClosedEMA; app/ema.py: legacy first-close seed.
- Futures-EMA-Radar/futures_ema_radar/candles.py: SMA warmup, active-candle range and venue guard.
- TradeAlarm/packages/contracts/src/index.ts: existing source/price/time payload needs mapping.
- CryptoRadar/mochex_radar/candidate_evaluation.py and wallet_history.py: later evidence boundaries identified from project source context.
- Phantom-SMC/strategies and indicators: research references only.

## Executed comparisons and limits

Synthetic closes1..21 at period20: Terminal, Charts, Mochbot and Emalert ClosedEMA return11.5. Mochbot warmup NaNs are normalized to null. Emalert's old helper returns12.783540952181157 due to its different seed.

For10 units entered at100 then5 exited at106 and5 at100: terminal and EXMOCHEX calculation applied per leg yield30 gross. EXMOCHEX calculation supplied only the final100 exit for all10 units yields0. This demonstrates information loss; it is not a running webhook integration test.

Existing suites were not rerun. Historical handoff test counts remain historical. Python3.14.7 executed only isolated stdlib calculation files, outside Emalert's full-app declared runtime range; this does not establish application compatibility.

No credentials, databases, source runtime files or production records were copied or modified.
