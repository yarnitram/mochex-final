# Core4A: review tags and journal summary

## Acceptance

- J-01 Review text may include up to eight normalized, unique tags, each 2–24 letters, numbers or hyphens. Invalid or extra fields fail. Older review clients that omit `tags` preserve saved tags.
- J-02 Tags persist on the account's trade. The existing forced owner RLS protects reads and updates. Migration007 adds a bounded text array and grants the runtime role update permission on that column only; it does not change trade accounting or execution.
- J-03 The journal searches symbol, strategy, thesis, review and tags; filters by exact tag and net outcome. The visible closed trade subset shows count, net realized USDT, win rate and unweighted average R. Summary arithmetic uses Decimal. Open trades never enter journal totals.
- J-04 Test first: strict tag validation and closed-only filter/summary cases, then actual PostgreSQL persistence/isolation and a browser review/filter/save/reload workflow. Run unit tests, both typechecks and production build before the workspace verifier.

## Limits

The current workbench snapshot caps trade rows at 500; summary and filters describe only loaded rows. Tags are text labels, without taxonomy or import mapping. This phase does not add screenshots, calendar/equity views, CSV import/export or EXMOCHEX reconciliation. Recorded trades remain manual and do not place orders.
