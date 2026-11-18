ALTER TABLE terminal_setups ADD COLUMN geometry jsonb;
ALTER TABLE terminal_setups ADD COLUMN configuration_version text;
ALTER TABLE terminal_setups ADD COLUMN last_observed_at timestamptz;
GRANT UPDATE(geometry,configuration_version,last_observed_at) ON terminal_setups TO terminal_runtime;
CREATE TABLE terminal_setup_bindings(
 source_id uuid NOT NULL,owner_id uuid NOT NULL,external_setup_id text NOT NULL,
 configuration_version text NOT NULL,setup_id uuid UNIQUE NOT NULL,
 PRIMARY KEY(source_id,external_setup_id,configuration_version),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(setup_id,owner_id) REFERENCES terminal_setups(id,owner_id)
);
CREATE INDEX terminal_bindings_owner ON terminal_setup_bindings(owner_id);
CREATE TABLE terminal_setup_observations(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,setup_id uuid NOT NULL,
 signal_id uuid UNIQUE NOT NULL,revision integer NOT NULL CHECK(revision>=0),
 state text NOT NULL CHECK(state IN ('armed','entry-ready','expired','invalidated')),observed_at timestamptz NOT NULL,
 UNIQUE(setup_id,revision),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id),
 FOREIGN KEY(setup_id,owner_id) REFERENCES terminal_setups(id,owner_id),
 FOREIGN KEY(signal_id,owner_id) REFERENCES terminal_signals(id,owner_id)
);
CREATE INDEX terminal_observations_owner ON terminal_setup_observations(owner_id);
CREATE INDEX terminal_observations_source ON terminal_setup_observations(source_id,owner_id);
CREATE TABLE terminal_reconciliation_events(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,source_id uuid NOT NULL,
 external_setup_id text NOT NULL,configuration_version text NOT NULL,revision integer NOT NULL,
 fingerprint text NOT NULL,reason text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,external_setup_id,configuration_version,revision,fingerprint,reason),
 FOREIGN KEY(source_id,owner_id) REFERENCES terminal_sources(id,owner_id)
);
CREATE INDEX terminal_reconciliation_owner ON terminal_reconciliation_events(owner_id,created_at DESC);
DO $policy$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['terminal_setup_bindings','terminal_setup_observations','terminal_reconciliation_events']
 LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY owner_scope ON %I TO terminal_runtime USING(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid) WITH CHECK(owner_id=nullif((SELECT current_setting(''terminal.owner_id'',true)),'''')::uuid)',table_name);
 END LOOP;
END $policy$;
GRANT SELECT,INSERT ON terminal_setup_bindings,terminal_setup_observations,terminal_reconciliation_events TO terminal_runtime;
