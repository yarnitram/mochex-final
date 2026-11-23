# Core4 completion: journal depth

Core4A supplied review tags, search/outcome filters and a filtered summary. This completion adds screenshots, calendar/equity analytics and EXMOCHEX shaped CSV transfer/reconciliation. The original manual trade and exit ledger remains authoritative.

## Acceptance

- J-04 UTC close-day buckets and cumulative net P&L are computed with Decimal from closed trades, stably ordered by close timestamp and trade ID. The journal calendar and equity line respond to the current filters. The workbench snapshot remains bounded at500 trade rows, so these on-screen views describe loaded rows.
- J-05 A signed-in account may attach up to three PNG/JPEG/WebP screenshots, at most1 MiB each, to its own closed trade. A dedicated bytea table has forced owner RLS, composite trade/owner FK, bounded bytes, restricted grants and an owner+trade index. HTTP upload checks exact Origin, declared MIME and file signature; image GET requires a session and uses private no-store/nosniff; DELETE is owner-scoped. Screenshot bytes never enter the workbench JSON snapshot or CSV.
- J-06 Accept a UTF-8 CSV of up to1 MiB/5000 rows with the source EXMOCHEX trade-export header set (including its optional columns), while requiring Date, Symbol, Side, Entry, P&L ($), Tags and Notes. Parse quoted fields and normalize strict tags. Reject spreadsheet formula prefixes in imported notes.
- J-07 Preview reconciliation by optional exact Trade ID or uniquely matching UTC close date, native symbol, side and entry. Compare reported P&L rounded to cents. Report unmatched, ambiguous, mismatch, already reviewed, duplicate and empty rows. Apply rechecks inside an owner-scoped transaction with row locks and writes only notes/tags for ready rows. It never creates or edits a trade or exit.
- J-08 Export up to5000 owned closed trades as a CSV with EXMOCHEX column names plus Trade ID. Blank fields that have no equivalent in the manual ledger, including single Exit and P&L (%), instead of inventing values. Neutralize spreadsheet formulas in text. Users must save an EXMOCHEX XLSX export as CSV to import it here.
- J-09 Use test-first pure analytics/parser cases, actual PostgreSQL migration/RLS/screenshot/import checks, browser chart/regression and journal interactions, desktop/mobile inspection, typechecks and production build. Preserve original EXMOCHEX/Mochex worktrees.

## Source and limits

EXMOCHEX source inspected read-only at `b2996ed1c800756b7a1d8a86fc7fb08c53f88368`: `src/lib/export-trades.ts` defines the XLSX column shape; `supabase/migrations/029_watchlist_and_trade_screenshots.sql` documents multiple screenshot links. `fixtures/exmochex-journal-sanitized.csv` is synthetic and carries no user data. This implementation stores private image bytes under owner RLS, avoiding external share URLs. It does not import historical fills or make CSV a backup/restore format. Core5 owns backup/restore and production release gates.
