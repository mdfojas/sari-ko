import { readFileSync } from 'node:fs';
import type { PoolClient } from 'pg';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs the real migration file against the schema as it is after the stores migration, in a
// scratch schema that is rolled back afterwards.
const adminPool = new Pool({ connectionString: process.env.SUPERUSER_MIGRATIONS_DATABASE_URL });
const file = readFileSync(new URL('../../../db/migrations/1786300000001_store-prices-unique-per-store.sql', import.meta.url), 'utf8');
const [upPart, downPart] = file.split('-- Down Migration');
const UP = upPart.replace('-- Up Migration', '');
const DOWN = downPart;

let client: PoolClient;

beforeEach(async () => {
  client = await adminPool.connect();
  await client.query('BEGIN');
  await client.query('CREATE SCHEMA migtest');
  await client.query('SET LOCAL search_path = migtest');
  await client.query(`
    CREATE TABLE stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, selected_store_price_id INTEGER);
    CREATE TABLE store_prices (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
      store_id INTEGER NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
      price INTEGER NOT NULL CHECK (price > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE products ADD FOREIGN KEY (selected_store_price_id) REFERENCES store_prices (id) ON DELETE RESTRICT;
    INSERT INTO stores (name) VALUES ('Puregold'), ('SM');
    INSERT INTO products (name) VALUES ('Coke'), ('Pancit');
  `);
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

afterAll(async () => {
  await adminPool.end();
});

const price = async (productId: number, storeId: number, amount: number, updatedAt: string) =>
  (
    await client.query(
      `INSERT INTO store_prices (product_id, store_id, price, updated_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [productId, storeId, amount, updatedAt],
    )
  ).rows[0].id as number;
const ids = async () => (await client.query(`SELECT id FROM store_prices ORDER BY id`)).rows.map((r) => r.id as number);

describe('migration 1786300000001_store-prices-unique-per-store', () => {
  it('changes nothing when no product has two prices at one store, and then enforces it', async () => {
    const a = await price(1, 1, 100, '2026-01-01');
    const b = await price(1, 2, 200, '2026-01-01');
    await client.query(UP);

    expect(await ids()).toEqual([a, b]);
    expect((await client.query(`SELECT COUNT(*)::int AS n FROM store_prices_removed_duplicates`)).rows[0].n).toBe(0);
    await expect(client.query(`INSERT INTO store_prices (product_id, store_id, price) VALUES (1, 1, 5)`)).rejects.toMatchObject({
      code: '23505',
      constraint: 'store_prices_product_store_key',
    });
  });

  it('keeps the most recently updated price when a product has several at one store', async () => {
    const older = await price(1, 1, 100, '2026-01-01');
    const newest = await price(1, 1, 120, '2026-03-01');
    const middle = await price(1, 1, 110, '2026-02-01');
    await client.query(UP);

    expect(await ids()).toEqual([newest]);
    const { rows } = await client.query(`SELECT id, kept_id FROM store_prices_removed_duplicates ORDER BY id`);
    expect(rows).toEqual([
      { id: older, kept_id: newest },
      { id: middle, kept_id: newest },
    ]);
  });

  it('breaks an updated_at tie by keeping the higher id', async () => {
    const first = await price(1, 1, 100, '2026-01-01');
    const second = await price(1, 1, 100, '2026-01-01');
    await client.query(UP);
    expect(await ids()).toEqual([second]);
    expect(first).toBeLessThan(second);
  });

  // The selected price is the product's sale-price source; deleting it would be refused
  // (and would silently change what the product sells for), so it always wins.
  it('always keeps the price a product has selected, even when a newer duplicate exists', async () => {
    const selected = await price(1, 1, 100, '2026-01-01');
    await price(1, 1, 999, '2026-06-01');
    await client.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = 1`, [selected]);
    await client.query(UP);

    expect(await ids()).toEqual([selected]);
    expect((await client.query(`SELECT selected_store_price_id FROM products WHERE id = 1`)).rows[0].selected_store_price_id).toBe(selected);
  });

  it('dedupes each product and store separately, leaving everything else alone', async () => {
    const coke1 = await price(1, 1, 100, '2026-01-01');
    const coke2 = await price(1, 1, 110, '2026-02-01');
    const cokeSm = await price(1, 2, 300, '2026-01-01');
    const pancit = await price(2, 1, 400, '2026-01-01');
    await client.query(UP);

    expect(await ids()).toEqual([coke2, cokeSm, pancit]);
    expect(coke1).toBeLessThan(coke2);
  });

  it('records every removed price (with the one that was kept) so nothing is lost for good', async () => {
    await price(1, 1, 100, '2026-01-01');
    const kept = await price(1, 1, 110, '2026-02-01');
    await client.query(UP);

    const { rows } = await client.query(`SELECT product_id, store_id, price, kept_id FROM store_prices_removed_duplicates`);
    expect(rows).toEqual([{ product_id: 1, store_id: 1, price: 100, kept_id: kept }]);
  });

  it('can be undone: the removed prices come back and the constraint goes', async () => {
    const a = await price(1, 1, 100, '2026-01-01');
    const b = await price(1, 1, 110, '2026-02-01');
    await client.query(UP);
    await client.query(DOWN);

    expect(await ids()).toEqual([a, b]);
    await expect(client.query(`INSERT INTO store_prices (product_id, store_id, price) VALUES (1, 1, 5)`)).resolves.toBeDefined();
    expect((await client.query(`SELECT to_regclass('migtest.store_prices_removed_duplicates') AS t`)).rows[0].t).toBeNull();
  });

  it('undoing it skips a price whose store or product has been removed since, instead of failing', async () => {
    await price(1, 1, 100, '2026-01-01');
    const kept = await price(1, 1, 110, '2026-02-01');
    const other = await price(2, 2, 500, '2026-01-01');
    await price(2, 2, 510, '2026-02-02');
    await client.query(UP);
    // Product 1 (and so its prices) is deleted afterwards; the removed duplicate of product 1 can no longer come back.
    await client.query(`DELETE FROM products WHERE id = 1`);

    await expect(client.query(DOWN)).resolves.toBeDefined();
    const left = await ids();
    expect(left).not.toContain(kept);
    expect(left).toContain(other);
    expect(left).toHaveLength(2);
  });

  it('undoing it skips a removed price whose store has been deleted since, instead of failing', async () => {
    await price(1, 1, 100, '2026-01-01');
    const kept = await price(1, 1, 110, '2026-02-01');
    await client.query(UP);
    // The surviving price goes, and with nothing left the store can be deleted; the removed
    // duplicate pointed at that store, so it cannot come back.
    await client.query(`DELETE FROM store_prices WHERE id = $1`, [kept]);
    await client.query(`DELETE FROM stores WHERE id = 1`);

    await expect(client.query(DOWN)).resolves.toBeDefined();
    expect(await ids()).toEqual([]);
  });

  it('can be applied again after being undone', async () => {
    await price(1, 1, 100, '2026-01-01');
    await price(1, 1, 110, '2026-02-01');
    await client.query(UP);
    await client.query(DOWN);
    await expect(client.query(UP)).resolves.toBeDefined();
    expect(await ids()).toHaveLength(1);
  });
});
