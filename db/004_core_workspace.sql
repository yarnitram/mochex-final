CREATE TABLE core_watchlist(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES terminal_users(id),request_id uuid NOT NULL,
 data jsonb NOT NULL,fingerprint text NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','opened','archived')),
 revision integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,request_id),UNIQUE(id,owner_id)
);
CREATE INDEX core_watchlist_owner ON core_watchlist(owner_id,created_at DESC);
CREATE TABLE core_trades(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES terminal_users(id),request_id uuid NOT NULL,
 watchlist_id uuid UNIQUE,data jsonb NOT NULL,fingerprint text NOT NULL,review text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz,UNIQUE(owner_id,request_id),UNIQUE(id,owner_id),
 FOREIGN KEY(watchlist_id,owner_id) REFERENCES core_watchlist(id,owner_id)
);
CREATE INDEX core_trades_owner ON core_trades(owner_id,created_at DESC);
CREATE TABLE core_exits(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,trade_id uuid NOT NULL,request_id uuid NOT NULL,
 data jsonb NOT NULL,fingerprint text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(trade_id,request_id),FOREIGN KEY(trade_id,owner_id) REFERENCES core_trades(id,owner_id)
);
CREATE INDEX core_exits_owner ON core_exits(owner_id);
DO $rls$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['core_watchlist','core_trades','core_exits'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_scope ON %I TO terminal_runtime USING(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid) WITH CHECK(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid)',t);
 END LOOP;
END $rls$;
GRANT SELECT,INSERT ON core_watchlist,core_trades,core_exits TO terminal_runtime;
GRANT UPDATE(data,fingerprint,status,revision) ON core_watchlist TO terminal_runtime;
GRANT UPDATE(review,closed_at) ON core_trades TO terminal_runtime;
