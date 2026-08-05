import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/shared/db.js';
import { resetDatabase } from '../reset-db.js';

describe('products & store_prices schema', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('defaults sale_price to 99999900 when omitted', async () => {
    const { rows } = await pool.query(`INSERT INTO products (name) VALUES ('Test') RETURNING sale_price`);
    expect(rows[0].sale_price).toBe(99999900);
  });

  it('rejects a sale_price of 0', async () => {
    await expect(pool.query(`INSERT INTO products (name, sale_price) VALUES ('Test', 0)`)).rejects.toThrow();
  });

  it('rejects a store_prices.price of 0', async () => {
    const { rows } = await pool.query(`INSERT INTO products (name) VALUES ('Test') RETURNING id`);
    await expect(
      pool.query(`INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, 'Store', 0)`, [rows[0].id]),
    ).rejects.toThrow();
  });

  it('restricts deleting a store_price referenced by selected_store_price_id', async () => {
    const { rows: productRows } = await pool.query(`INSERT INTO products (name) VALUES ('Test') RETURNING id`);
    const productId = productRows[0].id;
    const { rows: priceRows } = await pool.query(
      `INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, 'Store', 100) RETURNING id`,
      [productId],
    );
    const priceId = priceRows[0].id;
    await pool.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = $2`, [priceId, productId]);

    await expect(pool.query(`DELETE FROM store_prices WHERE id = $1`, [priceId])).rejects.toThrow();
  });

  it('cascades product deletion to its store_prices', async () => {
    const { rows: productRows } = await pool.query(`INSERT INTO products (name) VALUES ('Test') RETURNING id`);
    const productId = productRows[0].id;
    await pool.query(`INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, 'Store', 100)`, [
      productId,
    ]);

    await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);

    const { rows } = await pool.query(`SELECT * FROM store_prices WHERE product_id = $1`, [productId]);
    expect(rows).toHaveLength(0);
  });
});
