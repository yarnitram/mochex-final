CREATE TABLE core_chart_layouts(
 owner_id uuid NOT NULL REFERENCES terminal_users(id),
 symbol text NOT NULL CHECK(symbol ~ '^[A-Z0-9]{1,24}_USDT$'),
 timeframe text NOT NULL CHECK(timeframe IN ('1m','5m','15m','1h','4h','1d')),
 revision integer NOT NULL CHECK(revision>0),
 document jsonb NOT NULL,last_request uuid NOT NULL,fingerprint text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,symbol,timeframe)
);
ALTER TABLE core_chart_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_chart_layouts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_scope ON core_chart_layouts TO terminal_runtime
 USING(owner_id=nullif((SELECT current_setting('terminal.owner_id',true)),'')::uuid)
 WITH CHECK(owner_id=nullif((SELECT current_setting('terminal.owner_id',true)),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON core_chart_layouts TO terminal_runtime;
