import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /line-items/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("recomputes amount from the existing unit_price snapshot when quantity changes, not the product's current price", async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
      personRows[0].id,
    ]);
    const { rows: productRows } = await pool.query(
      `INSERT INTO products (name, sale_price) VALUES ('Coke 1.5L', 6500) RETURNING id`,
    );
    const productId = productRows[0].id;
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, product_id, description, quantity, unit_price, amount)
       VALUES ($1, $2, 'Coke 1.5L', 2, 6500, 13000) RETURNING id`,
      [loanRows[0].id, productId],
    );
    const lineItemId = itemRows[0].id;

    await pool.query(`UPDATE products SET sale_price = 9999 WHERE id = $1`, [productId]);

    const response = await app.inject({
      method: 'PATCH',
      url: `/line-items/${lineItemId}`,
      payload: { quantity: 3 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.unit_price).toBe(6500);
    expect(body.amount).toBe(19500);
  });
});
