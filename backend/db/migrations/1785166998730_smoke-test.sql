-- Up Migration

CREATE TABLE smoke_test (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE smoke_test;
