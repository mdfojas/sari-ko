-- Up Migration

CREATE TABLE persons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loans (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons (id) ON DELETE RESTRICT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loan_line_items (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER,
  unit_price INTEGER,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One-directional: product-linked requires quantity+unit_price. NOT the
  -- reverse — a product deletion (ON DELETE SET NULL, above) nulls product_id
  -- while leaving quantity/unit_price/amount as historical snapshots, which
  -- a two-directional pairing check would incorrectly reject.
  CHECK (product_id IS NULL OR (quantity IS NOT NULL AND unit_price IS NOT NULL)),
  CHECK (product_id IS NULL OR amount = quantity * unit_price)
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons (id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE payments;
DROP TABLE loan_line_items;
DROP TABLE loans;
DROP TABLE persons;
