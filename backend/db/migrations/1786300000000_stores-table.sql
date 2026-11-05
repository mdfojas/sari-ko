-- Up Migration

-- A store used to be nothing but free text on each store price. It becomes a real
-- row, so it can be created before it has any price, renamed in one place, merged
-- into another store, and listed without scanning every price.
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (name = btrim(name) AND name <> '' AND char_length(name) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive: "puregold" and "Puregold" are the same store.
CREATE UNIQUE INDEX stores_name_lower_key ON stores (lower(name));

-- Backfill one store per distinct name. The old column allowed anything, so names are
-- normalised the same way for the stores and for the prices that point at them: trimmed,
-- cut to 100 characters (and trimmed again, because the cut can land just after a space),
-- a blank one becoming 'Unknown store', and spellings that differ only by case collapsing
-- into the most used spelling (ties go to the first in plain byte order, so the result does
-- not depend on the database's locale).
-- Note: two different names that are identical for their first 100 characters become one
-- store, as the old column had no length limit.
INSERT INTO stores (name)
SELECT name
FROM (
  SELECT name,
         ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY uses DESC, name COLLATE "C") AS rn
  FROM (
    SELECT COALESCE(NULLIF(btrim(left(btrim(store_name), 100)), ''), 'Unknown store') AS name, COUNT(*) AS uses
    FROM store_prices
    GROUP BY 1
  ) spellings
) ranked
WHERE rn = 1
ORDER BY lower(name) COLLATE "C", name COLLATE "C";

ALTER TABLE store_prices ADD COLUMN store_id INTEGER REFERENCES stores (id) ON DELETE RESTRICT;

UPDATE store_prices sp
SET store_id = s.id
FROM stores s
WHERE lower(s.name) = lower(COALESCE(NULLIF(btrim(left(btrim(sp.store_name), 100)), ''), 'Unknown store'));

ALTER TABLE store_prices ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE store_prices DROP COLUMN store_name;
CREATE INDEX store_prices_store_id_idx ON store_prices (store_id);

-- New tables always need their own explicit grant (a blanket grant made earlier does not
-- reach a table created later).
GRANT SELECT, INSERT, UPDATE, DELETE ON stores TO sariko_app;
GRANT USAGE, SELECT ON SEQUENCE stores_id_seq TO sariko_app;

-- Down Migration

-- Restores the text column from the store each price points at. Stores that have no
-- price are lost (the old model has nowhere to keep them).
ALTER TABLE store_prices ADD COLUMN store_name TEXT;

UPDATE store_prices sp
SET store_name = s.name
FROM stores s
WHERE s.id = sp.store_id;

ALTER TABLE store_prices ALTER COLUMN store_name SET NOT NULL;
DROP INDEX store_prices_store_id_idx;
ALTER TABLE store_prices DROP COLUMN store_id;
DROP TABLE stores;
