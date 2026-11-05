import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /persons/:id/loans', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a loan with a product-linked item and a freeform item, resolving the correct total', async () => {
    const personId = await createPerson('Juan Dela Cruz');
    const { rows: productRows } = await pool.query(
      `INSERT INTO products (name, sale_price) VALUES ('Coke 1.5L', 6500) RETURNING id`,
    );
    const productId = productRows[0].id;

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/loans`,
      payload: {
        line_items: [
          { product_id: productId, quantity: 2 },
          { description: 'Kulang', amount: 500 },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const loan = response.json();
    expect(loan.total).toBe(13500); // (2 * 6500) + 500

    const getResponse = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/loans/${loan.id}` });
    expect(getResponse.json().total).toBe(13500);
  });

  it('leaves no loan row behind if the creation transaction fails partway', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/loans`,
      payload: { line_items: [{ product_id: 999999, quantity: 1 }] },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT * FROM loans WHERE person_id = $1`, [personId]);
    expect(rows).toHaveLength(0);
  });

  it('rejects creating a loan with zero line items', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/loans`,
      payload: { line_items: [] },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404, not 500, for a nonexistent person id', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/999999/loans`,
      payload: { line_items: [{ description: 'Kulang', amount: 500 }] },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects a malformed line item (neither product-linked nor freeform) with 400, not 500', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/loans`,
      payload: { line_items: [{}] },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT * FROM loans WHERE person_id = $1`, [personId]);
    expect(rows).toHaveLength(0);
  });

  describe('amounts the 32-bit INTEGER columns cannot hold', () => {
    // Regression: a loan whose line items sum past 2,147,483,647 centavos used to be
    // committed and *then* fail on the response's SUM(...)::integer, leaving a
    // stored loan that made every later balance query (GET /persons, the ledger)
    // return a 500 for everyone.
    const post = (personId: number, payload: unknown) =>
      app.inject({
        headers: authHeaderFor('admin'),
        method: 'POST',
        url: `/persons/${personId}/loans`,
        payload: payload as object,
      });
    const nothingSaved = async (personId: number) => {
      const { rows } = await pool.query(`SELECT * FROM loans WHERE person_id = $1`, [personId]);
      expect(rows).toHaveLength(0);
    };

    it('rejects line items that are each fine but together exceed the ceiling — and saves nothing', async () => {
      const personId = await createPerson('Over Limit');

      const response = await post(personId, {
        line_items: [
          { description: 'a', amount: 1_500_000_000 },
          { description: 'b', amount: 1_500_000_000 },
        ],
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('The loan total can be at most ₱21,474,836.47');
      await nothingSaved(personId);
    });

    it('does not leave the persons list or the ledger broken after such a rejection', async () => {
      const personId = await createPerson('Still Healthy');
      await post(personId, {
        line_items: [
          { description: 'a', amount: 1_500_000_000 },
          { description: 'b', amount: 1_500_000_000 },
        ],
      });

      const list = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });
      const ledger = await app.inject({ method: 'GET', url: `/persons/${personId}/ledger`, headers: authHeaderFor('admin') });
      expect(list.statusCode).toBe(200);
      expect(ledger.statusCode).toBe(200);
      expect(ledger.json()).toEqual([]);
    });

    it('rejects a catalog line whose quantity x current price exceeds the ceiling — and saves nothing', async () => {
      const personId = await createPerson('Big Spender');
      const { rows } = await pool.query(`INSERT INTO products (name, sale_price) VALUES ('Gold Bar', 1500000000) RETURNING id`);

      const response = await post(personId, { line_items: [{ product_id: rows[0].id, quantity: 2 }] });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/at most ₱21,474,836\.47/);
      await nothingSaved(personId);
    });

    it.each([
      ['a single freeform amount over the ceiling', { description: 'big', amount: 3_000_000_000 }],
      ['a fractional freeform amount', { description: 'frac', amount: 12.5 }],
      ['a zero freeform amount', { description: 'zero', amount: 0 }],
    ])('returns 400, not a database 500, for %s', async (_label, lineItem) => {
      const personId = await createPerson('Bad Amounts');
      const response = await post(personId, { line_items: [lineItem] });
      expect(response.statusCode).toBe(400);
      await nothingSaved(personId);
    });

    it('still accepts a loan right at the ceiling', async () => {
      const personId = await createPerson('At The Limit');
      const response = await post(personId, { line_items: [{ description: 'max', amount: 2_147_483_647 }] });
      expect(response.statusCode).toBe(201);
      expect(response.json().total).toBe(2_147_483_647);
    });

    it('returns 400 for a malformed body instead of throwing', async () => {
      const personId = await createPerson('Malformed');
      expect((await post(personId, { line_items: [null] })).statusCode).toBe(400);
      expect((await post(personId, { line_items: 'x' })).statusCode).toBe(400);
    });
  });
});
