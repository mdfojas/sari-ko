import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createPerson } from '../../../helpers.js';
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

    const getResponse = await app.inject({ method: 'GET', url: `/loans/${loan.id}` });
    expect(getResponse.json().total).toBe(13500);
  });

  it('leaves no loan row behind if the creation transaction fails partway', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
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
      method: 'POST',
      url: `/persons/${personId}/loans`,
      payload: { line_items: [] },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404, not 500, for a nonexistent person id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/persons/999999/loans`,
      payload: { line_items: [{ description: 'Kulang', amount: 500 }] },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects a malformed line item (neither product-linked nor freeform) with 400, not 500', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      method: 'POST',
      url: `/persons/${personId}/loans`,
      payload: { line_items: [{}] },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT * FROM loans WHERE person_id = $1`, [personId]);
    expect(rows).toHaveLength(0);
  });
});
