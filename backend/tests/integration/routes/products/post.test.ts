import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /products', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a product with store prices and resolves the selected price', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Coke 1.5L',
        store_prices: [
          { store_name: 'Puregold', price: 6000, selected: false },
          { store_name: 'SM Supermarket', price: 6500, selected: true },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Coke 1.5L');
    expect(body.original_price).toBe(6500);
    expect(body.selected_store_price_id).not.toBeNull();
  });

  it('rejects creating a product with no store prices', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: { name: 'No Prices' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects creating a product with no store price marked selected', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'No Selection',
        store_prices: [{ store_name: 'Puregold', price: 6000 }],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a store price of zero with a clean 400, not a database-constraint crash', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Doomed Product',
        store_prices: [{ store_name: 'Bad Store', price: 0, selected: true }],
      },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT * FROM products WHERE name = 'Doomed Product'`);
    expect(rows).toHaveLength(0);
  });

  it('rejects a store price with a blank store name', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'No Store Name',
        store_prices: [{ store_name: '', price: 1000, selected: true }],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
