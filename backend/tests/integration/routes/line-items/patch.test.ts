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

describe('PATCH /line-items/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects setting quantity on a freeform line item', async () => {
    const loanId = await createLoan();
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500) RETURNING id`,
      [loanId],
    );

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/line-items/${itemRows[0].id}`,
      payload: { quantity: 7 },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT quantity, unit_price, amount FROM loan_line_items WHERE id = $1`, [
      itemRows[0].id,
    ]);
    expect(rows[0].quantity).toBeNull();
    expect(rows[0].unit_price).toBeNull();
    expect(rows[0].amount).toBe(500);
  });

  it('rejects setting amount directly on a product-linked line item', async () => {
    const loanId = await createLoan();
    const { rows: productRows } = await pool.query(
      `INSERT INTO products (name, sale_price) VALUES ('Coke 1.5L', 6500) RETURNING id`,
    );
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, product_id, description, quantity, unit_price, amount)
       VALUES ($1, $2, 'Coke 1.5L', 2, 6500, 13000) RETURNING id`,
      [loanId, productRows[0].id],
    );

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/line-items/${itemRows[0].id}`,
      payload: { amount: 99999 },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT amount FROM loan_line_items WHERE id = $1`, [itemRows[0].id]);
    expect(rows[0].amount).toBe(13000);
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
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/line-items/${lineItemId}`,
      payload: { quantity: 3 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.unit_price).toBe(6500);
    expect(body.amount).toBe(19500);
  });

  describe('input and amounts the database cannot hold', () => {
    const patch = (id: number, payload?: unknown) =>
      app.inject({
        headers: authHeaderFor('admin'),
        method: 'PATCH',
        url: `/line-items/${id}`,
        ...(payload === undefined ? {} : { payload: payload as object }),
      });
    async function freeformItem(amount = 500) {
      const loanId = await createLoan();
      const { rows } = await pool.query(
        `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', $2) RETURNING id`,
        [loanId, amount],
      );
      return { loanId, itemId: rows[0].id as number };
    }
    async function catalogItem(unitPrice: number, quantity = 1) {
      const loanId = await createLoan();
      const { rows: product } = await pool.query(`INSERT INTO products (name, sale_price) VALUES ('Gold', $1) RETURNING id`, [unitPrice]);
      const { rows } = await pool.query(
        `INSERT INTO loan_line_items (loan_id, product_id, description, quantity, unit_price, amount)
         VALUES ($1, $2, 'Gold', $3, $4, $5) RETURNING id`,
        [loanId, product[0].id, quantity, unitPrice, unitPrice * quantity],
      );
      return { loanId, itemId: rows[0].id as number };
    }

    it('returns 400 for no body at all', async () => {
      const { itemId } = await freeformItem();
      expect((await patch(itemId)).statusCode).toBe(400);
    });

    it.each([
      ['a negative amount', { amount: -5 }],
      ['a zero amount', { amount: 0 }],
      ['a fractional amount', { amount: 12.5 }],
      ['an amount over the INTEGER ceiling', { amount: 3_000_000_000 }],
      ['a blank description', { description: '  ' }],
      ['a non-text description', { description: 123 }],
      ['a NUL byte in the description', { description: 'a\u0000b' }],
    ])('returns 400, not a database 500, for %s on a freeform item', async (_label, payload) => {
      const { itemId } = await freeformItem();
      const response = await patch(itemId, payload);
      expect(response.statusCode).toBe(400);
      const { rows } = await pool.query(`SELECT description, amount FROM loan_line_items WHERE id = $1`, [itemId]);
      expect(rows[0]).toEqual({ description: 'Kulang', amount: 500 });
    });

    it.each([-1, 0, 1.5, 1e10])('returns 400 for a catalog quantity of %s', async (quantity) => {
      const { itemId } = await catalogItem(1000);
      expect((await patch(itemId, { quantity })).statusCode).toBe(400);
    });

    it('rejects an edit that would push the loan total past the INTEGER ceiling — and changes nothing', async () => {
      const loanId = await createLoan();
      const { rows } = await pool.query(
        `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'a', 1000000000), ($1, 'b', 1000000000) RETURNING id`,
        [loanId],
      );

      const response = await patch(rows[0].id, { amount: 2_147_483_647 });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('The loan total can be at most ₱21,474,836.47');
      const { rows: after } = await pool.query(`SELECT amount FROM loan_line_items WHERE id = $1`, [rows[0].id]);
      expect(after[0].amount).toBe(1_000_000_000);
      expect((await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') })).statusCode).toBe(200);
    });

    it('rejects a catalog quantity edit whose quantity x price exceeds the ceiling', async () => {
      const { itemId } = await catalogItem(1_000_000_000);

      const response = await patch(itemId, { quantity: 3 });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/at most ₱21,474,836\.47/);
      const { rows } = await pool.query(`SELECT quantity, amount FROM loan_line_items WHERE id = $1`, [itemId]);
      expect(rows[0]).toEqual({ quantity: 1, amount: 1_000_000_000 });
    });

    it('holds the ceiling under concurrent edits: two simultaneous PATCHes cannot each see room', async () => {
      for (let round = 0; round < 8; round++) {
        const loanId = await createLoan();
        const { rows } = await pool.query(
          `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'a', 500000000), ($1, 'b', 500000000) RETURNING id`,
          [loanId],
        );
        // Each edit alone fits (1.5e9 + 0.5e9); together they would be 3e9.
        const results = await Promise.all(rows.map((r) => patch(r.id, { amount: 1_500_000_000 })));

        expect(results.map((r) => r.statusCode).sort()).toEqual([200, 400]);
        const { rows: total } = await pool.query(`SELECT SUM(amount)::float8 AS total FROM loan_line_items WHERE loan_id = $1`, [loanId]);
        expect(total[0].total).toBeLessThanOrEqual(2_147_483_647);
      }
    });

    it('still saves a valid edit', async () => {
      const { itemId } = await freeformItem();
      const response = await patch(itemId, { description: 'Kulang pa', amount: 750 });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ description: 'Kulang pa', amount: 750 });
    });
  });
});
