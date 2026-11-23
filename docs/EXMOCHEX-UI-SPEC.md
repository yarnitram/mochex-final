# EXMOCHEX UI adaptation

Status: verified 2026-11-23. Design reference: clean EXMOCHEX source `b2996ed` (`src/components/app-nav.tsx`, `src/components/ui/modal-shell.tsx`, watchlist/journal tables and toolbars, and `src/app/globals.css`). The source was read only.

## Scope

- UX-01: adapt EXMOCHEX's dark violet surfaces, compact top navigation, data table density and stripe/hover states, modal header/form/footer, and selected tab language to the terminal.
- UX-02: retain live search, sort and column preferences; add 20/50/all row paging with current page clamped after filtering. Keep journal totals based on the full filtered set.
- UX-03: modal opens on its first form field, traps Tab, closes with Escape when no mutation or upload is running, restores focus to the opening action, and prevents body scrolling while open.

This is a UI adaptation to the terminal's existing API and database. EXMOCHEX's Supabase connection, spot market assumptions, extra modules, and exchange actions are not copied. The chart canvas retains its own dark rendering controls. No database migration.

## SDD and verification

UX-01 pagination test first failed because the helper was absent. Final: 53 unit tests, two TypeScript checks, production build, 36 disposable PostgreSQL tests and 8 browser/API workflows passed. UX-02 browser test covers navigation, modal keyboard flow, paging controls and mobile width. Desktop watchlist, modal and mobile journal screenshots were visually inspected.
