import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /products/:id/store-prices', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('adds a new store price without changing which one is selected', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const addResponse = await app.inject({
      method: 'POST',
      url: `/products/${product.id}/store-prices`,
      payload: { store_name: 'SM Supermarket', price: 1200 },
    });

    expect(addResponse.statusCode).toBe(201);
    expect(addResponse.json().store_name).toBe('SM Supermarket');

    const productAfter = await app.inject({ method: 'GET', url: `/products/${product.id}` });
    expect(productAfter.json().original_price).toBe(1000);
  });

  it('returns 404 when the product does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/products/999999/store-prices',
      payload: { store_name: 'Puregold', price: 1000 },
    });
    expect(response.statusCode).toBe(404);
  });
});
