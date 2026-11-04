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

  it('rejects an item that would push the loan total past the INTEGER ceiling, leaving the loan unchanged', async () => {
    const loanId = await createLoan();
    const add = (amount: number) =>
      app.inject({
        headers: authHeaderFor('admin'),
        method: 'POST',
        url: `/loans/${loanId}/line-items`,
        payload: { description: 'big', amount },
      });

    expect((await add(1_500_000_000)).statusCode).toBe(201);
    const over = await add(1_500_000_000);

    expect(over.statusCode).toBe(400);
    expect(over.json().error).toBe('The loan total can be at most ₱21,474,836.47');
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM loan_line_items WHERE loan_id = $1`, [loanId]);
    expect(rows[0].n).toBe(1);
    const loan = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/loans/${loanId}` });
    expect(loan.statusCode).toBe(200);
    expect(loan.json().total).toBe(1_500_000_000);
  });

  it.each([
    ['an amount over the ceiling', { description: 'big', amount: 3_000_000_000 }],
    ['a fractional amount', { description: 'frac', amount: 12.5 }],
    ['a zero amount', { description: 'zero', amount: 0 }],
    ['a catalog quantity of zero', { product_id: 1, quantity: 0 }],
  ])('returns 400, not a database 500, for %s', async (_label, payload) => {
    const loanId = await createLoan();
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/loans/${loanId}/line-items`,
      payload,
    });
    expect(response.statusCode).toBe(400);
  });
});
