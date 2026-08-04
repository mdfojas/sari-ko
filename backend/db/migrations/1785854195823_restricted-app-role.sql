-- Up Migration

-- The application's runtime connection uses this role instead of the
-- superuser role migrations run as. This is what makes REVOKE meaningful
-- (a superuser bypasses all privilege checks, so REVOKE against it is a
-- no-op) — see Ticket 2.2's audit_log REVOKE for why this matters.
CREATE ROLE sariko_app WITH LOGIN PASSWORD 'sariko_app';

GRANT USAGE ON SCHEMA public TO sariko_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sariko_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  products, store_prices, persons, loans, loan_line_items, payments
  TO sariko_app;

-- Down Migration

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM sariko_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM sariko_app;
REVOKE USAGE ON SCHEMA public FROM sariko_app;
DROP ROLE sariko_app;
