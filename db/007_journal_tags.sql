ALTER TABLE core_trades ADD COLUMN tags text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE core_trades ADD CONSTRAINT core_trades_tags_bound CHECK(cardinality(tags)<=8);
GRANT UPDATE(tags) ON core_trades TO terminal_runtime;
