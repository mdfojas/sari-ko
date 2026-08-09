import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createLoan() {
  const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
  const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
    personRows[0].id,
  ]);
  return loanRows[0].id;
}

describe('POST /loans/:id/line-items', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('adds a product-linked line item, snapshotting the current sale_price', async () => {
    const loanId = await createLoan();
    const { rows: productRows } = await pool.query(
      `INSERT INTO products (name, sale_price) VALUES ('Coke 1.5L', 6500) RETURNING id`,
    );
    const productId = productRows[0].id;

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/loans/${loanId}/line-items`,
      payload: { product_id: productId, quantity: 3 },
    });

    expect(response.statusCode).toBe(201);
    const item = response.json();
    expect(item.unit_price).toBe(6500);
    expect(item.amount).toBe(19500);
  });

  it("does not change an existing line item's snapshot when the product's sale_price later changes", async () => {
    const loanId = await createLoan();
    const { rows: productRows } = await pool.query(
      `INSERT INTO products (name, sale_price) VALUES ('Coke 1.5L', 6500) RETURNING id`,
    );
    const productId = productRows[0].id;

    const createResponse = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/loans/${loanId}/line-items`,
      payload: { product_id: productId, quantity: 2 },
    });
    const item = createResponse.json();

    await pool.query(`UPDATE products SET sale_price = 9999 WHERE id = $1`, [productId]);

    const getResponse = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/line-items/${item.id}` });
    expect(getResponse.json().unit_price).toBe(6500);
    expect(getResponse.json().amount).toBe(13000);
  });

  it('adds a freeform line item', async () => {
    const loanId = await createLoan();

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/loans/${loanId}/line-items`,
      payload: { description: 'Kulang', amount: 500 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().description).toBe('Kulang');
  });

  it('returns 404, not 500, for a nonexistent loan id', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/loans/999999/line-items`,
      payload: { description: 'Kulang', amount: 500 },
    });

    expect(response.statusCode).toBe(404);
  });
});
