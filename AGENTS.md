# Mochex Terminal

Planning authority: CommandCenter/02 - Projects/Active/Mochex-Terminal.
Active owner scope: EXMOCHEX watchlist/trades/journal + Mochex Charts. Core1 and Core2 are locally verified; use docs/CORE-V2-SPEC.md, docs/CORE2-SPEC.md and their validation records. Next: Core3 chart extraction. The earlier M1 scanner backlog is deferred.
Read README.md, current phase spec, docs/SOURCE-AUDIT.md and docs/ADR-001-domain-ownership.md.

Use SDD: specify behavior, write meaningful failing tests, implement and record passing evidence. Keep implementation in ProjectCenter, continuity in CommandCenter. Preserve source projects and unfinished work; never copy their secrets, databases or production records.

Version contracts; preserve venue/market/instrument identity. Ledger quantities are base units. Do not multiply quantity-based PnL by leverage. Signals cannot establish exchange-confirmed fills.

M0 is a pure domain foundation; database/auth/browser/delivery gates are M1 and later. Use offline fixtures and dry-run delivery by default.

Use dedicated branches. The remote began empty; current phase/core2-market-monitoring holds preserved bootstrap work and the Core v2 remake. Intended base: main after an authorized first integration. Do not commit, merge, push or deploy without the applicable authorization.
