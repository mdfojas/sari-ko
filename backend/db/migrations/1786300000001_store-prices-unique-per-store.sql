-- Up Migration

-- A product can have only one price at a store. The old model never enforced it, and the stores
-- migration can produce it when two spellings of one store collapse into one, so any duplicates
-- are removed first. Rule for which price survives:
--   1. the price a product has selected as its sale-price source (deleting it would be refused,
--      and would silently change what the product sells for), else
--   2. the most recently updated one, with the higher id breaking a tie.
-- Every removed price is copied to store_prices_removed_duplicates (with the id of the one that
-- was kept) before it is deleted, so nothing is lost for good, and the Down migration puts them back.
CREATE TABLE store_prices_removed_duplicates (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  kept_id INTEGER NOT NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_prices_removed_duplicates (id, product_id, store_id, price, created_at, updated_at, kept_id)
SELECT id, product_id, store_id, price, created_at, updated_at, kept_id
FROM (
  SELECT sp.id, sp.product_id, sp.store_id, sp.price, sp.created_at, sp.updated_at,
         FIRST_VALUE(sp.id) OVER ranking AS kept_id,
         ROW_NUMBER() OVER ranking AS rn
  FROM (
    SELECT s.*, EXISTS (SELECT 1 FROM products p WHERE p.selected_store_price_id = s.id) AS is_selected
    FROM store_prices s
  ) sp
  WINDOW ranking AS (PARTITION BY sp.product_id, sp.store_id ORDER BY sp.is_selected DESC, sp.updated_at DESC, sp.id DESC)
) ranked
WHERE rn > 1;

DELETE FROM store_prices WHERE id IN (SELECT id FROM store_prices_removed_duplicates);

ALTER TABLE store_prices ADD CONSTRAINT store_prices_product_store_key UNIQUE (product_id, store_id);

-- Down Migration

ALTER TABLE store_prices DROP CONSTRAINT store_prices_product_store_key;

-- Put the removed prices back, except any whose product or store has been deleted since.
INSERT INTO store_prices (id, product_id, store_id, price, created_at, updated_at)
SELECT r.id, r.product_id, r.store_id, r.price, r.created_at, r.updated_at
FROM store_prices_removed_duplicates r
WHERE EXISTS (SELECT 1 FROM products p WHERE p.id = r.product_id)
  AND EXISTS (SELECT 1 FROM stores s WHERE s.id = r.store_id);

DROP TABLE store_prices_removed_duplicates;
