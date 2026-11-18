CREATE TABLE core_preferences(
 owner_id uuid PRIMARY KEY REFERENCES terminal_users(id),data jsonb NOT NULL
);
CREATE TABLE core_monitor_state(
 owner_id uuid NOT NULL REFERENCES terminal_users(id),target_key text NOT NULL,
 watchlist_id uuid,trade_id uuid,revision integer NOT NULL,last_sample jsonb,
 sampled_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,target_key),
 FOREIGN KEY(watchlist_id,owner_id) REFERENCES core_watchlist(id,owner_id),
 FOREIGN KEY(trade_id,owner_id) REFERENCES core_trades(id,owner_id),
 CHECK((watchlist_id IS NOT NULL AND trade_id IS NULL AND target_key='watch:'||watchlist_id::text)
 OR (trade_id IS NOT NULL AND watchlist_id IS NULL AND target_key='trade:'||trade_id::text))
);
CREATE INDEX core_monitor_watch ON core_monitor_state(watchlist_id,owner_id);
CREATE INDEX core_monitor_trade ON core_monitor_state(trade_id,owner_id);
CREATE TABLE core_monitor_events(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,target_key text NOT NULL,
 revision integer NOT NULL,kind text NOT NULL CHECK(kind IN ('trigger','stop','target')),
 data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,target_key,revision,kind),
 FOREIGN KEY(owner_id,target_key) REFERENCES core_monitor_state(owner_id,target_key)
);
CREATE INDEX core_monitor_recent ON core_monitor_events(owner_id,created_at DESC,id);
DO $rls$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['core_preferences','core_monitor_state','core_monitor_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_scope ON %I TO terminal_runtime USING(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid) WITH CHECK(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid)',t);
 END LOOP;
END $rls$;
GRANT SELECT,INSERT,UPDATE ON core_preferences,core_monitor_state TO terminal_runtime;
GRANT SELECT,INSERT ON core_monitor_events TO terminal_runtime;
