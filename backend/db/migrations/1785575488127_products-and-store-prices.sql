-- Up Migration

-- store_prices is created first (without its FK to products yet) so that
-- products.selected_store_price_id can reference it below. The reverse FK
-- (store_prices.product_id -> products.id) is added afterwards, once
-- products exists, resolving the circular reference between the two tables.
CREATE TABLE store_prices (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  store_name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  other_names TEXT[] NOT NULL DEFAULT '{}',
  barcode TEXT UNIQUE,
  sale_price INTEGER NOT NULL DEFAULT 99999900 CHECK (sale_price > 0),
  selected_store_price_id INTEGER REFERENCES store_prices (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE store_prices
  ADD CONSTRAINT store_prices_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE;

-- Down Migration

ALTER TABLE store_prices DROP CONSTRAINT store_prices_product_id_fkey;
DROP TABLE products;
DROP TABLE store_prices;
