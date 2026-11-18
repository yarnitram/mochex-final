CREATE TABLE terminal_sources (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES terminal_users(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,owner_id)
);
CREATE INDEX terminal_sources_owner ON terminal_sources(owner_id,created_at DESC);
CREATE TABLE terminal_source_credentials (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,
 token_hash text UNIQUE NOT NULL CHECK(length(token_hash)=64),expires_at timestamptz NOT NULL,
 revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id)
);
CREATE INDEX terminal_credentials_source ON terminal_source_credentials(source_id,owner_id);
CREATE INDEX terminal_credentials_owner ON terminal_source_credentials(owner_id);
CREATE TABLE terminal_instruments (
 id uuid PRIMARY KEY,identity text UNIQUE NOT NULL,payload jsonb NOT NULL CHECK(payload->>'schemaVersion'='1')
);
CREATE TABLE terminal_signals (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,source_event_id text NOT NULL CHECK(length(source_event_id) BETWEEN 1 AND 128),
 instrument_id uuid NOT NULL REFERENCES terminal_instruments(id),payload jsonb NOT NULL,fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,owner_id),UNIQUE(source_id,source_event_id),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id)
);
CREATE INDEX terminal_signals_owner ON terminal_signals(owner_id,created_at DESC);
CREATE INDEX terminal_signals_instrument ON terminal_signals(instrument_id);
CREATE TABLE terminal_setups (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,signal_id uuid UNIQUE NOT NULL,
 instrument_id uuid NOT NULL REFERENCES terminal_instruments(id),state text NOT NULL DEFAULT 'detected'
 CHECK(state IN ('detected','watching','armed','entry-ready','invalidated','expired','cancelled')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,owner_id),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(signal_id,owner_id) REFERENCES terminal_signals(id,owner_id)
);
CREATE INDEX terminal_setups_owner ON terminal_setups(owner_id,updated_at DESC);
CREATE INDEX terminal_setups_source ON terminal_setups(source_id,owner_id);
CREATE INDEX terminal_setups_instrument ON terminal_setups(instrument_id);
CREATE TABLE terminal_outbox (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,signal_id uuid NOT NULL,
 channel text NOT NULL DEFAULT 'dry-run' CHECK(channel='dry-run'),
 status text NOT NULL CHECK(status IN ('queued','held','expired','completed','failed')),
 payload jsonb NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id),UNIQUE(signal_id,channel),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(signal_id,owner_id) REFERENCES terminal_signals(id,owner_id)
);
CREATE INDEX terminal_outbox_owner ON terminal_outbox(owner_id,created_at);
CREATE INDEX terminal_outbox_source ON terminal_outbox(source_id,owner_id);
CREATE INDEX terminal_outbox_pending ON terminal_outbox(created_at) WHERE status='queued';
CREATE TABLE terminal_ingest_conflicts (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,source_event_id text NOT NULL,
 incoming_fingerprint text NOT NULL,signal_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,source_event_id,incoming_fingerprint),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(signal_id,owner_id) REFERENCES terminal_signals(id,owner_id)
);
CREATE INDEX terminal_conflicts_owner ON terminal_ingest_conflicts(owner_id,created_at DESC);
CREATE INDEX terminal_conflicts_signal ON terminal_ingest_conflicts(signal_id,owner_id);
CREATE TABLE terminal_trades (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,setup_id uuid UNIQUE NOT NULL,
 instrument_id uuid NOT NULL REFERENCES terminal_instruments(id),side text NOT NULL CHECK(side IN ('long','short')),
 initial_risk text NOT NULL CHECK(length(initial_risk)<=30 AND initial_risk ~ '^(0|[1-9][0-9]*)([.][0-9]+)?$' AND initial_risk::numeric>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','open','closed')),ledger jsonb,UNIQUE(id,owner_id),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(setup_id,owner_id) REFERENCES terminal_setups(id,owner_id)
);
CREATE INDEX terminal_trades_owner ON terminal_trades(owner_id);
CREATE INDEX terminal_trades_source ON terminal_trades(source_id,owner_id);
CREATE INDEX terminal_trades_instrument ON terminal_trades(instrument_id);
CREATE TABLE terminal_fills (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,source_fill_id text NOT NULL,trade_id uuid NOT NULL,
 payload jsonb NOT NULL,fingerprint text NOT NULL,UNIQUE(source_id,source_fill_id),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(trade_id,owner_id) REFERENCES terminal_trades(id,owner_id)
);
CREATE INDEX terminal_fills_owner ON terminal_fills(owner_id);
CREATE INDEX terminal_fills_trade ON terminal_fills(trade_id,owner_id);
CREATE TABLE terminal_delivery_attempts (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,outbox_id uuid NOT NULL,attempt integer NOT NULL CHECK(attempt>0),
 status text NOT NULL CHECK(status IN ('failed','provider-accepted','uncertain')),provider_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(outbox_id,attempt),
 CHECK(status<>'provider-accepted' OR provider_reference IS NOT NULL),
 FOREIGN KEY(outbox_id,owner_id) REFERENCES terminal_outbox(id,owner_id)
);
CREATE INDEX terminal_attempts_owner ON terminal_delivery_attempts(owner_id);

DO $policy$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['terminal_sources','terminal_source_credentials','terminal_signals','terminal_setups','terminal_outbox','terminal_ingest_conflicts','terminal_trades','terminal_fills','terminal_delivery_attempts']
 LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY owner_scope ON %I TO terminal_runtime USING(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid) WITH CHECK(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid)',table_name);
 END LOOP;
END $policy$;
CREATE POLICY credential_lookup ON terminal_source_credentials FOR SELECT TO terminal_runtime
 USING(token_hash=(SELECT current_setting('terminal.credential_hash',true)));

GRANT SELECT,INSERT ON terminal_instruments,terminal_sources,terminal_source_credentials,terminal_signals,terminal_setups,terminal_outbox,terminal_ingest_conflicts,terminal_trades,terminal_fills,terminal_delivery_attempts TO terminal_runtime;
GRANT UPDATE(name,enabled) ON terminal_sources TO terminal_runtime;
GRANT UPDATE(revoked_at) ON terminal_source_credentials TO terminal_runtime;
GRANT UPDATE(state,revision,updated_at) ON terminal_setups TO terminal_runtime;
GRANT UPDATE(status,ledger) ON terminal_trades TO terminal_runtime;
GRANT UPDATE(status) ON terminal_outbox TO terminal_runtime;
