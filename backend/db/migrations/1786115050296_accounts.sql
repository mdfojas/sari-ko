-- Up Migration

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'store_owner', 'customer')),
  person_id INTEGER UNIQUE REFERENCES persons (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only customer accounts are linked to a person; admin/store_owner accounts
  -- never are (see feature-specs/03-accounts-and-auth.md).
  CHECK ((role = 'customer') = (person_id IS NOT NULL))
);

-- The app's restricted role (see restricted-app-role.sql) needs explicit
-- grants on every table/sequence it touches — GRANTs made before this table
-- existed don't retroactively apply to it.
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO sariko_app;
GRANT USAGE, SELECT ON accounts_id_seq TO sariko_app;

-- Down Migration

DROP TABLE accounts;
