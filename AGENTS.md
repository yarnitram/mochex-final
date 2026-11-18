# Mochex Terminal

Planning authority: CommandCenter/02 - Projects/Active/Mochex-Terminal.
Active owner scope: EXMOCHEX watchlist/trades/journal + Mochex Charts. Core1/2 and Core3A are implemented; use docs/CORE3A-SPEC.md, CORE3A-ARCHITECTURE.md and validation records. Broader Core3 chart tools/grids/replay remain future slices; the earlier M1 scanner backlog is deferred.
Read README.md, current phase spec, docs/SOURCE-AUDIT.md and docs/ADR-001-domain-ownership.md.

Use SDD: specify behavior, write meaningful failing tests, implement and record passing evidence. Keep implementation in ProjectCenter, continuity in CommandCenter. Preserve source projects and unfinished work; never copy their secrets, databases or production records.

Version contracts; preserve venue/market/instrument identity. Ledger quantities are base units. Do not multiply quantity-based PnL by leverage. Signals cannot establish exchange-confirmed fills.

M0 is a pure domain foundation; database/auth/browser/delivery gates are M1 and later. Use offline fixtures and dry-run delivery by default.

Use dedicated branches from main. The owner explicitly authorized Git publication on2026-11-19; Core3A was verified on phase/core3-chart-workspace for integration into main. Further commit/push work needs applicable authorization; deployment remains separate. Preserve earlier phase evidence.
