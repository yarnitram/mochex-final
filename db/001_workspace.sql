CREATE ROLE terminal_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE TABLE terminal_users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL CHECK (email=lower(email)),
 password_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE terminal_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES terminal_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX terminal_sessions_user ON terminal_sessions(user_id);
CREATE TABLE terminal_login_limits (
 email text PRIMARY KEY, failures integer NOT NULL, window_start timestamptz NOT NULL
);
CREATE TABLE workspace_items (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES terminal_users(id), title text NOT NULL
);
ALTER TABLE workspace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_items FORCE ROW LEVEL SECURITY;
CREATE INDEX workspace_items_owner ON workspace_items(owner_id);
CREATE POLICY workspace_owner ON workspace_items TO terminal_runtime
 USING(owner_id=nullif((SELECT current_setting('terminal.owner_id',true)),'')::uuid)
 WITH CHECK(owner_id=nullif((SELECT current_setting('terminal.owner_id',true)),'')::uuid);
GRANT USAGE ON SCHEMA public TO terminal_runtime;
GRANT SELECT ON terminal_users TO terminal_runtime;
GRANT SELECT,INSERT,DELETE ON terminal_sessions TO terminal_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON terminal_login_limits TO terminal_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON workspace_items TO terminal_runtime;
