import { readFileSync } from 'node:fs';
import type { PoolClient } from 'pg';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs the real migration file against the OLD schema, inside a scratch schema that is
// rolled back afterwards, so the migration is tested on awkward data without touching the
// tables the other tests use.
const adminPool = new Pool({ connectionString: process.env.SUPERUSER_MIGRATIONS_DATABASE_URL });
const file = readFileSync(new URL('../../../db/migrations/1786300000000_stores-table.sql', import.meta.url), 'utf8');
const [upPart, downPart] = file.split('-- Down Migration');
const UP = upPart.replace('-- Up Migration', '');
const DOWN = downPart;

let client: PoolClient;

beforeEach(async () => {
  client = await adminPool.connect();
  await client.query('BEGIN');
  await client.query('CREATE SCHEMA migtest');
  await client.query('SET LOCAL search_path = migtest');
  // The schema as it was before the migration.
  await client.query(`
    CREATE TABLE store_prices (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      store_name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0)
    );
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      selected_store_price_id INTEGER REFERENCES store_prices (id) ON DELETE RESTRICT
    );
  `);
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

afterAll(async () => {
  await adminPool.end();
});

async function addPrices(names: string[]) {
  const { rows } = await client.query(`INSERT INTO products (name) SELECT 'P' || g FROM generate_series(1, $1::int) g RETURNING id`, [names.length]);
  const ids: number[] = [];
  for (const [i, name] of names.entries()) {
    const { rows: price } = await client.query(
      `INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, $2, 100) RETURNING id`,
      [rows[i].id, name],
    );
    ids.push(price[0].id);
  }
  return { productIds: rows.map((r) => r.id as number), priceIds: ids };
}

const storeNames = async () => (await client.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name as string);
const priceStoreNames = async () =>
  (await client.query(`SELECT s.name FROM store_prices sp JOIN stores s ON s.id = sp.store_id ORDER BY sp.id`)).rows.map((r) => r.name as string);

describe('migration 1786300000000_stores-table', () => {
  it('turns each distinct name into a store and points every price at it', async () => {
    await addPrices(['Puregold', 'Puregold', 'SM', 'S&R']);
    await client.query(UP);

    expect(await storeNames()).toEqual(['Puregold', 'S&R', 'SM']);
    expect(await priceStoreNames()).toEqual(['Puregold', 'Puregold', 'SM', 'S&R']);
  });

  it('collapses spellings that differ only by case or padding into the most used spelling', async () => {
    await addPrices(['Puregold', 'puregold', 'puregold', '  PUREGOLD  ', 'SM']);
    await client.query(UP);

    expect(await storeNames()).toEqual(['SM', 'puregold']);
    expect(await priceStoreNames()).toEqual(['puregold', 'puregold', 'puregold', 'puregold', 'SM']);
  });

  it('gives a blank name a store called "Unknown store"', async () => {
    await addPrices(['   ', '']);
    await client.query(UP);
    expect(await storeNames()).toEqual(['Unknown store']);
    expect(await priceStoreNames()).toEqual(['Unknown store', 'Unknown store']);
  });

  it('cuts a name longer than 100 characters to 100', async () => {
    await addPrices(['x'.repeat(150)]);
    await client.query(UP);
    expect(await storeNames()).toEqual(['x'.repeat(100)]);
  });

  // The cut can land just after a space. Without trimming again, the name check rejected
  // the store and the whole migration aborted.
  it('does not abort when the 100-character cut ends in a space', async () => {
    const name = `${'x'.repeat(99)} tail of the name`;
    await addPrices([name, name.toUpperCase()]);

    await expect(client.query(UP)).resolves.toBeDefined();

    // Both spellings are used once; the tie goes to the first in plain byte order (upper case).
    expect(await storeNames()).toEqual(['X'.repeat(99)]);
    expect(await priceStoreNames()).toEqual(['X'.repeat(99), 'X'.repeat(99)]);
  });

  it('survives a name that is nothing but spaces after the cut', async () => {
    await addPrices([`${' '.repeat(50)}${'y'.repeat(120)}`]);
    await expect(client.query(UP)).resolves.toBeDefined();
    expect(await storeNames()).toEqual(['y'.repeat(100)]);
  });

  // Documented behaviour, pinned so it is a decision and not an accident: names that are
  // identical for their first 100 characters become one store.
  it('merges two different long names that share their first 100 characters into one store', async () => {
    const prefix = 'z'.repeat(100);
    await addPrices([`${prefix}-one`, `${prefix}-two`]);
    await client.query(UP);
    expect(await storeNames()).toEqual([prefix]);
    expect(await priceStoreNames()).toEqual([prefix, prefix]);
  });

  it('keeps every price and leaves none without a store', async () => {
    await addPrices(['A', 'a', ' A ', '', 'x'.repeat(130), 'B', 'B']);
    const before = (await client.query(`SELECT COUNT(*)::int AS n FROM store_prices`)).rows[0].n;
    await client.query(UP);

    expect((await client.query(`SELECT COUNT(*)::int AS n FROM store_prices`)).rows[0].n).toBe(before);
    expect((await client.query(`SELECT COUNT(*)::int AS n FROM store_prices WHERE store_id IS NULL`)).rows[0].n).toBe(0);
  });

  it('keeps a product\'s selected price pointing at the same store', async () => {
    const { productIds, priceIds } = await addPrices(['Puregold', 'puregold  ']);
    await client.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = $2`, [priceIds[1], productIds[1]]);
    await client.query(UP);

    const { rows } = await client.query(
      `SELECT s.name FROM products p JOIN store_prices sp ON sp.id = p.selected_store_price_id JOIN stores s ON s.id = sp.store_id WHERE p.id = $1`,
      [productIds[1]],
    );
    expect(rows[0].name).toBe('Puregold');
  });

  it('leaves the table with the constraints the app relies on', async () => {
    await addPrices(['Puregold']);
    await client.query(UP);

    await expect(client.query(`SAVEPOINT a`)).resolves.toBeDefined();
    await expect(client.query(`INSERT INTO stores (name) VALUES ('PUREGOLD')`)).rejects.toThrow();
    await client.query(`ROLLBACK TO SAVEPOINT a`);
    await expect(client.query(`INSERT INTO stores (name) VALUES (' padded ')`)).rejects.toThrow();
    await client.query(`ROLLBACK TO SAVEPOINT a`);
    await expect(client.query(`INSERT INTO store_prices (product_id, price) VALUES (1, 5)`)).rejects.toThrow();
  });

  it('gives the app role the privileges it needs on the new table and its sequence', async () => {
    await client.query(UP);
    const { rows } = await client.query(
      `SELECT has_table_privilege('sariko_app', 'migtest.stores', 'SELECT') AS s,
              has_table_privilege('sariko_app', 'migtest.stores', 'INSERT') AS i,
              has_table_privilege('sariko_app', 'migtest.stores', 'UPDATE') AS u,
              has_table_privilege('sariko_app', 'migtest.stores', 'DELETE') AS d,
              has_sequence_privilege('sariko_app', 'migtest.stores_id_seq', 'USAGE') AS q`,
    );
    expect(rows[0]).toEqual({ s: true, i: true, u: true, d: true, q: true });
  });

  it('can be undone: the text column comes back with every price intact', async () => {
    const { productIds, priceIds } = await addPrices(['Puregold', 'puregold', 'SM']);
    await client.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = $2`, [priceIds[0], productIds[0]]);
    await client.query(UP);
    await client.query(DOWN);

    const { rows } = await client.query(`SELECT store_name FROM store_prices ORDER BY id`);
    expect(rows.map((r) => r.store_name)).toEqual(['Puregold', 'Puregold', 'SM']);
    expect((await client.query(`SELECT selected_store_price_id FROM products WHERE id = $1`, [productIds[0]])).rows[0].selected_store_price_id).toBe(priceIds[0]);
    expect((await client.query(`SELECT to_regclass('migtest.stores') AS t`)).rows[0].t).toBeNull();
  });

  it('can be applied again after being undone', async () => {
    await addPrices(['Puregold', 'SM']);
    await client.query(UP);
    await client.query(DOWN);
    await expect(client.query(UP)).resolves.toBeDefined();
    expect(await storeNames()).toEqual(['Puregold', 'SM']);
  });
});
