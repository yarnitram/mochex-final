# Core4 completion local validation

- Branch: `phase/core4-journal-completion` from published main `f8bef53`.
- SDD: J-04 calendar/equity test failed before helpers existed; J-05 screenshot integration import failed before its module existed; J-06–08 CSV tests failed before its module existed. Implemented each after the failing check.
- `npm test`:50 passed.
- `npm run typecheck`: domain and web TypeScript passed.
- `npm run build`: production Next build passed.
- `npm run verify:workspace`:36 actual PostgreSQL checks,6 browser/API workflows and one-owner monitor CLI smoke passed; disposable DB/web/fixture removed. J-05 tested image ownership, file rejection, count cap and deletion. J-09 tested import preview/apply, old review non-overwrite, owner isolation and unchanged exits. Browser tested calendar/equity visibility, authenticated image upload/read, wrong-Origin upload denial, CSV export and reviewed-row preview.
- First integration run exposed PostgreSQL Date-to-string mismatch in transfer reconciliation; normalized at the DB boundary and reran all checks successfully. The source-shaped CSV fixture was added after checking clean EXMOCHEX `b2996ed1` read-only.
- Desktop/mobile browser captures inspected. They use synthetic market and trade fixtures. No production database was migrated, no account/runtime deployed, no live-market reliability, full backup restore or performance soak claimed.
