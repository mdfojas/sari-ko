-- Up Migration

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  changes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Given two jsonb row snapshots, returns only the keys whose values differ,
-- shaped as {"field": {"from": ..., "to": ...}} — used by the UPDATE case
-- of the trigger below.
CREATE FUNCTION jsonb_diff(old_row JSONB, new_row JSONB) RETURNS JSONB AS $$
  SELECT COALESCE(
    jsonb_object_agg(key, jsonb_build_object('from', old_row -> key, 'to', new_row -> key)),
    '{}'::jsonb
  )
  FROM jsonb_object_keys(new_row) AS key
  WHERE old_row -> key IS DISTINCT FROM new_row -> key;
$$ LANGUAGE sql IMMUTABLE;

-- Fires on every INSERT/UPDATE/DELETE on the tracked tables, regardless of
-- whether the change came through the API, a script, or a direct SQL
-- session. entity_type is passed via TG_ARGV[0] so one function serves all
-- three tables.
CREATE FUNCTION log_audit_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES (TG_ARGV[0], NEW.id, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES (TG_ARGV[0], NEW.id, 'update', jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES (TG_ARGV[0], OLD.id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loans_audit
  AFTER INSERT OR UPDATE OR DELETE ON loans
  FOR EACH ROW EXECUTE FUNCTION log_audit_change('loan');

CREATE TRIGGER loan_line_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON loan_line_items
  FOR EACH ROW EXECUTE FUNCTION log_audit_change('loan_line_item');

CREATE TRIGGER payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_audit_change('payment');

GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO sariko_app;
GRANT SELECT, INSERT ON audit_log TO sariko_app;
REVOKE UPDATE, DELETE ON audit_log FROM sariko_app;

-- Down Migration

DROP TRIGGER payments_audit ON payments;
DROP TRIGGER loan_line_items_audit ON loan_line_items;
DROP TRIGGER loans_audit ON loans;
DROP FUNCTION log_audit_change();
DROP FUNCTION jsonb_diff(JSONB, JSONB);
DROP TABLE audit_log;
