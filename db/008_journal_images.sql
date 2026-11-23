CREATE TABLE core_trade_images(
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL,
 trade_id uuid NOT NULL,
 mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 16 AND 1048576),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(trade_id,owner_id) REFERENCES core_trades(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX core_trade_images_owner_trade ON core_trade_images(owner_id,trade_id,created_at);
CREATE INDEX core_trades_owner_closed ON core_trades(owner_id,closed_at,id) WHERE closed_at IS NOT NULL;
ALTER TABLE core_trade_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_trade_images FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_scope ON core_trade_images TO terminal_runtime
 USING(owner_id=nullif((SELECT current_setting('terminal.owner_id',true)),'')::uuid)
 WITH CHECK(owner_id=nullif((SELECT current_setting('terminal.owner_id',true)),'')::uuid);
GRANT SELECT,INSERT,DELETE ON core_trade_images TO terminal_runtime;
