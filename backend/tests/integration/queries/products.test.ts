import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createProduct } from '../../../src/queries/products/index.js';
import { pool } from '../../../src/shared/db.js';
import { resetDatabase } from '../../reset-db.js';

// Exercises createProduct() directly, bypassing the route layer's
// validateCreateProduct — that validation now rejects a store price <= 0
// with a clean 400 before the query ever runs (Ticket 4.4), which is
// correct product behavior but also closed off the only way the old
// POST /products integration test could reach a genuine DB-level failure
// partway through this function's multi-statement transaction. Calling the
// query directly re-opens that path, so the transaction's actual rollback
// behavior — not just validateCreateProduct's front door — stays covered.
describe('createProduct — transaction rollback', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('leaves no product or store-price rows behind if a later statement fails the DB CHECK constraint', async () => {
    // 23514 = check_violation. Asserting the cause matters: any other failure
    // (say, a dropped connection on the first statement) would also leave no
    // rows behind and so would pass the checks below without proving a rollback.
    await expect(
      createProduct({
        name: 'Doomed Product',
        store_prices: [
          { store_name: 'Good Store', price: 1000, selected: true },
          { store_name: 'Bad Store', price: 0, selected: false },
        ],
      }),
    ).rejects.toMatchObject({ code: '23514' });

    const { rows: products } = await pool.query(`SELECT * FROM products WHERE name = 'Doomed Product'`);
    expect(products).toHaveLength(0);

    const { rows: storePrices } = await pool.query(`SELECT * FROM store_prices WHERE store_name = 'Good Store'`);
    expect(storePrices).toHaveLength(0);
  });
});
